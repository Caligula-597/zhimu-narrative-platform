import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";

const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";
const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";

test("opening a readable section records start without marking it complete", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await queryFixtureRoleId();
  const script = await query(
    `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, $2) RETURNING id`,
    [roleSlotId, `reading-start-${Date.now()}`]
  );
  const section = await query(
    `INSERT INTO script_sections
       (character_script_id, role_slot_id, title, body, sequence, publication_status)
     VALUES ($1, $2, '阅读开始埋点测试', '测试正文', 1, 'published')
     RETURNING id`,
    [script.rows[0].id, roleSlotId]
  );
  context.after(async () => {
    await query(`DELETE FROM character_scripts WHERE id = $1`, [script.rows[0].id]);
  });

  const url = `/api/rooms/${fixtureRoomId}/sections/${section.rows[0].id}/start`;
  const first = await app.inject({
    method: "POST",
    url,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(first.statusCode, 200);
  assert.ok(first.json().startedAt);
  assert.equal(first.json().completedAt, null);

  const second = await app.inject({
    method: "POST",
    url,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(second.statusCode, 200);
  assert.equal(second.json().startedAt, first.json().startedAt, "start tracking must be idempotent");

  const stored = await query(
    `SELECT started_at, completed_at FROM reading_progress
     WHERE room_id = $1 AND role_slot_id = $2 AND script_section_id = $3`,
    [fixtureRoomId, roleSlotId, section.rows[0].id]
  );
  assert.equal(stored.rowCount, 1);
  assert.ok(stored.rows[0].started_at);
  assert.equal(stored.rows[0].completed_at, null);

  const world = await query(`SELECT world_id FROM rooms WHERE id = $1`, [fixtureRoomId]);
  const analytics = await app.inject({
    method: "GET",
    url: `/api/worlds/${world.rows[0].world_id}/creator-analytics`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(analytics.statusCode, 200);
  const payload = analytics.json();
  assert.ok(payload.firstSessionFunnel);
  assert.ok(payload.firstSessionFunnel.startedReading >= 1);
  const trackedSection = payload.sections.find((row) => row.id === section.rows[0].id);
  assert.equal(trackedSection?.started_count, 1);
  assert.equal(trackedSection?.completed_count, 0);
});
