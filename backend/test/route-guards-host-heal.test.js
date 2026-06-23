import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

test("requireRoomRole heals missing host membership for room host_user_id", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const register = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: "主持补全",
      email: `host-heal-${Date.now()}@example.invalid`,
      password: "test-pass-123"
    }
  });
  assert.equal(register.statusCode, 201);
  const { token, user } = register.json();

  const createWorld = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "主持补全测试", summary: "host heal" }
  });
  const worldId = createWorld.json().id;

  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, '缺成员行', $3, 'testing')
     RETURNING id`,
    [worldId, user.id, `HEAL-${Date.now()}`]
  );
  const roomId = room.rows[0].id;

  await query(`DELETE FROM room_members WHERE room_id = $1 AND user_id = $2`, [roomId, user.id]);

  const hostPlayers = await app.inject({
    method: "GET",
    url: `/api/rooms/${roomId}/host/players`,
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(hostPlayers.statusCode, 200, hostPlayers.body);

  const member = await query(
    `SELECT member_type FROM room_members WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
    [roomId, user.id]
  );
  assert.equal(member.rowCount, 1);
  assert.equal(member.rows[0].member_type, "host");
});

test("requireRoomRole heals world owner/editor as host for any room in world", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const ownerReg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: "世界主",
      email: `world-owner-heal-${Date.now()}@example.invalid`,
      password: "test-pass-123"
    }
  });
  assert.equal(ownerReg.statusCode, 201);
  const owner = ownerReg.json();

  const hostReg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: "平行房主持",
      email: `room-host-heal-${Date.now()}@example.invalid`,
      password: "test-pass-123"
    }
  });
  assert.equal(hostReg.statusCode, 201);
  const host = hostReg.json();

  const createWorld = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${owner.token}` },
    payload: { name: "编辑者补全", summary: "editor heal" }
  });
  const worldId = createWorld.json().id;

  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, '他人主持房', $3, 'testing')
     RETURNING id`,
    [worldId, host.user.id, `EDITOR-HEAL-${Date.now()}`]
  );
  const roomId = room.rows[0].id;

  const hostPlayers = await app.inject({
    method: "GET",
    url: `/api/rooms/${roomId}/host/players`,
    headers: { authorization: `Bearer ${owner.token}` }
  });
  assert.equal(hostPlayers.statusCode, 200, hostPlayers.body);

  const member = await query(
    `SELECT member_type FROM room_members WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
    [roomId, owner.user.id]
  );
  assert.equal(member.rowCount, 1);
  assert.equal(member.rows[0].member_type, "host");
});
