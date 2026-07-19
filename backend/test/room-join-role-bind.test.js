import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

test("join rejects switching to a different role once bound", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const host = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: "主持",
      email: `host-bind-${Date.now()}@example.invalid`,
      password: "test-pass-123"
    }
  });
  assert.equal(host.statusCode, 201);
  const hostToken = host.json().token;

  const player = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: "玩家",
      email: `player-bind-${Date.now()}@example.invalid`,
      password: "test-pass-123"
    }
  });
  assert.equal(player.statusCode, 201);
  const playerToken = player.json().token;

  const world = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${hostToken}` },
    payload: { name: "角色绑定测试", summary: "one role per player" }
  });
  const worldId = world.json().id;

  const roles = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, '角色甲', 1), ($1, '角色乙', 2)
     RETURNING id, name`,
    [worldId]
  );
  const roleA = roles.rows[0].id;
  const roleB = roles.rows[1].id;

  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, '绑定测试房', $3, 'testing')
     RETURNING id`,
    [worldId, host.json().user.id, `BIND-${Date.now()}`]
  );
  const inviteCode = (await query(`SELECT invite_code FROM rooms WHERE id = $1`, [room.rows[0].id])).rows[0].invite_code;

  const firstJoin = await app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { authorization: `Bearer ${playerToken}` },
    payload: { inviteCode, roleSlotId: roleA }
  });
  assert.equal(firstJoin.statusCode, 200, firstJoin.body);

  const switchJoin = await app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { authorization: `Bearer ${playerToken}` },
    payload: { inviteCode, roleSlotId: roleB }
  });
  assert.equal(switchJoin.statusCode, 409, switchJoin.body);
  assert.equal(switchJoin.json().code, "ROLE_ALREADY_BOUND");

  const member = await query(
    `SELECT role_slot_id FROM room_members WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
    [room.rows[0].id, player.json().user.id]
  );
  assert.equal(member.rows[0].role_slot_id, roleA);
});

test("join is idempotent for the bound role and invite lookup exposes it", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const host = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: "主持2",
      email: `host-bind2-${Date.now()}@example.invalid`,
      password: "test-pass-123"
    }
  });
  const hostToken = host.json().token;

  const player = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: "玩家2",
      email: `player-bind2-${Date.now()}@example.invalid`,
      password: "test-pass-123"
    }
  });
  const playerToken = player.json().token;

  const world = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${hostToken}` },
    payload: { name: "角色绑定测试2", summary: "idempotent rejoin" }
  });
  const worldId = world.json().id;

  const role = await query(
    `INSERT INTO role_slots (world_id, name, sequence) VALUES ($1, '角色丙', 1) RETURNING id`,
    [worldId]
  );
  const roleId = role.rows[0].id;

  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, '绑定测试房2', $3, 'testing')
     RETURNING id, invite_code`,
    [worldId, host.json().user.id, `BIND2-${Date.now()}`]
  );
  const inviteCode = room.rows[0].invite_code;

  await app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { authorization: `Bearer ${playerToken}` },
    payload: { inviteCode, roleSlotId: roleId }
  });

  const lookup = await app.inject({
    method: "GET",
    url: `/api/rooms/invite/${encodeURIComponent(inviteCode)}`,
    headers: { authorization: `Bearer ${playerToken}` }
  });
  assert.equal(lookup.statusCode, 200, lookup.body);
  assert.equal(lookup.json().current_role_slot_id, roleId);

  const again = await app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { authorization: `Bearer ${playerToken}` },
    payload: { inviteCode, roleSlotId: roleId }
  });
  assert.equal(again.statusCode, 200, again.body);
});

test("concurrent joins cannot bind one player to two roles", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const host = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { displayName: "并发主持", email: `host-race-${suffix}@example.invalid`, password: "test-pass-123" }
  });
  const player = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { displayName: "并发玩家", email: `player-race-${suffix}@example.invalid`, password: "test-pass-123" }
  });
  assert.equal(host.statusCode, 201, host.body);
  assert.equal(player.statusCode, 201, player.body);

  const world = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${host.json().token}` },
    payload: { name: "并发角色绑定", summary: "race regression" }
  });
  assert.equal(world.statusCode, 201, world.body);
  const roles = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, '并发角色甲', 1), ($1, '并发角色乙', 2)
     RETURNING id`,
    [world.json().id]
  );
  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, '并发绑定房间', $3, 'testing')
     RETURNING id, invite_code`,
    [world.json().id, host.json().user.id, `RACE-${suffix}`]
  );
  const authorization = `Bearer ${player.json().token}`;
  const [first, second] = await Promise.all(roles.rows.map((role) => app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { authorization },
    payload: { inviteCode: room.rows[0].invite_code, roleSlotId: role.id }
  })));

  assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 409]);
  const rejected = first.statusCode === 409 ? first : second;
  assert.equal(rejected.json().code, "ROLE_ALREADY_BOUND");
  const membership = await query(
    `SELECT role_slot_id FROM room_members
     WHERE room_id = $1 AND user_id = $2 AND status = 'active'`,
    [room.rows[0].id, player.json().user.id]
  );
  assert.equal(membership.rowCount, 1);
  assert.ok(roles.rows.some((role) => role.id === membership.rows[0].role_slot_id));
});
