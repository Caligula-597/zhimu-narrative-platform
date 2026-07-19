import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureRoomId, playerUserId } from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";

async function createReadableSection(roleSlotId, title) {
  const script = await query(
    `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, $2) RETURNING id`,
    [roleSlotId, title]
  );
  const section = await query(
    `INSERT INTO script_sections
       (character_script_id, role_slot_id, title, body, sequence, publication_status)
     VALUES ($1, $2, $3, '进度一致性测试正文', 1, 'published')
     RETURNING id`,
    [script.rows[0].id, roleSlotId, title]
  );
  return { scriptId: script.rows[0].id, sectionId: section.rows[0].id };
}

test("concurrent section completion emits one log/event and rule failures roll everything back", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await queryFixtureRoleId();
  const room = await query(`SELECT world_id FROM rooms WHERE id = $1`, [fixtureRoomId]);

  const concurrent = await createReadableSection(roleSlotId, `concurrent-complete-${Date.now()}`);
  context.after(() => query(`DELETE FROM character_scripts WHERE id = $1`, [concurrent.scriptId]));

  const completeUrl = `/api/rooms/${fixtureRoomId}/sections/${concurrent.sectionId}/complete`;
  const beforeLog = await query(
    `SELECT COUNT(*)::int AS count
     FROM timeline_logs
     WHERE room_id = $1 AND actor_user_id = $2 AND event_type = 'reading_completed'
       AND metadata->>'sectionId' = $3`,
    [fixtureRoomId, playerUserId, concurrent.sectionId]
  );
  const beforeEvent = await query(
    `SELECT COUNT(*)::int AS count
     FROM event_outbox
     WHERE event_scope = 'room' AND audience_id = $1 AND event_type = 'room.section_completed'
       AND payload->>'sectionId' = $2`,
    [fixtureRoomId, concurrent.sectionId]
  );

  const [first, second] = await Promise.all([
    app.inject({
      method: "POST",
      url: completeUrl,
      headers: { "x-user-id": playerUserId, "idempotency-key": `complete-a-${Date.now()}` }
    }),
    app.inject({
      method: "POST",
      url: completeUrl,
      headers: { "x-user-id": playerUserId, "idempotency-key": `complete-b-${Date.now()}` }
    })
  ]);
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(second.statusCode, 200, second.body);

  const afterLog = await query(
    `SELECT COUNT(*)::int AS count
     FROM timeline_logs
     WHERE room_id = $1 AND actor_user_id = $2 AND event_type = 'reading_completed'
       AND metadata->>'sectionId' = $3`,
    [fixtureRoomId, playerUserId, concurrent.sectionId]
  );
  const afterEvent = await query(
    `SELECT COUNT(*)::int AS count
     FROM event_outbox
     WHERE event_scope = 'room' AND audience_id = $1 AND event_type = 'room.section_completed'
       AND payload->>'sectionId' = $2`,
    [fixtureRoomId, concurrent.sectionId]
  );
  assert.equal(afterLog.rows[0].count - beforeLog.rows[0].count, 1);
  assert.equal(afterEvent.rows[0].count - beforeEvent.rows[0].count, 1);

  const rollback = await createReadableSection(roleSlotId, `rollback-complete-${Date.now()}`);
  context.after(() => query(`DELETE FROM character_scripts WHERE id = $1`, [rollback.scriptId]));
  const invalidRule = await query(
    `INSERT INTO automation_rules
       (world_id, room_id, name, mode, enabled, conditions, actions)
     VALUES ($1, $2, 'rollback-integrity-probe', 'automatic', true, $3::jsonb, $4::jsonb)
     RETURNING id`,
    [
      room.rows[0].world_id,
      fixtureRoomId,
      JSON.stringify({
        all: [{
          type: "reading_completed",
          roleSlotId,
          scriptSectionId: rollback.sectionId
        }]
      }),
      JSON.stringify([{
        type: "grant_clue",
        roleSlotId,
        clueId: randomUUID()
      }])
    ]
  );
  context.after(() => query(`DELETE FROM automation_rules WHERE id = $1`, [invalidRule.rows[0].id]));

  const failed = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/sections/${rollback.sectionId}/complete`,
    headers: {
      "x-user-id": playerUserId,
      "idempotency-key": `complete-rollback-${Date.now()}`
    }
  });
  assert.equal(failed.statusCode, 500, failed.body);

  const rolledBackProgress = await query(
    `SELECT 1 FROM reading_progress
     WHERE room_id = $1 AND role_slot_id = $2 AND script_section_id = $3`,
    [fixtureRoomId, roleSlotId, rollback.sectionId]
  );
  const rolledBackLog = await query(
    `SELECT 1 FROM timeline_logs
     WHERE room_id = $1 AND actor_user_id = $2 AND event_type = 'reading_completed'
       AND metadata->>'sectionId' = $3`,
    [fixtureRoomId, playerUserId, rollback.sectionId]
  );
  const rolledBackEvent = await query(
    `SELECT 1 FROM event_outbox
     WHERE event_scope = 'room' AND audience_id = $1 AND event_type = 'room.section_completed'
       AND payload->>'sectionId' = $2`,
    [fixtureRoomId, rollback.sectionId]
  );
  assert.equal(rolledBackProgress.rowCount, 0);
  assert.equal(rolledBackLog.rowCount, 0);
  assert.equal(rolledBackEvent.rowCount, 0);
});

test("notebook writes enforce source ownership and replay safely", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const key = `notebook-create-${Date.now()}`;
  const payload = {
    sourceType: "manual",
    sourceId: null,
    title: "网络重试笔记",
    body: "只应保存一次"
  };

  const first = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/notebook`,
    headers: { "x-user-id": playerUserId, "idempotency-key": key },
    payload
  });
  assert.equal(first.statusCode, 201, first.body);
  context.after(() => query(`DELETE FROM notebook_entries WHERE id = $1`, [first.json().id]));

  const replay = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/notebook`,
    headers: { "x-user-id": playerUserId, "idempotency-key": key },
    payload
  });
  assert.equal(replay.statusCode, 201, replay.body);
  assert.deepEqual(replay.json(), first.json());

  const stored = await query(`SELECT COUNT(*)::int AS count FROM notebook_entries WHERE id = $1`, [first.json().id]);
  assert.equal(stored.rows[0].count, 1);

  const unsupported = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/notebook`,
    headers: { "x-user-id": playerUserId },
    payload: { ...payload, sourceType: "free" }
  });
  assert.equal(unsupported.statusCode, 400, unsupported.body);

  const forged = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/notebook`,
    headers: { "x-user-id": playerUserId },
    payload: {
      sourceType: "script_section",
      sourceId: randomUUID(),
      title: "伪造来源",
      body: "不应写入"
    }
  });
  assert.equal(forged.statusCode, 404, forged.body);
  assert.equal(forged.json().code, "NOTEBOOK_SOURCE_INVALID");

  const deleteKey = `notebook-delete-${Date.now()}`;
  const deleted = await app.inject({
    method: "DELETE",
    url: `/api/rooms/${fixtureRoomId}/notebook/${first.json().id}`,
    headers: { "x-user-id": playerUserId, "idempotency-key": deleteKey }
  });
  const deleteReplay = await app.inject({
    method: "DELETE",
    url: `/api/rooms/${fixtureRoomId}/notebook/${first.json().id}`,
    headers: { "x-user-id": playerUserId, "idempotency-key": deleteKey }
  });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal(deleteReplay.statusCode, 200, deleteReplay.body);
  assert.deepEqual(deleteReplay.json(), deleted.json());
});
