import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";

async function registerUser(app, label) {
  const suffix = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: label,
      email: `${suffix}@example.invalid`,
      password: "test-pass-123"
    }
  });
  assert.equal(res.statusCode, 201, res.body);
  return { token: res.json().token, userId: res.json().user.id };
}

async function createKickFixture(app, host) {
  const world = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { authorization: `Bearer ${host.token}` },
    payload: { name: `踢人测试 ${Date.now()}`, summary: "host kick player" }
  });
  assert.equal(world.statusCode, 201, world.body);
  const worldId = world.json().id;

  const chapter = await query(
    `INSERT INTO chapters (world_id, title, summary, sequence)
     VALUES ($1, '第一章', '', 1)
     RETURNING id`,
    [worldId]
  );

  const roles = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, '角色甲', 1)
     RETURNING id`,
    [worldId]
  );
  const roleId = roles.rows[0].id;

  const script = await query(
    `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, '测试剧本') RETURNING id`,
    [roleId]
  );
  const section = await query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     VALUES ($1, $2, $3, '第一幕', 'body', 1, 'testing')
     RETURNING id`,
    [script.rows[0].id, roleId, chapter.rows[0].id]
  );

  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, '踢人测试房', $3, 'testing')
     RETURNING id, invite_code`,
    [worldId, host.userId, `KICK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`]
  );

  return {
    worldId,
    roomId: room.rows[0].id,
    inviteCode: room.rows[0].invite_code,
    roleId,
    sectionId: section.rows[0].id
  };
}

async function joinRole(app, token, inviteCode, roleId) {
  return app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { authorization: `Bearer ${token}` },
    payload: { inviteCode, roleSlotId: roleId }
  });
}

async function completedSectionCount(roomId, roleId) {
  const result = await query(
    `SELECT COUNT(*)::int AS n FROM reading_progress
     WHERE room_id = $1 AND role_slot_id = $2 AND completed_at IS NOT NULL`,
    [roomId, roleId]
  );
  return result.rows[0].n;
}

test("host kick frees seat; same account keeps progress, different account clears it", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const host = await registerUser(app, "主持");
  const playerA = await registerUser(app, "玩家A");
  const playerB = await registerUser(app, "玩家B");
  const fx = await createKickFixture(app, host);

  const firstJoin = await joinRole(app, playerA.token, fx.inviteCode, fx.roleId);
  assert.equal(firstJoin.statusCode, 200, firstJoin.body);

  const complete = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/sections/${fx.sectionId}/complete`,
    headers: { authorization: `Bearer ${playerA.token}` }
  });
  assert.equal(complete.statusCode, 200, complete.body);
  assert.equal(await completedSectionCount(fx.roomId, fx.roleId), 1);

  const kick = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/players/${fx.roleId}/kick`,
    headers: { authorization: `Bearer ${host.token}` }
  });
  assert.equal(kick.statusCode, 200, kick.body);
  assert.equal(kick.json().userId, playerA.userId);

  const memberAfterKick = await query(
    `SELECT status, role_slot_id FROM room_members WHERE room_id = $1 AND user_id = $2`,
    [fx.roomId, playerA.userId]
  );
  assert.equal(memberAfterKick.rows[0].status, "removed");
  assert.equal(memberAfterKick.rows[0].role_slot_id, null);
  assert.equal(await completedSectionCount(fx.roomId, fx.roleId), 1, "progress kept after kick");

  const rejoinSame = await joinRole(app, playerA.token, fx.inviteCode, fx.roleId);
  assert.equal(rejoinSame.statusCode, 200, rejoinSame.body);
  assert.equal(await completedSectionCount(fx.roomId, fx.roleId), 1, "same account inherits progress");

  const kickAgain = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/players/${fx.roleId}/kick`,
    headers: { authorization: `Bearer ${host.token}` }
  });
  assert.equal(kickAgain.statusCode, 200, kickAgain.body);

  const joinOther = await joinRole(app, playerB.token, fx.inviteCode, fx.roleId);
  assert.equal(joinOther.statusCode, 200, joinOther.body);
  assert.equal(await completedSectionCount(fx.roomId, fx.roleId), 0, "different account starts fresh");

  const lastOccupant = await query(
    `SELECT variables->>'lastOccupantUserId' AS uid FROM player_states WHERE room_id = $1 AND role_slot_id = $2`,
    [fx.roomId, fx.roleId]
  );
  assert.equal(lastOccupant.rows[0]?.uid, playerB.userId);
});

test("host kick rejects empty seat", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const host = await registerUser(app, "主持2");
  const fx = await createKickFixture(app, host);

  const kick = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/players/${fx.roleId}/kick`,
    headers: { authorization: `Bearer ${host.token}` }
  });
  assert.equal(kick.statusCode, 409, kick.body);
  assert.equal(kick.json().code, "ROLE_SLOT_NOT_OCCUPIED");
});

test("host kick replays one committed removal for the same idempotency key", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const host = await registerUser(app, "幂等主持");
  const player = await registerUser(app, "幂等玩家");
  const fx = await createKickFixture(app, host);
  assert.equal((await joinRole(app, player.token, fx.inviteCode, fx.roleId)).statusCode, 200);
  const key = `kick-replay-${Date.now()}`;
  const send = () => app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/players/${fx.roleId}/kick`,
    headers: { authorization: `Bearer ${host.token}`, "idempotency-key": key }
  });
  const first = await send();
  const second = await send();
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(second.statusCode, 200, second.body);
  assert.deepEqual(second.json(), first.json());

  const [logs, audit, outbox] = await Promise.all([
    query(
      `SELECT 1 FROM timeline_logs
       WHERE room_id = $1 AND event_type = 'player_kicked' AND metadata->>'userId' = $2`,
      [fx.roomId, player.userId]
    ),
    query(
      `SELECT 1 FROM host_audit_log
       WHERE room_id = $1 AND action = 'host_kick_player' AND target_id = $2`,
      [fx.roomId, fx.roleId]
    ),
    query(
      `SELECT 1 FROM event_outbox
       WHERE event_scope = 'room' AND audience_id = $1
         AND event_type = 'room.player_kicked' AND payload->>'userId' = $2`,
      [fx.roomId, player.userId]
    )
  ]);
  assert.equal(logs.rowCount, 1);
  assert.equal(audit.rowCount, 1);
  assert.equal(outbox.rowCount, 1);
});

test("host notes preserve other runtime variables and replay one audit event", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const host = await registerUser(app, "备注主持");
  const fx = await createKickFixture(app, host);
  await query(
    `INSERT INTO player_states (room_id, role_slot_id, variables)
     VALUES ($1, $2, '{"keep":"yes"}'::jsonb)`,
    [fx.roomId, fx.roleId]
  );
  const key = `notes-replay-${Date.now()}`;
  const send = () => app.inject({
    method: "PUT",
    url: `/api/rooms/${fx.roomId}/host/players/${fx.roleId}/notes`,
    headers: { authorization: `Bearer ${host.token}`, "idempotency-key": key },
    payload: { notes: "仅主持可见的跟进备注" }
  });
  const first = await send();
  const second = await send();
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(second.statusCode, 200, second.body);
  assert.deepEqual(second.json(), first.json());

  const state = await query(
    `SELECT variables FROM player_states WHERE room_id = $1 AND role_slot_id = $2`,
    [fx.roomId, fx.roleId]
  );
  assert.equal(state.rows[0].variables.keep, "yes");
  assert.equal(state.rows[0].variables.hostNotes, "仅主持可见的跟进备注");
  const audit = await query(
    `SELECT metadata FROM host_audit_log
     WHERE room_id = $1 AND action = 'host_player_notes_updated' AND target_id = $2`,
    [fx.roomId, fx.roleId]
  );
  assert.equal(audit.rowCount, 1);
  assert.equal(audit.rows[0].metadata.noteLength, "仅主持可见的跟进备注".length);
  assert.equal(Object.hasOwn(audit.rows[0].metadata, "notes"), false);
  const outbox = await query(
    `SELECT payload FROM event_outbox
     WHERE event_scope = 'room' AND audience_id = $1
       AND event_type = 'room.host_player_notes_updated'
       AND payload->>'roleSlotId' = $2`,
    [fx.roomId, fx.roleId]
  );
  assert.equal(outbox.rowCount, 1);
});

test("host notes reject a role from a different world", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const host = await registerUser(app, "跨世界备注主持");
  const roomFixture = await createKickFixture(app, host);
  const foreignFixture = await createKickFixture(app, host);
  const response = await app.inject({
    method: "PUT",
    url: `/api/rooms/${roomFixture.roomId}/host/players/${foreignFixture.roleId}/notes`,
    headers: { authorization: `Bearer ${host.token}` },
    payload: { notes: "不应写入" }
  });
  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, "ROLE_SLOT_WORLD_MISMATCH");
  const state = await query(
    `SELECT 1 FROM player_states WHERE room_id = $1 AND role_slot_id = $2`,
    [roomFixture.roomId, foreignFixture.roleId]
  );
  assert.equal(state.rowCount, 0);
});

test("concurrent kick requests remove a player exactly once", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const host = await registerUser(app, "并发主持");
  const player = await registerUser(app, "并发玩家");
  const fx = await createKickFixture(app, host);
  assert.equal((await joinRole(app, player.token, fx.inviteCode, fx.roleId)).statusCode, 200);
  const send = (key) => app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/players/${fx.roleId}/kick`,
    headers: { authorization: `Bearer ${host.token}`, "idempotency-key": key }
  });
  const responses = await Promise.all([
    send(`kick-race-a-${Date.now()}`),
    send(`kick-race-b-${Date.now()}`)
  ]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 409]);
  const logs = await query(
    `SELECT 1 FROM timeline_logs
     WHERE room_id = $1 AND event_type = 'player_kicked' AND metadata->>'userId' = $2`,
    [fx.roomId, player.userId]
  );
  assert.equal(logs.rowCount, 1);
});

test("kick never removes a cohost even if a corrupt row occupies a role", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const host = await registerUser(app, "保护主持");
  const cohost = await registerUser(app, "保护副主持");
  const fx = await createKickFixture(app, host);
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id)
     VALUES ($1, $2, 'cohost', $3)`,
    [fx.roomId, cohost.userId, fx.roleId]
  );
  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fx.roomId}/host/players/${fx.roleId}/kick`,
    headers: { authorization: `Bearer ${host.token}` }
  });
  assert.equal(response.statusCode, 409, response.body);
  assert.equal(response.json().code, "ROLE_SLOT_NOT_OCCUPIED");
  const membership = await query(
    `SELECT status, member_type, role_slot_id
     FROM room_members WHERE room_id = $1 AND user_id = $2`,
    [fx.roomId, cohost.userId]
  );
  assert.equal(membership.rows[0].status, "active");
  assert.equal(membership.rows[0].member_type, "cohost");
  assert.equal(membership.rows[0].role_slot_id, fx.roleId);
});
