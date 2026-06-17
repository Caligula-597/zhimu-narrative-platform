import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { fixtureWorldName } from "./helpers/fixture-ids.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";
const fogRoomId = "11111111-2222-4333-8444-555555550002";

async function fogRoleId() {
  const result = await query(
    `SELECT rm.role_slot_id
     FROM room_members rm
     WHERE rm.room_id = $1 AND rm.user_id = $2 AND rm.status = 'active'`,
    [fogRoomId, playerUserId]
  );
  assert.ok(result.rowCount, "fog player fixture is required");
  return result.rows[0].role_slot_id;
}

test("invite code lookup returns room roles without exposing other runtime state", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "GET",
    url: "/api/rooms/invite/TEST-FIXTURE-DEMO",
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.world.name, fixtureWorldName);
  assert.ok(payload.roles.length >= 1);
  assert.ok(Object.hasOwn(payload.roles[0], "occupied"));
});

test("join rejects a role that does not belong to the invited room world", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { "x-user-id": playerUserId },
    payload: {
      inviteCode: "TEST-FIXTURE-DEMO",
      roleSlotId: "00000000-0000-4000-8000-000000000000"
    }
  });
  assert.equal(response.statusCode, 400);
});

test("runtime schemas reject malformed join payloads before route logic", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { "x-user-id": playerUserId },
    payload: { inviteCode: "TEST-FIXTURE-DEMO" }
  });
  assert.equal(response.statusCode, 400);
});

test("player cannot read host progress for a running room", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "GET",
    url: `/api/rooms/${fogRoomId}/host-progress`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().code, "HOST_ROLE_REQUIRED");
  assert.match(response.json().error, /主持人/);
});

test("private voice rooms are isolated from active room members who were not invited", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const room = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/voice-rooms`,
    headers: { "x-user-id": playerUserId },
    payload: { name: `权限隔离测试 ${Date.now()}`, roomType: "invite_private", inviteUserIds: [] }
  });
  assert.equal(room.statusCode, 201);
  const response = await app.inject({
    method: "GET",
    url: `/api/voice-rooms/${room.json().id}/messages`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, "Voice room membership required");
});

test("player can complete only their own readable script section", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const roleSlotId = await fogRoleId();
  const section = await query(
    `SELECT ss.id
     FROM script_sections ss
     WHERE ss.role_slot_id = $1
     ORDER BY ss.sequence
     LIMIT 1`,
    [roleSlotId]
  );
  assert.ok(section.rowCount, "fog section fixture is required");
  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fogRoomId}/sections/${section.rows[0].id}/complete`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().ok, true);
});

test("player cannot complete another role's private script section", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name, summary, status)
     VALUES ($1, $2, 'permission fixture', 'testing')
     RETURNING id`,
    [hostUserId, `权限测试 ${suffix}`]
  );
  context.after(async () => {
    await query(`DELETE FROM rooms WHERE world_id = $1`, [world.rows[0].id]);
    await query(`DELETE FROM worlds WHERE id = $1`, [world.rows[0].id]);
  });
  const chapter = await query(
    `INSERT INTO chapters (world_id, title, summary, sequence)
     VALUES ($1, '测试章', '', 1)
     RETURNING id`,
    [world.rows[0].id]
  );
  const ownRole = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, '自己的角色', 1)
     RETURNING id`,
    [world.rows[0].id]
  );
  const otherRole = await query(
    `INSERT INTO role_slots (world_id, name, sequence)
     VALUES ($1, '他人的角色', 2)
     RETURNING id`,
    [world.rows[0].id]
  );
  const ownScript = await query(`INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, '自己的剧本') RETURNING id`, [ownRole.rows[0].id]);
  const otherScript = await query(`INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, '他人的剧本') RETURNING id`, [otherRole.rows[0].id]);
  await query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     VALUES ($1, $2, $3, '自己的第一段', 'own body', 1, 'testing')`,
    [ownScript.rows[0].id, ownRole.rows[0].id, chapter.rows[0].id]
  );
  const otherSection = await query(
    `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
     VALUES ($1, $2, $3, '他人的第一段', 'other body', 1, 'testing')
     RETURNING id`,
    [otherScript.rows[0].id, otherRole.rows[0].id, chapter.rows[0].id]
  );
  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, $3, $4, 'testing')
     RETURNING id`,
    [world.rows[0].id, hostUserId, `权限测试房 ${suffix}`, `PERM-${suffix}`]
  );
  await query(
    `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id)
     VALUES ($1, $2, 'player', $3)`,
    [room.rows[0].id, playerUserId, ownRole.rows[0].id]
  );
  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${room.rows[0].id}/sections/${otherSection.rows[0].id}/complete`,
    headers: { "x-user-id": playerUserId }
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error, "Script section is locked or unavailable");
});