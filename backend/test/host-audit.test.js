import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";
const fogRoomId = "11111111-2222-4333-8444-555555550002";

async function fogRoleId() {
  const result = await query(
    `SELECT rm.role_slot_id FROM room_members rm
     WHERE rm.room_id = $1 AND rm.user_id = $2 AND rm.status = 'active'`,
    [fogRoomId, playerUserId]
  );
  assert.ok(result.rowCount, "fog player fixture is required");
  return result.rows[0].role_slot_id;
}

test("GET host audit-log rejects players without host membership", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: `/api/rooms/${fogRoomId}/host/audit-log`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().code, "HOST_ROLE_REQUIRED");
});

test("GET host audit-log rejects unknown room", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "GET",
    url: `/api/rooms/${randomUUID()}/host/audit-log`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 403);
});

test("GET host audit-log clamps limit query between 1 and 200", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  for (const limit of ["0", "999"]) {
    const response = await app.inject({
      method: "GET",
      url: `/api/rooms/${fogRoomId}/host/audit-log?limit=${limit}`,
      headers: { "x-user-id": hostUserId }
    });
    assert.equal(response.statusCode, 200, `limit=${limit} should succeed`);
    assert.ok(Array.isArray(response.json().entries));
  }
});

test("GET host audit-log returns newest entries first with actor metadata", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const roleSlotId = await fogRoleId();
  const clue = await query(
    `SELECT c.id FROM clues c
     JOIN rooms r ON r.world_id = c.world_id
     WHERE r.id = $1 LIMIT 1`,
    [fogRoomId]
  );
  assert.ok(clue.rowCount);

  const grant = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `audit-shape-${Date.now()}` },
    payload: { roleSlotId, clueId: clue.rows[0].id }
  });
  assert.equal(grant.statusCode, 200);

  const audit = await app.inject({
    method: "GET",
    url: `/api/rooms/${fogRoomId}/host/audit-log?limit=5`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(audit.statusCode, 200);
  const { entries } = audit.json();
  assert.ok(entries.length >= 1);

  const hit = entries.find((row) => row.action === "host_grant_clue");
  assert.ok(hit, "grant should appear in audit log");
  for (const key of ["id", "action", "metadata", "created_at"]) {
    assert.ok(Object.hasOwn(hit, key), `entry missing ${key}`);
  }
  assert.ok(hit.actor_name, "actor_name should be populated from users join");

  for (let i = 1; i < entries.length; i += 1) {
    const prev = new Date(entries[i - 1].created_at).getTime();
    const cur = new Date(entries[i].created_at).getTime();
    assert.ok(prev >= cur, "entries should be ordered newest first");
  }
});
