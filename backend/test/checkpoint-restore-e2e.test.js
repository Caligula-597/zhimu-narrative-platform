import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId } from "./helpers/fixture-ids.js";

async function createRestoreFixture(suffix) {
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, 'checkpoint restore e2e', 'testing')
     RETURNING id`,
    [hostUserId, `恢复测试 ${suffix}`]
  );
  const chapter = await query(
    `INSERT INTO chapters (world_id, title, summary, sequence)
     VALUES ($1, '测试章', '', 1)
     RETURNING id`,
    [world.rows[0].id]
  );
  const role = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, '测试角色', 1)
     RETURNING id`,
    [world.rows[0].id]
  );
  const script = await query(
    `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, '测试剧本') RETURNING id`,
    [role.rows[0].id]
  );
  const section = await query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     VALUES ($1, $2, $3, '第一段', 'body', 1, 'published')
     RETURNING id`,
    [script.rows[0].id, role.rows[0].id, chapter.rows[0].id]
  );
  const rule = await query(
    `INSERT INTO automation_rules (world_id, name, mode, priority, conditions, actions)
     VALUES ($1, '测试规则', 'automatic', 10, '{"all":[]}'::jsonb, '[]'::jsonb)
     RETURNING id`,
    [world.rows[0].id]
  );
  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, $3, $4, 'testing')
     RETURNING id`,
    [world.rows[0].id, hostUserId, `恢复房 ${suffix}`, `RESTORE-${suffix}`]
  );
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id, status)
     VALUES ($1, $2, 'host', NULL, 'active'),
            ($1, $3, 'player', $4, 'active')
     ON CONFLICT (room_id, user_id) DO UPDATE
     SET role_slot_id = EXCLUDED.role_slot_id, status = 'active'`,
    [room.rows[0].id, hostUserId, playerUserId, role.rows[0].id]
  );
  return {
    worldId: world.rows[0].id,
    roomId: room.rows[0].id,
    roleId: role.rows[0].id,
    sectionId: section.rows[0].id,
    ruleId: rule.rows[0].id
  };
}

async function deleteRestoreFixture(worldId) {
  await query(`DELETE FROM rooms WHERE world_id = $1`, [worldId]);
  await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
}

test("checkpoint restore reverts rule executions added after snapshot", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRestoreFixture(suffix);
  context.after(() => deleteRestoreFixture(fx.worldId));

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const create = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/checkpoints`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "before-rule-exec", description: "baseline" }
  });
  assert.equal(create.statusCode, 201);
  const checkpointId = create.json().id;
  assert.equal(create.json().snapshot.ruleExecutions?.length ?? 0, 0);

  await query(
    `INSERT INTO rule_executions (rule_id, room_id, result)
     VALUES ($1, $2, '{"probe":true}'::jsonb)`,
    [fx.ruleId, fx.roomId]
  );

  const afterInsert = await query(`SELECT 1 FROM rule_executions WHERE room_id = $1`, [fx.roomId]);
  assert.equal(afterInsert.rowCount, 1);

  const restore = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/checkpoints/${checkpointId}/restore`,
    headers: { "x-user-id": hostUserId },
    payload: { scope: { ruleExecutions: true, readingProgress: false, clueOwnership: false, inventory: false, contentUnlocks: false, pendingHostEvents: false, investigationRecords: false, playerStates: false } }
  });
  assert.equal(restore.statusCode, 200);
  assert.equal(restore.json().status, "applied");

  const afterRestore = await query(`SELECT 1 FROM rule_executions WHERE room_id = $1`, [fx.roomId]);
  assert.equal(afterRestore.rowCount, 0, "rule executions should match empty snapshot");
});

test("full scoped restore reverts reading progress and investigation records", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRestoreFixture(suffix);
  context.after(() => deleteRestoreFixture(fx.worldId));

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const scene = await query(
    `INSERT INTO scenes (world_id, name, public_text)
     VALUES ($1, '测试场景', 'scene')
     RETURNING id`,
    [fx.worldId]
  );
  const point = await query(
    `INSERT INTO investigation_points (world_id, scene_id, name, description, interaction_text, result_text, sequence)
     VALUES ($1, $2, '测试点', '', '查', '结果', 1)
     RETURNING id`,
    [fx.worldId, scene.rows[0].id]
  );
  await query(
    `INSERT INTO room_content_unlocks (room_id, content_type, content_id)
     VALUES ($1, 'scene', $2)
     ON CONFLICT DO NOTHING`,
    [fx.roomId, scene.rows[0].id]
  );

  const create = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/checkpoints`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "before-mutations", description: "baseline" }
  });
  assert.equal(create.statusCode, 201);
  const checkpointId = create.json().id;

  const complete = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/sections/${fx.sectionId}/complete`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(complete.statusCode, 200);

  const investigate = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/investigation-points/${point.rows[0].id}/investigate`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(investigate.statusCode, 200);

  const progressBefore = await query(`SELECT 1 FROM reading_progress WHERE room_id = $1 AND completed_at IS NOT NULL`, [fx.roomId]);
  const recordsBefore = await query(`SELECT 1 FROM investigation_records WHERE room_id = $1`, [fx.roomId]);
  assert.ok(progressBefore.rowCount >= 1);
  assert.ok(recordsBefore.rowCount >= 1);

  const restore = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/checkpoints/${checkpointId}/restore`,
    headers: { "x-user-id": hostUserId },
    payload: {
      scope: {
        readingProgress: true,
        investigationRecords: true,
        clueOwnership: false,
        inventory: false,
        contentUnlocks: false,
        pendingHostEvents: false,
        playerStates: false,
        ruleExecutions: false
      }
    }
  });
  assert.equal(restore.statusCode, 200);

  const progressAfter = await query(`SELECT 1 FROM reading_progress WHERE room_id = $1 AND completed_at IS NOT NULL`, [fx.roomId]);
  const recordsAfter = await query(`SELECT 1 FROM investigation_records WHERE room_id = $1`, [fx.roomId]);
  assert.equal(progressAfter.rowCount, 0);
  assert.equal(recordsAfter.rowCount, 0);
});

test("checkpoint restore can revert timeline logs when scoped", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRestoreFixture(suffix);
  context.after(() => deleteRestoreFixture(fx.worldId));

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  await query(
    `INSERT INTO timeline_logs (room_id, visibility, event_type, message, metadata)
     VALUES ($1, 'host', 'host_action', 'baseline log', '{}'::jsonb)`,
    [fx.roomId]
  );

  const create = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/checkpoints`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "timeline baseline", description: "" }
  });
  assert.equal(create.statusCode, 201);
  const checkpointId = create.json().id;
  assert.ok((create.json().snapshot.timelineLogs ?? []).length >= 1);

  await query(
    `INSERT INTO timeline_logs (room_id, visibility, event_type, message, metadata)
     VALUES ($1, 'host', 'host_action', 'after snapshot log', '{}'::jsonb)`,
    [fx.roomId]
  );

  const restore = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/checkpoints/${checkpointId}/restore`,
    headers: { "x-user-id": hostUserId },
    payload: {
      scope: {
        timelineLogs: true,
        readingProgress: false,
        clueOwnership: false,
        inventory: false,
        contentUnlocks: false,
        pendingHostEvents: false,
        investigationRecords: false,
        playerStates: false,
        ruleExecutions: false
      }
    }
  });
  assert.equal(restore.statusCode, 200);

  const logs = await query(
    `SELECT message FROM timeline_logs WHERE room_id = $1 ORDER BY created_at ASC`,
    [fx.roomId]
  );
  assert.equal(logs.rowCount, 2);
  assert.equal(logs.rows[0].message, "baseline log");
  assert.equal(logs.rows[1].message, "主持人从存档恢复了房间运行状态");
});

test("checkpoint restore supports cross-room target in same world", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRestoreFixture(suffix);
  context.after(() => deleteRestoreFixture(fx.worldId));

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const targetRoom = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, $3, $4, 'testing')
     RETURNING id`,
    [fx.worldId, hostUserId, `目标房 ${suffix}`, `TARGET-${suffix}`]
  );
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, status)
     VALUES ($1, $2, 'host', 'active')
     ON CONFLICT (room_id, user_id) DO UPDATE SET status = 'active'`,
    [targetRoom.rows[0].id, hostUserId]
  );

  const create = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/checkpoints`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "source baseline", description: "" }
  });
  assert.equal(create.statusCode, 201);
  const checkpointId = create.json().id;

  await query(
    `INSERT INTO reading_progress (room_id, role_slot_id, script_section_id, started_at, completed_at)
     VALUES ($1, $2, $3, now(), now())`,
    [fx.roomId, fx.roleId, fx.sectionId]
  );

  const restore = await app.inject({
    method: "POST",
    url: `/api/rooms/${targetRoom.rows[0].id}/checkpoints/${checkpointId}/restore`,
    headers: { "x-user-id": hostUserId },
    payload: {
      scope: {
        readingProgress: true,
        clueOwnership: false,
        inventory: false,
        contentUnlocks: false,
        pendingHostEvents: false,
        investigationRecords: false,
        playerStates: false,
        ruleExecutions: false,
        timelineLogs: false
      }
    }
  });
  assert.equal(restore.statusCode, 200);
  assert.equal(restore.json().crossRoom, true);
  assert.equal(restore.json().sourceRoomId, fx.roomId);
  assert.equal(restore.json().targetRoomId, targetRoom.rows[0].id);

  const targetProgress = await query(
    `SELECT 1 FROM reading_progress WHERE room_id = $1 AND completed_at IS NOT NULL`,
    [targetRoom.rows[0].id]
  );
  assert.equal(targetProgress.rowCount, 0);

  const sourceProgress = await query(
    `SELECT 1 FROM reading_progress WHERE room_id = $1 AND completed_at IS NOT NULL`,
    [fx.roomId]
  );
  assert.equal(sourceProgress.rowCount, 1, "source room progress should remain untouched");
});

test("checkpoint restore rejects cross-world target room", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRestoreFixture(suffix);
  context.after(() => deleteRestoreFixture(fx.worldId));

  const otherWorld = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, 'other world', 'testing')
     RETURNING id`,
    [hostUserId, `其它世界 ${suffix}`]
  );
  context.after(async () => {
    await query(`DELETE FROM rooms WHERE id = $1`, [otherRoom.rows[0].id]);
    await query(`DELETE FROM worlds WHERE id = $1`, [otherWorld.rows[0].id]);
  });

  const otherRoom = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, $3, $4, 'testing')
     RETURNING id`,
    [otherWorld.rows[0].id, hostUserId, `其它房 ${suffix}`, `OTHER-${suffix}`]
  );
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, status)
     VALUES ($1, $2, 'host', 'active')
     ON CONFLICT (room_id, user_id) DO UPDATE SET status = 'active'`,
    [otherRoom.rows[0].id, hostUserId]
  );

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const create = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/checkpoints`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "world mismatch probe", description: "" }
  });
  assert.equal(create.statusCode, 201);
  const checkpointId = create.json().id;

  const restore = await app.inject({
    method: "POST",
    url: `/api/rooms/${otherRoom.rows[0].id}/checkpoints/${checkpointId}/restore`,
    headers: { "x-user-id": hostUserId },
    payload: {
      scope: {
        readingProgress: true,
        clueOwnership: false,
        inventory: false,
        contentUnlocks: false,
        pendingHostEvents: false,
        investigationRecords: false,
        playerStates: false,
        ruleExecutions: false,
        timelineLogs: false
      }
    }
  });
  assert.equal(restore.statusCode, 400);
  assert.equal(restore.json().code, "CHECKPOINT_WORLD_MISMATCH");
});
