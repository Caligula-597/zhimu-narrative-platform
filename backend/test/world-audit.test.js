import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";
const fogWorldId = "11111111-2222-4333-8444-555555550001";
const fogRoomId = "11111111-2222-4333-8444-555555550002";

async function fogRoleId() {
  const result = await query(
    `SELECT rm.role_slot_id FROM room_members rm
     WHERE rm.room_id = $1 AND rm.user_id = $2 AND rm.status = 'active'`,
    [fogRoomId, playerUserId]
  );
  assert.ok(result.rowCount);
  return result.rows[0].role_slot_id;
}

test("GET world host-audit-log rejects viewers", async (context) => {
  const viewer = await query(
    `SELECT u.id FROM users u
     LEFT JOIN world_members wm ON wm.user_id = u.id AND wm.world_id = $1
     WHERE u.id NOT IN ($2, $3) AND (wm.role IS NULL OR wm.role = 'viewer')
     LIMIT 1`,
    [fogWorldId, hostUserId, playerUserId]
  );
  if (!viewer.rowCount) {
    context.skip("no viewer fixture user");
    return;
  }

  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "GET",
    url: `/api/worlds/${fogWorldId}/host-audit-log`,
    headers: { "x-user-id": viewer.rows[0].id }
  });
  assert.equal(response.statusCode, 403);
});

test("GET world host-audit-log aggregates room audit entries", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const roleSlotId = await fogRoleId();
  const clue = await query(
    `SELECT c.id FROM clues c WHERE c.world_id = $1 LIMIT 1`,
    [fogWorldId]
  );
  assert.ok(clue.rowCount);

  const grant = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `world-audit-${Date.now()}` },
    payload: { roleSlotId, clueId: clue.rows[0].id }
  });
  assert.equal(grant.statusCode, 200);

  const audit = await app.inject({
    method: "GET",
    url: `/api/worlds/${fogWorldId}/host-audit-log?limit=10`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(audit.statusCode, 200);
  const { entries } = audit.json();
  assert.ok(Array.isArray(entries));
  const hit = entries.find((row) => row.action === "host_grant_clue" && row.room_id === fogRoomId);
  assert.ok(hit, "world audit should include room-level grant");
  assert.ok(hit.room_name, "room_name should be joined");
});
