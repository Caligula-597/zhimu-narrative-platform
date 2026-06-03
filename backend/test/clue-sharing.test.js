import assert from "node:assert/strict";
import test from "node:test";
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

test("player can share owned clue to room and others can see it", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await fogRoleId();
  const clueId = await fogClueId();

  const grant = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId },
    payload: { roleSlotId, clueId, message: "clue sharing test grant" }
  });
  assert.equal(grant.statusCode, 200);

  const share = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/clues/${clueId}/share-room`,
    headers: { "x-user-id": playerUserId },
    payload: { shared: true }
  });
  assert.equal(share.statusCode, 200);
  assert.equal(share.json().sharedWithRoom, true);

  const note = await app.inject({
    method: "PATCH",
    url: `/api/rooms/${fogRoomId}/clues/${clueId}/player-note`,
    headers: { "x-user-id": playerUserId },
    payload: { note: "这条航运记录说明有人刻意隐瞒。" }
  });
  assert.equal(note.statusCode, 200);

  const home = await app.inject({
    method: "GET",
    url: `/api/rooms/${fogRoomId}/player-home`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(home.statusCode, 200);
  assert.ok(Array.isArray(home.json().clues));
  const owned = home.json().clues.find((item) => item.id === clueId);
  assert.ok(owned, "owned clue should appear in player-home");
  assert.equal(owned.player_note, "这条航运记录说明有人刻意隐瞒。");
  assert.equal(owned.shared_with_room, true);

  const matrix = await app.inject({
    method: "GET",
    url: `/api/rooms/${fogRoomId}/host/clue-matrix`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(matrix.statusCode, 200);
  const cell = matrix.json().cells[clueId][roleSlotId];
  assert.equal(cell.owned, true);
  assert.equal(cell.sharedWithRoom, true);
  assert.ok(matrix.json().summaries.some((item) => item.clueId === clueId));

  const logs = await query(
    `SELECT message FROM timeline_logs
     WHERE room_id = $1 AND event_type = 'clue_shared_room'
     ORDER BY created_at DESC LIMIT 1`,
    [fogRoomId]
  );
  assert.ok(logs.rowCount);
  assert.match(logs.rows[0].message, /公开了线索/);
});

test("host clue matrix endpoint requires host membership", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "GET",
    url: `/api/rooms/${fogRoomId}/host/clue-matrix`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(response.statusCode, 403);
});
