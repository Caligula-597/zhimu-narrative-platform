import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

async function registerUser(app, label) {
  const suffix = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${suffix}@example.invalid`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: label,
      email,
      password: "test-pass-123"
    }
  });
  assert.equal(res.statusCode, 201, res.body);
  return { token: res.json().token, userId: res.json().user.id, email };
}

async function createCohostFixture(app, host) {
  const world = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${host.token}` },
    payload: { name: `双主持测试 ${Date.now()}`, summary: "host cohost" }
  });
  assert.equal(world.statusCode, 201, world.body);
  const worldId = world.json().id;

  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, '双主持测试房', $3, 'testing')
     RETURNING id, invite_code`,
    [worldId, host.userId, `COHOST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`]
  );

  return {
    worldId,
    roomId: room.rows[0].id,
    inviteCode: room.rows[0].invite_code
  };
}

test("primary host can appoint and remove a cohost by email", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const host = await registerUser(app, "主主持");
  const partner = await registerUser(app, "协主持候选人");
  const fx = await createCohostFixture(app, host);

  const appoint = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/cohosts`,
    headers: { authorization: `Bearer ${host.token}` },
    payload: { email: partner.email }
  });
  assert.equal(appoint.statusCode, 200, appoint.body);
  assert.equal(appoint.json().cohost.userId, partner.userId);

  const membership = await query(
    `SELECT member_type, status, role_slot_id
     FROM room_members WHERE room_id = $1 AND user_id = $2`,
    [fx.roomId, partner.userId]
  );
  assert.equal(membership.rows[0].member_type, "cohost");
  assert.equal(membership.rows[0].status, "active");
  assert.equal(membership.rows[0].role_slot_id, null);

  const listed = await app.inject({
    method: "GET",
    url: `/api/rooms/${fx.roomId}/host/cohosts`,
    headers: { authorization: `Bearer ${host.token}` }
  });
  assert.equal(listed.statusCode, 200, listed.body);
  assert.equal(listed.json().canManage, true);
  assert.equal(listed.json().cohosts.length, 1);
  assert.equal(listed.json().cohosts[0].userId, partner.userId);

  const outbox = await query(
    `SELECT payload FROM event_outbox
     WHERE event_scope = 'room' AND audience_id = $1
       AND event_type = 'room.cohost_updated'
       AND payload->>'action' = 'appointed'
       AND payload->>'userId' = $2`,
    [fx.roomId, partner.userId]
  );
  assert.equal(outbox.rowCount, 1);

  const remove = await app.inject({
    method: "DELETE",
    url: `/api/rooms/${fx.roomId}/host/cohosts/${partner.userId}`,
    headers: { authorization: `Bearer ${host.token}` }
  });
  assert.equal(remove.statusCode, 200, remove.body);

  const after = await query(
    `SELECT member_type, status FROM room_members WHERE room_id = $1 AND user_id = $2`,
    [fx.roomId, partner.userId]
  );
  assert.equal(after.rows[0].member_type, "player");
  assert.equal(after.rows[0].status, "removed");
});

test("appoint rejects primary host, duplicates, and non-primary actors", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const host = await registerUser(app, "主主持拒");
  const cohost = await registerUser(app, "已任命协主持");
  const stranger = await registerUser(app, "路人");
  const fx = await createCohostFixture(app, host);

  const selfAppoint = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/cohosts`,
    headers: { authorization: `Bearer ${host.token}` },
    payload: { userId: host.userId }
  });
  assert.equal(selfAppoint.statusCode, 400, selfAppoint.body);
  assert.equal(selfAppoint.json().code, "COHOST_TARGET_INVALID");

  const first = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/cohosts`,
    headers: { authorization: `Bearer ${host.token}` },
    payload: { userId: cohost.userId }
  });
  assert.equal(first.statusCode, 200, first.body);

  const duplicate = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/cohosts`,
    headers: { authorization: `Bearer ${host.token}` },
    payload: { userId: cohost.userId }
  });
  assert.equal(duplicate.statusCode, 409, duplicate.body);
  assert.equal(duplicate.json().code, "COHOST_ALREADY_ASSIGNED");

  const cohostAppoint = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/cohosts`,
    headers: { authorization: `Bearer ${cohost.token}` },
    payload: { userId: stranger.userId }
  });
  assert.equal(cohostAppoint.statusCode, 403, cohostAppoint.body);
  assert.equal(cohostAppoint.json().code, "COHOST_PRIMARY_REQUIRED");

  const strangerAppoint = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/cohosts`,
    headers: { authorization: `Bearer ${stranger.token}` },
    payload: { email: cohost.email }
  });
  assert.equal(strangerAppoint.statusCode, 403, strangerAppoint.body);
  assert.equal(strangerAppoint.json().code, "COHOST_PRIMARY_REQUIRED");
});

test("remove missing cohost returns COHOST_NOT_FOUND; appoint clears player seat", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const host = await registerUser(app, "主主持清座");
  const player = await registerUser(app, "玩家升协主持");
  const fx = await createCohostFixture(app, host);

  const missing = await app.inject({
    method: "DELETE",
    url: `/api/rooms/${fx.roomId}/host/cohosts/${player.userId}`,
    headers: { authorization: `Bearer ${host.token}` }
  });
  assert.equal(missing.statusCode, 404, missing.body);
  assert.equal(missing.json().code, "COHOST_NOT_FOUND");

  const role = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, '角色甲', 1)
     RETURNING id`,
    [fx.worldId]
  );
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id, status)
     VALUES ($1, $2, 'player', $3, 'active')`,
    [fx.roomId, player.userId, role.rows[0].id]
  );

  const appoint = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/cohosts`,
    headers: { authorization: `Bearer ${host.token}` },
    payload: { userId: player.userId }
  });
  assert.equal(appoint.statusCode, 200, appoint.body);

  const membership = await query(
    `SELECT member_type, status, role_slot_id
     FROM room_members WHERE room_id = $1 AND user_id = $2`,
    [fx.roomId, player.userId]
  );
  assert.equal(membership.rows[0].member_type, "cohost");
  assert.equal(membership.rows[0].status, "active");
  assert.equal(membership.rows[0].role_slot_id, null);
});
