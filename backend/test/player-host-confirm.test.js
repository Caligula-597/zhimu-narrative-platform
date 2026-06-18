import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";

const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";

test("player-home includes hostConfirm status for waiting players", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await queryFixtureRoleId();

  await query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'pending')
     ON CONFLICT DO NOTHING`,
    [
      fixtureRoomId,
      `test:host-confirm:${Date.now()}`,
      "测试待确认",
      "player-home hostConfirm 字段测试",
      JSON.stringify([{ type: "timeline_log", message: "test" }])
    ]
  );

  const response = await app.inject({
    method: "GET",
    url: `/api/rooms/${fixtureRoomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.ok(payload.hostConfirm);
  assert.ok(payload.hostConfirm.pendingCount >= 1);
  assert.equal(typeof payload.hostConfirm.waitingForYou, "boolean");
  assert.ok(Array.isArray(payload.hostConfirm.titles));
});
