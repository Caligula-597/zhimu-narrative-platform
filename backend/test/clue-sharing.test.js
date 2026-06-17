import assert from "node:assert/strict";
import test from "node:test";
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
  if (peer.rowCount) return peer.rows[0].id;

  const world = await query(`SELECT world_id FROM rooms WHERE id = $1`, [fogRoomId]);
  assert.ok(world.rowCount);
  const inserted = await query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
     VALUES ($1, '林夏 · 医生', '内测私享目标角色', '仅用于 clue share 测试', 2)
     ON CONFLICT (world_id, sequence) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [world.rows[0].world_id]
  );
  await query(
    `INSERT INTO player_states (room_id, role_slot_id) VALUES ($1, $2)
     ON CONFLICT (room_id, role_slot_id) DO NOTHING`,
    [fogRoomId, inserted.rows[0].id]
  );
  return inserted.rows[0].id;
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

test("player can share owned clue to specific roles via matrix visibility", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const ownerRoleId = await fogRoleId();
  const clueId = await fogClueId();
  const targetRoleId = await fogPeerRoleSlotId(ownerRoleId);

  const grant = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId },
    payload: { roleSlotId: ownerRoleId, clueId, message: "role share test grant" }
  });
  assert.equal(grant.statusCode, 200);

  const share = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/clues/${clueId}/share-roles`,
    headers: { "x-user-id": playerUserId },
    payload: { roleSlotIds: [targetRoleId] }
  });
  assert.equal(share.statusCode, 200);
  assert.deepEqual(share.json().sharedWithRoles, [targetRoleId]);

  const matrix = await app.inject({
    method: "GET",
    url: `/api/rooms/${fogRoomId}/host/clue-matrix`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(matrix.statusCode, 200);
  const targetCell = matrix.json().cells[clueId][targetRoleId];
  assert.equal(targetCell.visible, true);
  assert.equal(targetCell.sharedWithRoles, true);
  assert.equal(targetCell.owned, false);

  const ownerCell = matrix.json().cells[clueId][ownerRoleId];
  assert.equal(ownerCell.owned, true);
});

test("host can delay pending event and wake when due", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const inserted = await query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status)
     VALUES ($1, $2, '延迟测试', '测试延迟调度', '[]'::jsonb, 'pending')
     RETURNING id`,
    [fogRoomId, `delay-test-${Date.now()}`]
  );
  const eventId = inserted.rows[0].id;

  const delay = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/host-events/${eventId}/delay`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `delay-${Date.now()}` },
    payload: { delayMinutes: 30 }
  });
  assert.equal(delay.statusCode, 200);
  assert.equal(delay.json().ok, true);

  const delayedRow = await query(`SELECT status, delay_until FROM pending_host_events WHERE id = $1`, [eventId]);
  assert.equal(delayedRow.rows[0].status, "delayed");
  assert.ok(delayedRow.rows[0].delay_until);

  await query(`UPDATE pending_host_events SET delay_until = now() - interval '1 minute' WHERE id = $1`, [eventId]);

  const list = await app.inject({
    method: "GET",
    url: `/api/rooms/${fogRoomId}/host-events`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(list.statusCode, 200);
  const restored = list.json().find((item) => item.id === eventId);
  assert.ok(restored, "event should return to pending list after wake");
  assert.equal(restored.status, "pending");

  const audit = await query(
    `SELECT action, metadata FROM host_audit_log
     WHERE room_id = $1 AND action = 'host_event_delayed' AND target_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [fogRoomId, String(eventId)]
  );
  assert.ok(audit.rowCount, "delay should write host_audit_log");
  assert.equal(audit.rows[0].metadata.delayMinutes, 30);
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
