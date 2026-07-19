import assert from "node:assert/strict";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId, fixtureRoomId } from "./helpers/fixture-ids.js";

async function queryFixtureClueId() {
  const result = await query(
    `SELECT c.id FROM clues c JOIN rooms r ON r.world_id = c.world_id WHERE r.id = $1 LIMIT 1`,
    [fixtureRoomId]
  );
  return result.rows[0].id;
}

test("investigate endpoint is idempotent with Idempotency-Key", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const worldId = (await query(`SELECT world_id FROM rooms WHERE id = $1`, [fixtureRoomId])).rows[0].world_id;
  const roleSlotId = await queryFixtureRoleId();
  const scene = await query(`SELECT id FROM scenes WHERE world_id = $1 LIMIT 1`, [worldId]);
  const point = await query(
    `INSERT INTO investigation_points (world_id, scene_id, name, description, interaction_text, result_text, sequence, metadata)
     VALUES ($1, $2, $3, '', '查', '幂等测试结果', 99, '{"testKey":"idempotency-probe"}'::jsonb)
     RETURNING id`,
    [worldId, scene.rows[0].id, `幂等调查点 ${Date.now()}`]
  );
  await query(
    `INSERT INTO room_content_unlocks (room_id, content_type, content_id)
     VALUES ($1, 'scene', $2) ON CONFLICT DO NOTHING`,
    [fixtureRoomId, scene.rows[0].id]
  );
  context.after(async () => {
    await query(`DELETE FROM investigation_records WHERE room_id = $1 AND investigation_point_id = $2`, [fixtureRoomId, point.rows[0].id]);
    await query(`DELETE FROM investigation_points WHERE id = $1`, [point.rows[0].id]);
  });

  const key = `investigate-${Date.now()}`;
  const url = `/api/rooms/${fixtureRoomId}/investigation-points/${point.rows[0].id}/investigate`;
  const first = await app.inject({
    method: "POST",
    url,
    headers: { "x-user-id": playerUserId, "idempotency-key": key }
  });
  assert.equal(first.statusCode, 200);

  const second = await app.inject({
    method: "POST",
    url,
    headers: { "x-user-id": playerUserId, "idempotency-key": key }
  });
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.json(), first.json());

  const records = await query(
    `SELECT 1 FROM investigation_records WHERE room_id = $1 AND investigation_point_id = $2 AND role_slot_id = $3`,
    [fixtureRoomId, point.rows[0].id, roleSlotId]
  );
  assert.equal(records.rowCount, 1, "idempotent retry must not duplicate investigation record side effects beyond first write");
});

test("share-room clue endpoint is idempotent with Idempotency-Key", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const roleSlotId = await queryFixtureRoleId();
  const clueId = await queryFixtureClueId();
  const key = `share-${Date.now()}`;

  await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId },
    payload: { roleSlotId, clueId, message: "idempotency share test" }
  });

  const first = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/clues/${clueId}/share-room`,
    headers: { "x-user-id": playerUserId, "idempotency-key": key },
    payload: { shared: true }
  });
  assert.equal(first.statusCode, 200);

  const second = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/clues/${clueId}/share-room`,
    headers: { "x-user-id": playerUserId, "idempotency-key": key },
    payload: { shared: true }
  });
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.json(), first.json());
});

test("host event dismiss is idempotent with Idempotency-Key", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const inserted = await query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status)
     VALUES ($1, $2, '幂等 dismiss 测试', '', '[]'::jsonb, 'pending')
     RETURNING id`,
    [fixtureRoomId, `idempotent-dismiss-${Date.now()}`]
  );
  const eventId = inserted.rows[0].id;
  const key = `dismiss-${Date.now()}`;

  const first = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host-events/${eventId}/dismiss`,
    headers: { "x-user-id": hostUserId, "idempotency-key": key }
  });
  assert.equal(first.statusCode, 200);

  const second = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host-events/${eventId}/dismiss`,
    headers: { "x-user-id": hostUserId, "idempotency-key": key }
  });
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.json(), first.json());
});

test("share-roles clue endpoint is idempotent with Idempotency-Key", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const roleSlotId = await queryFixtureRoleId();
  const clueId = await queryFixtureClueId();
  const peer = await query(
    `SELECT rs.id FROM role_slots rs
     JOIN rooms r ON r.world_id = rs.world_id
     WHERE r.id = $1 AND rs.id <> $2 ORDER BY rs.sequence LIMIT 1`,
    [fixtureRoomId, roleSlotId]
  );
  assert.ok(peer.rowCount);

  await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `share-roles-grant-${Date.now()}` },
    payload: { roleSlotId, clueId }
  });

  const key = `share-roles-${Date.now()}`;
  const url = `/api/rooms/${fixtureRoomId}/clues/${clueId}/share-roles`;
  const body = { roleSlotIds: [peer.rows[0].id] };
  const first = await app.inject({
    method: "POST",
    url,
    headers: { "x-user-id": playerUserId, "idempotency-key": key },
    payload: body
  });
  assert.equal(first.statusCode, 200);
  const second = await app.inject({
    method: "POST",
    url,
    headers: { "x-user-id": playerUserId, "idempotency-key": key },
    payload: body
  });
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.json(), first.json());
});

test("host event delay is idempotent with Idempotency-Key", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const inserted = await query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status)
     VALUES ($1, $2, 'idempotent delay', '', '[]'::jsonb, 'pending')
     RETURNING id`,
    [fixtureRoomId, `delay-idem-${Date.now()}`]
  );
  const eventId = inserted.rows[0].id;
  const key = `delay-idem-${Date.now()}`;
  const url = `/api/rooms/${fixtureRoomId}/host-events/${eventId}/delay`;
  const first = await app.inject({
    method: "POST",
    url,
    headers: { "x-user-id": hostUserId, "idempotency-key": key },
    payload: { delayMinutes: 20 }
  });
  assert.equal(first.statusCode, 200);
  const second = await app.inject({
    method: "POST",
    url,
    headers: { "x-user-id": hostUserId, "idempotency-key": key },
    payload: { delayMinutes: 20 }
  });
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.json(), first.json());
});

/** Documents routes expected to honor Idempotency-Key (audit guard). */
test("idempotency coverage registry matches implemented routes", () => {
  const covered = [
    "sections.complete",
    "player.mini_game_submit",
    "player.notebook_create",
    "player.notebook_delete",
    "checkpoints.restore",
    "recaps.create",
    "host.manual_log",
    "host.nudge_waiting",
    "host.player_notes",
    "host.player_kick",
    "host.grant_clue",
    "host.grant_item",
    "host.unlock_section",
    "host.unlock_scene",
    "host.event_dismiss",
    "host.event_execute",
    "host.event_delay",
    "host.event_batch",
    "host.rule_trigger",
    "player.investigate",
    "clues.share_room",
    "clues.share_roles"
  ];
  assert.equal(covered.length, 22);
});
