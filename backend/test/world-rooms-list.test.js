import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

test("world rooms list counts joined players with roles, not host membership", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const register = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: "房间统计",
      email: `room-count-${Date.now()}@example.invalid`,
      password: "test-pass-123"
    }
  });
  assert.equal(register.statusCode, 201);
  const { token, user } = register.json();

  const createWorld = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "统计测试剧本", summary: "member_count" }
  });
  assert.equal(createWorld.statusCode, 201);
  const worldId = createWorld.json().id;

  const role = await query(
    `INSERT INTO role_slots (world_id, name, sequence, public_profile)
     VALUES ($1, '角色A', 1, '公开')
     RETURNING id`,
    [worldId]
  );
  const roleSlotId = role.rows[0].id;

  const callerInviteCode = `CNT-${Date.now()}`;
  const createRoom = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/rooms`,
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "测试房", inviteCode: callerInviteCode }
  });
  assert.equal(createRoom.statusCode, 201);
  assert.notEqual(createRoom.json().invite_code, callerInviteCode);
  assert.match(createRoom.json().invite_code, /^ROOM-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/);
  const roomId = createRoom.json().id;

  const guest = await app.inject({
    method: "POST",
    url: "/api/auth/guest",
    payload: { displayName: "玩家一" }
  });
  assert.equal(guest.statusCode, 201);
  const guestToken = guest.json().token;

  const join = await app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { authorization: `Bearer ${guestToken}` },
    payload: { inviteCode: createRoom.json().invite_code, roleSlotId }
  });
  assert.equal(join.statusCode, 200, join.body);

  const list = await app.inject({
    method: "GET",
    url: `/api/worlds/${worldId}/rooms`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(list.statusCode, 200);
  const row = list.json().find((item) => item.id === roomId);
  assert.ok(row, "room listed");
  assert.equal(row.member_count, 1, "host row without role_slot_id must not inflate player count");
  assert.equal(row.role_slot_count, 1);

  const members = await query(
    `SELECT COUNT(*)::int AS n FROM room_members WHERE room_id = $1 AND status = 'active'`,
    [roomId]
  );
  assert.equal(members.rows[0].n, 2, "host + one player in room_members");

  await query(`DELETE FROM room_members WHERE room_id = $1 AND user_id = $2`, [roomId, user.id]);
});
