import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";
const fogRoomId = "a65f94eb-a987-463c-bb81-aa482367e54a";

test("GET and PATCH world settings for editors", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const world = await query(
    `SELECT w.id FROM worlds w
     JOIN world_members wm ON wm.world_id = w.id
     WHERE wm.user_id = $1 LIMIT 1`,
    [hostUserId]
  );
  assert.ok(world.rowCount);
  const worldId = world.rows[0].id;

  const detail = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().id, worldId);

  const patch = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": hostUserId },
    payload: { summary: "updated-by-test", settings: { demoFlag: true } }
  });
  assert.equal(patch.statusCode, 200);
  assert.equal(patch.json().summary, "updated-by-test");
  assert.equal(patch.json().settings.demoFlag, true);

  const forbidden = await app.inject({
    method: "PATCH",
    url: `/api/worlds/${worldId}`,
    headers: { "x-user-id": playerUserId },
    payload: { name: "should fail" }
  });
  assert.equal(forbidden.statusCode, 403);
});

test("host can patch room runtime settings", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const before = await query(`SELECT settings FROM rooms WHERE id = $1`, [fogRoomId]);
  const priorSettings = before.rows[0]?.settings ?? {};
  context.after(async () => {
    await query(`UPDATE rooms SET settings = $2::jsonb WHERE id = $1`, [fogRoomId, JSON.stringify(priorSettings)]);
  });

  const patch = await app.inject({
    method: "PATCH",
    url: `/api/rooms/${fogRoomId}/settings`,
    headers: { "x-user-id": hostUserId },
    payload: { settings: { hostVoiceListen: true } }
  });
  assert.equal(patch.statusCode, 200);
  assert.equal(patch.json().settings.hostVoiceListen, true);

  const audit = await query(
    `SELECT 1 FROM host_audit_log WHERE room_id = $1 AND action = 'room_settings_updated'`,
    [fogRoomId]
  );
  assert.ok(audit.rowCount >= 1);
});