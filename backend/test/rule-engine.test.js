import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRoomRules, executeActions } from "../src/rule-engine.js";
import { pool, query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

async function createRuleFixture(suffix) {
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, 'rule engine fixture', 'testing')
     RETURNING id`,
    [hostUserId, `规则测试 ${suffix}`]
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
  const firstSection = await query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     VALUES ($1, $2, $3, '第一段', 'body', 1, 'testing')
     RETURNING id`,
    [script.rows[0].id, role.rows[0].id, chapter.rows[0].id]
  );
  const secondSection = await query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     VALUES ($1, $2, $3, '第二段', 'body', 2, 'testing')
     RETURNING id`,
    [script.rows[0].id, role.rows[0].id, chapter.rows[0].id]
  );
  const scene = await query(
    `INSERT INTO scenes (world_id, name, public_text)
     VALUES ($1, '测试场景', '场景说明')
     RETURNING id`,
    [world.rows[0].id]
  );
  const clue = await query(
    `INSERT INTO clues (world_id, name, public_text, visibility)
     VALUES ($1, '测试线索', '线索内容', 'role')
     RETURNING id`,
    [world.rows[0].id]
  );
  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, $3, $4, 'testing')
     RETURNING id`,
    [world.rows[0].id, hostUserId, `规则测试房 ${suffix}`, `RULE-${suffix}`]
  );
  return {
    worldId: world.rows[0].id,
    roomId: room.rows[0].id,
    roleId: role.rows[0].id,
    firstSectionId: firstSection.rows[0].id,
    secondSectionId: secondSection.rows[0].id,
    sceneId: scene.rows[0].id,
    clueId: clue.rows[0].id
  };
}

async function deleteFixture(worldId) {
  await query(`DELETE FROM rooms WHERE world_id = $1`, [worldId]);
  await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
}

test("automatic rule executes once and unlocks script section", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRuleFixture(suffix);
  context.after(() => deleteFixture(fx.worldId));

  const rule = await query(
    `INSERT INTO automation_rules (world_id, room_id, name, mode, enabled, conditions, actions)
     VALUES ($1, $2, '阅读解锁', 'automatic', true, $3::jsonb, $4::jsonb)
     RETURNING id`,
    [
      fx.worldId,
      fx.roomId,
      JSON.stringify({ all: [{ type: "reading_completed", roleSlotId: fx.roleId, scriptSectionId: fx.firstSectionId }] }),
      JSON.stringify([
        { type: "unlock_script_section", scriptSectionId: fx.secondSectionId },
        { type: "timeline_log", message: "规则测试时间线" }
      ])
    ]
  );

  await query(
    `INSERT INTO reading_progress (room_id, role_slot_id, script_section_id, started_at, completed_at)
     VALUES ($1, $2, $3, now(), now())`,
    [fx.roomId, fx.roleId, fx.firstSectionId]
  );

  const firstRun = await evaluateRoomRules(fx.roomId);
  assert.deepEqual(firstRun, [rule.rows[0].id]);

  const unlock = await query(
    `SELECT 1 FROM room_content_unlocks
     WHERE room_id = $1 AND content_type = 'script_section' AND content_id = $2`,
    [fx.roomId, fx.secondSectionId]
  );
  assert.equal(unlock.rowCount, 1);

  const execution = await query(
    `SELECT 1 FROM rule_executions WHERE rule_id = $1 AND room_id = $2`,
    [rule.rows[0].id, fx.roomId]
  );
  assert.equal(execution.rowCount, 1);

  const secondRun = await evaluateRoomRules(fx.roomId);
  assert.deepEqual(secondRun, []);
});

test("host_confirm rule creates pending event without auto execution", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRuleFixture(suffix);
  context.after(() => deleteFixture(fx.worldId));

  const rule = await query(
    `INSERT INTO automation_rules (world_id, room_id, name, mode, enabled, conditions, actions)
     VALUES ($1, $2, '主持确认解锁场景', 'host_confirm', true, $3::jsonb, $4::jsonb)
     RETURNING id`,
    [
      fx.worldId,
      fx.roomId,
      JSON.stringify({ all: [{ type: "clue_owned", roleSlotId: fx.roleId, clueId: fx.clueId }] }),
      JSON.stringify([{ type: "unlock_scene", sceneId: fx.sceneId }])
    ]
  );

  await query(
    `INSERT INTO clue_ownership (room_id, role_slot_id, clue_id)
     VALUES ($1, $2, $3)`,
    [fx.roomId, fx.roleId, fx.clueId]
  );

  const executed = await evaluateRoomRules(fx.roomId);
  assert.deepEqual(executed, []);

  const pending = await query(
    `SELECT status, rule_id FROM pending_host_events WHERE room_id = $1 AND rule_id = $2`,
    [fx.roomId, rule.rows[0].id]
  );
  assert.equal(pending.rowCount, 1);
  assert.equal(pending.rows[0].status, "pending");

  const sceneUnlock = await query(
    `SELECT 1 FROM room_content_unlocks WHERE room_id = $1 AND content_type = 'scene' AND content_id = $2`,
    [fx.roomId, fx.sceneId]
  );
  assert.equal(sceneUnlock.rowCount, 0);

  const execution = await query(
    `SELECT 1 FROM rule_executions WHERE rule_id = $1 AND room_id = $2`,
    [rule.rows[0].id, fx.roomId]
  );
  assert.equal(execution.rowCount, 0);
});

test("executeActions grants clue and writes timeline", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRuleFixture(suffix);
  context.after(() => deleteFixture(fx.worldId));

  await executeActions(fx.roomId, [
    { type: "grant_clue", roleSlotId: fx.roleId, clueId: fx.clueId, source: "test" },
    { type: "timeline_log", message: "手动动作测试", metadata: { source: "unit-test" } }
  ]);

  const owned = await query(
    `SELECT metadata FROM clue_ownership WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3`,
    [fx.roomId, fx.roleId, fx.clueId]
  );
  assert.equal(owned.rowCount, 1);
  assert.equal(owned.rows[0].metadata.source, "test");

  const logs = await query(
    `SELECT message FROM timeline_logs WHERE room_id = $1 AND event_type = 'rule_action' ORDER BY created_at DESC LIMIT 1`,
    [fx.roomId]
  );
  assert.equal(logs.rows[0].message, "手动动作测试");
});

test("rule with unmet conditions does not execute", async (context) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const fx = await createRuleFixture(suffix);
  context.after(() => deleteFixture(fx.worldId));

  await query(
    `INSERT INTO automation_rules (world_id, room_id, name, mode, enabled, conditions, actions)
     VALUES ($1, $2, '未满足条件', 'automatic', true, $3::jsonb, $4::jsonb)`,
    [
      fx.worldId,
      fx.roomId,
      JSON.stringify({ all: [{ type: "reading_completed", roleSlotId: fx.roleId, scriptSectionId: fx.firstSectionId }] }),
      JSON.stringify([{ type: "unlock_script_section", scriptSectionId: fx.secondSectionId }])
    ]
  );

  const executed = await evaluateRoomRules(fx.roomId);
  assert.deepEqual(executed, []);

  const unlock = await query(
    `SELECT 1 FROM room_content_unlocks WHERE room_id = $1 AND content_type = 'script_section' AND content_id = $2`,
    [fx.roomId, fx.secondSectionId]
  );
  assert.equal(unlock.rowCount, 0);
});

test.after(async () => {
  await pool.end();
});
