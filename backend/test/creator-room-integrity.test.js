import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { addCreatorRoom } from "../src/creator-room-service.js";
import { getDatabaseStatus } from "../src/database-status.js";
import { query } from "../src/db.js";
import { fixtureWorldId, hostUserId } from "./helpers/fixture-ids.js";

function roomUrl(suffix = "") {
  return `/api/worlds/${fixtureWorldId}/rooms${suffix}`;
}

test("concurrent create-room retries replay one atomic room without leaking idempotency metadata", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const key = `creator-room-${Date.now()}`;
  const payload = { name: ` idempotent-room-${Date.now()} `, publicListing: true };
  const inject = () => app.inject({
    method: "POST",
    url: roomUrl(),
    headers: { "x-user-id": hostUserId, "idempotency-key": key },
    payload
  });

  const [first, second] = await Promise.all([inject(), inject()]);
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(second.statusCode, 201, second.body);
  const firstRoom = first.json();
  const secondRoom = second.json();
  assert.equal(secondRoom.id, firstRoom.id);
  assert.equal(firstRoom.name, payload.name.trim());
  assert.equal("creation_idempotency_key" in firstRoom, false);
  assert.equal("creation_request_hash" in firstRoom, false);
  context.after(() => query(`DELETE FROM rooms WHERE id = $1`, [firstRoom.id]));

  const stored = await query(
    `SELECT room.id,
            (SELECT COUNT(*)::int FROM room_members member WHERE member.room_id = room.id) AS members,
            (SELECT COUNT(*)::int FROM voice_rooms voice WHERE voice.room_id = room.id) AS voice_rooms
     FROM rooms room
     WHERE room.world_id = $1
       AND room.host_user_id = $2
       AND room.creation_idempotency_key = $3`,
    [fixtureWorldId, hostUserId, key]
  );
  assert.equal(stored.rowCount, 1);
  assert.equal(stored.rows[0].members, 1);
  assert.equal(stored.rows[0].voice_rooms, 1);

  const mismatched = await app.inject({
    method: "POST",
    url: roomUrl(),
    headers: { "x-user-id": hostUserId, "idempotency-key": key },
    payload: { ...payload, name: `${payload.name}-different` }
  });
  assert.equal(mismatched.statusCode, 409, mismatched.body);
  assert.equal(mismatched.json().code, "IDEMPOTENCY_PAYLOAD_MISMATCH");
});

test("room creation trims names, rejects whitespace, and retries a global invite collision", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const invalid = await app.inject({
    method: "POST",
    url: roomUrl(),
    headers: { "x-user-id": hostUserId },
    payload: { name: "   " }
  });
  assert.equal(invalid.statusCode, 400, invalid.body);

  const collisionCode = `ROOM-COLLISION-${Date.now()}`;
  const existing = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, 'invite collision fixture', $3, 'testing')
     RETURNING id`,
    [fixtureWorldId, hostUserId, collisionCode]
  );
  context.after(() => query(`DELETE FROM rooms WHERE id = $1`, [existing.rows[0].id]));
  const codes = [collisionCode, `ROOM-RECOVERED-${Date.now()}`];
  const created = await addCreatorRoom({
    request: { headers: {} },
    actorId: hostUserId,
    worldId: fixtureWorldId,
    body: { name: "  collision recovered  " },
    inviteCodeFactory: () => codes.shift()
  });
  context.after(() => query(`DELETE FROM rooms WHERE id = $1`, [created.id]));
  assert.equal(created.name, "collision recovered");
  assert.match(created.invite_code, /^ROOM-RECOVERED-/);
});

test("world hosts cannot publish another host's room unless they are an active cohost", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: "Room Host Boundary",
      email: `room-host-boundary-${suffix}@example.invalid`,
      password: "test-pass-123"
    }
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const { token, user } = registered.json();
  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
     VALUES ($1, $2, $3, $4, 'testing') RETURNING id`,
    [fixtureWorldId, hostUserId, `listing-boundary-${suffix}`, `LIST-${suffix}`]
  );
  context.after(async () => {
    await query(`DELETE FROM rooms WHERE id = $1`, [room.rows[0].id]);
    await query(`DELETE FROM users WHERE id = $1`, [user.id]);
  });
  await query(
    `INSERT INTO world_members (world_id, user_id, role)
     VALUES ($1, $2, 'host')`,
    [fixtureWorldId, user.id]
  );

  const forbidden = await app.inject({
    method: "PATCH",
    url: roomUrl(`/${room.rows[0].id}/listing`),
    headers: { authorization: `Bearer ${token}` },
    payload: { publicListing: true }
  });
  assert.equal(forbidden.statusCode, 403, forbidden.body);
  assert.equal(forbidden.json().code, "ROOM_LISTING_FORBIDDEN");

  await query(
    `INSERT INTO room_members (room_id, user_id, member_type)
     VALUES ($1, $2, 'cohost')`,
    [room.rows[0].id, user.id]
  );
  const allowed = await app.inject({
    method: "PATCH",
    url: roomUrl(`/${room.rows[0].id}/listing`),
    headers: { authorization: `Bearer ${token}` },
    payload: { publicListing: true }
  });
  assert.equal(allowed.statusCode, 200, allowed.body);
  assert.equal(allowed.json().public_listing, true);
});

test("revoked world members cannot replay a previously authorized room creation", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      displayName: "Revoked Room Host",
      email: `revoked-room-host-${suffix}@example.invalid`,
      password: "test-pass-123"
    }
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const { token, user } = registered.json();
  let createdRoomId = null;
  context.after(async () => {
    if (createdRoomId) await query(`DELETE FROM rooms WHERE id = $1`, [createdRoomId]);
    await query(`DELETE FROM users WHERE id = $1`, [user.id]);
  });
  await query(
    `INSERT INTO world_members (world_id, user_id, role)
     VALUES ($1, $2, 'host')`,
    [fixtureWorldId, user.id]
  );
  const key = `revoked-room-${suffix}`;
  const payload = { name: `revoked-room-${suffix}` };
  const first = await app.inject({
    method: "POST",
    url: roomUrl(),
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload
  });
  assert.equal(first.statusCode, 201, first.body);
  createdRoomId = first.json().id;

  await query(
    `DELETE FROM world_members WHERE world_id = $1 AND user_id = $2`,
    [fixtureWorldId, user.id]
  );
  const replay = await app.inject({
    method: "POST",
    url: roomUrl(),
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload
  });
  assert.equal(replay.statusCode, 403, replay.body);
  assert.equal(replay.json().code, "WORLD_ACCESS_DENIED");
});

test("creator-room query indexes are installed", async () => {
  const indexes = await query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = ANY($1::text[])`,
    [["idx_rooms_creation_idempotency", "idx_rooms_world_created"]]
  );
  assert.equal(indexes.rowCount, 2);
  assert.ok(indexes.rows.some((row) => /UNIQUE INDEX.*world_id, host_user_id, creation_idempotency_key/i.test(row.indexdef)));
  assert.ok(indexes.rows.some((row) => /world_id, created_at DESC/i.test(row.indexdef)));
  const status = await getDatabaseStatus();
  assert.equal(status.ok, true);
  assert.deepEqual(status.missingMigrations, []);
  assert.ok(status.latestMigration >= "086_rooms_world_created_index.sql");
});
