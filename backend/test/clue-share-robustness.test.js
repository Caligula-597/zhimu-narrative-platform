import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";
const fogRoomId = "a65f94eb-a987-463c-bb81-aa482367e54a";

async function fogRoleId() {
  const result = await query(
    `SELECT rm.role_slot_id FROM room_members rm
     WHERE rm.room_id = $1 AND rm.user_id = $2 AND rm.status = 'active'`,
    [fogRoomId, playerUserId]
  );
  assert.ok(result.rowCount);
  return result.rows[0].role_slot_id;
}

async function fogClueId() {
  const result = await query(
    `SELECT c.id FROM clues c
     JOIN rooms r ON r.world_id = c.world_id
     WHERE r.id = $1 LIMIT 1`,
    [fogRoomId]
  );
  assert.ok(result.rowCount);
  return result.rows[0].id;
}

async function fogPeerRoleSlotId(ownerRoleId) {
  const peer = await query(
    `SELECT rs.id FROM role_slots rs
     JOIN rooms r ON r.world_id = rs.world_id
     WHERE r.id = $1 AND rs.id <> $2
     ORDER BY rs.sequence LIMIT 1`,
    [fogRoomId, ownerRoleId]
  );
  assert.ok(peer.rowCount, "peer role fixture required");
  return peer.rows[0].id;
}

test("share-roles rejects clue the player does not own", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const ownerRoleId = await fogRoleId();
  const clueId = await fogClueId();
  const targetRoleId = await fogPeerRoleSlotId(ownerRoleId);

  await query(
    `DELETE FROM clue_ownership WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3`,
    [fogRoomId, ownerRoleId, clueId]
  );

  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/clues/${clueId}/share-roles`,
    headers: { "x-user-id": playerUserId, "idempotency-key": `share-not-owned-${Date.now()}` },
    payload: { roleSlotIds: [targetRoleId] }
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "CLUE_NOT_OWNED");
});

test("share-roles rejects invalid roleSlotIds payload", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const clueId = await fogClueId();
  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/clues/${clueId}/share-roles`,
    headers: { "x-user-id": playerUserId, "idempotency-key": `share-bad-payload-${Date.now()}` },
    payload: { roleSlotIds: ["not-a-uuid"] }
  });
  assert.equal(response.statusCode, 400);
});

test("share-roles rejects role slots from another world", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const ownerRoleId = await fogRoleId();
  const clueId = await fogClueId();

  const grant = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `share-world-mismatch-${Date.now()}` },
    payload: { roleSlotId: ownerRoleId, clueId }
  });
  assert.equal(grant.statusCode, 200);

  const foreignRole = await query(
    `SELECT rs.id FROM role_slots rs
     JOIN worlds w ON w.id = rs.world_id
     WHERE w.id <> (SELECT world_id FROM rooms WHERE id = $1)
     LIMIT 1`,
    [fogRoomId]
  );
  if (!foreignRole.rowCount) {
    context.skip("no foreign world role fixture for mismatch test");
    return;
  }

  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/clues/${clueId}/share-roles`,
    headers: { "x-user-id": playerUserId, "idempotency-key": `share-mismatch-${Date.now()}` },
    payload: { roleSlotIds: [foreignRole.rows[0].id] }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "ROLE_SLOT_WORLD_MISMATCH");
});

test("share-roles clears private share when roleSlotIds is empty", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const ownerRoleId = await fogRoleId();
  const clueId = await fogClueId();
  const targetRoleId = await fogPeerRoleSlotId(ownerRoleId);

  await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `share-clear-grant-${Date.now()}` },
    payload: { roleSlotId: ownerRoleId, clueId }
  });

  const share = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/clues/${clueId}/share-roles`,
    headers: { "x-user-id": playerUserId, "idempotency-key": `share-clear-set-${Date.now()}` },
    payload: { roleSlotIds: [targetRoleId] }
  });
  assert.equal(share.statusCode, 200);
  assert.deepEqual(share.json().sharedWithRoles, [targetRoleId]);

  const clear = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/clues/${clueId}/share-roles`,
    headers: { "x-user-id": playerUserId, "idempotency-key": `share-clear-empty-${Date.now()}` },
    payload: { roleSlotIds: [] }
  });
  assert.equal(clear.statusCode, 200);
  assert.deepEqual(clear.json().sharedWithRoles, []);
});

test("share-roles rejects unknown clue id", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/clues/${randomUUID()}/share-roles`,
    headers: { "x-user-id": playerUserId, "idempotency-key": `share-missing-clue-${Date.now()}` },
    payload: { roleSlotIds: [] }
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "CLUE_NOT_FOUND");
});
