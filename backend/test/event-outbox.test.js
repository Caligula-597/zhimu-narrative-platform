import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { query } from "../src/db.js";
import { dispatchEventOutbox, waitForScheduledEventOutbox } from "../src/event-outbox-dispatcher.js";
import { subscribePlatformBroadcast, subscribePlatformUserEvents, resetPlatformEventBusForTests } from "../src/platform-event-bus.js";
import { transactionWithPlatformEvents } from "../src/transaction-events.js";
import { fixtureRoomId, hostUserId } from "./helpers/fixture-ids.js";

test("invalid outbox events remain durable and are scheduled for retry", async (context) => {
  const inserted = await query(
    `INSERT INTO event_outbox (event_scope, audience_id, event_type, payload)
     VALUES ('room', $1, 'room.invalid_outbox_probe', $2::jsonb)
     RETURNING id`,
    [fixtureRoomId, JSON.stringify({ type: "room.invalid_outbox_probe", roomId: fixtureRoomId })]
  );
  const id = String(inserted.rows[0].id);
  context.after(() => query(`DELETE FROM event_outbox WHERE id = $1`, [id]));

  const result = await dispatchEventOutbox({ ids: [id], limit: 1 });
  assert.deepEqual(result, { claimed: 1, processed: 0, failed: 1 });

  const row = await query(
    `SELECT status, attempts, claimed_at, last_error FROM event_outbox WHERE id = $1`,
    [id]
  );
  assert.equal(row.rows[0].status, "pending");
  assert.equal(row.rows[0].attempts, 1);
  assert.equal(row.rows[0].claimed_at, null);
  assert.match(row.rows[0].last_error, /Unknown room event type/);
});

test("invalid platform outbox payloads remain durable and are scheduled for retry", async (context) => {
  const inserted = await query(
    `INSERT INTO event_outbox (event_scope, audience_id, event_type, payload)
     VALUES ('platform_broadcast', NULL, 'plaza.post_created', $1::jsonb)
     RETURNING id`,
    [JSON.stringify({ type: "plaza.post_created", at: new Date().toISOString() })]
  );
  const id = String(inserted.rows[0].id);
  context.after(() => query(`DELETE FROM event_outbox WHERE id = $1`, [id]));

  const result = await dispatchEventOutbox({ ids: [id], limit: 1 });
  assert.deepEqual(result, { claimed: 1, processed: 0, failed: 1 });

  const row = await query(
    `SELECT status, attempts, claimed_at, last_error FROM event_outbox WHERE id = $1`,
    [id]
  );
  assert.equal(row.rows[0].status, "pending");
  assert.equal(row.rows[0].attempts, 1);
  assert.equal(row.rows[0].claimed_at, null);
  assert.match(row.rows[0].last_error, /Missing required field: postId/);
});

test("outbox safely terminates events whose room audience was deleted", async (context) => {
  const roomId = randomUUID();
  const inserted = await query(
    `INSERT INTO event_outbox (event_scope, audience_id, event_type, payload)
     VALUES ('room', $1, 'room.host_event_pending', $2::jsonb)
     RETURNING id`,
    [roomId, JSON.stringify({
      type: "room.host_event_pending",
      roomId,
      at: new Date().toISOString(),
      eventId: randomUUID()
    })]
  );
  const id = String(inserted.rows[0].id);
  context.after(() => query(`DELETE FROM event_outbox WHERE id = $1`, [id]));

  assert.deepEqual(await dispatchEventOutbox({ ids: [id], limit: 1 }), {
    claimed: 1,
    processed: 1,
    failed: 0
  });
  const row = await query(
    `SELECT status, journal_id, last_error FROM event_outbox WHERE id = $1`,
    [id]
  );
  assert.equal(row.rows[0].status, "published");
  assert.equal(row.rows[0].journal_id, null);
  assert.match(row.rows[0].last_error, /discarded: room audience no longer exists/);
});

test("outbox retries a room event whose payload audience was tampered", async (context) => {
  const payloadRoomId = randomUUID();
  const inserted = await query(
    `INSERT INTO event_outbox (event_scope, audience_id, event_type, payload)
     VALUES ('room', $1, 'room.host_event_pending', $2::jsonb)
     RETURNING id`,
    [fixtureRoomId, JSON.stringify({
      type: "room.host_event_pending",
      roomId: payloadRoomId,
      at: new Date().toISOString(),
      eventId: randomUUID()
    })]
  );
  const id = String(inserted.rows[0].id);
  context.after(() => query(`DELETE FROM event_outbox WHERE id = $1`, [id]));

  assert.deepEqual(await dispatchEventOutbox({ ids: [id], limit: 1 }), {
    claimed: 1,
    processed: 0,
    failed: 1
  });
  const row = await query(`SELECT status, last_error FROM event_outbox WHERE id = $1`, [id]);
  assert.equal(row.rows[0].status, "pending");
  assert.match(row.rows[0].last_error, /Room outbox audience mismatch/);
});

test("outbox safely terminates personal events whose user audience was deleted", async (context) => {
  const userId = randomUUID();
  const inserted = await query(
    `INSERT INTO event_outbox (event_scope, audience_id, event_type, payload)
     VALUES ('platform_user', $1, 'social.friend_request', $2::jsonb)
     RETURNING id`,
    [userId, JSON.stringify({
      type: "social.friend_request",
      userId,
      at: new Date().toISOString(),
      fromUserId: hostUserId
    })]
  );
  const id = String(inserted.rows[0].id);
  context.after(() => query(`DELETE FROM event_outbox WHERE id = $1`, [id]));

  assert.deepEqual(await dispatchEventOutbox({ ids: [id], limit: 1 }), {
    claimed: 1,
    processed: 1,
    failed: 0
  });
  const row = await query(
    `SELECT status, journal_id, last_error FROM event_outbox WHERE id = $1`,
    [id]
  );
  assert.equal(row.rows[0].status, "published");
  assert.equal(row.rows[0].journal_id, null);
  assert.match(row.rows[0].last_error, /discarded: user audience no longer exists/);
});

test("platform user and broadcast events commit through outbox and journal", async (context) => {
  resetPlatformEventBusForTests();
  const marker = `platform-outbox-${Date.now()}`;
  const userEvents = [];
  const broadcastEvents = [];
  const parse = (message) => JSON.parse(message.payload);
  const unsubscribeUser = subscribePlatformUserEvents(hostUserId, (message) => userEvents.push(parse(message)));
  const unsubscribeBroadcast = subscribePlatformBroadcast((message) => broadcastEvents.push(parse(message)));
  context.after(async () => {
    unsubscribeUser();
    unsubscribeBroadcast();
    await query(`DELETE FROM platform_event_journal WHERE payload->>'marker' = $1`, [marker]);
    await query(`DELETE FROM event_outbox WHERE payload->>'marker' = $1`, [marker]);
  });

  await transactionWithPlatformEvents(async (client, events) => {
    await client.query("SELECT 1");
    events.queueUser(hostUserId, "social.friend_request", {
      fromUserId: hostUserId,
      marker,
      type: "spoofed.type",
      userId: fixtureRoomId,
      at: "spoofed-at"
    });
    events.queueBroadcast("plaza.post_created", {
      postId: fixtureRoomId,
      marker,
      type: "spoofed.type",
      at: "spoofed-at"
    });
    assert.equal(userEvents.length, 0);
    assert.equal(broadcastEvents.length, 0);
  });
  await waitForScheduledEventOutbox();

  assert.equal(userEvents[0]?.marker, marker);
  assert.equal(userEvents[0]?.type, "social.friend_request");
  assert.equal(userEvents[0]?.userId, hostUserId);
  assert.notEqual(userEvents[0]?.at, "spoofed-at");
  assert.equal(broadcastEvents[0]?.marker, marker);
  assert.equal(broadcastEvents[0]?.type, "plaza.post_created");
  assert.notEqual(broadcastEvents[0]?.at, "spoofed-at");
  const outbox = await query(
    `SELECT event_scope, status, journal_id FROM event_outbox
     WHERE payload->>'marker' = $1 ORDER BY id`,
    [marker]
  );
  assert.deepEqual(outbox.rows.map((row) => row.event_scope), ["platform_user", "platform_broadcast"]);
  assert.ok(outbox.rows.every((row) => row.status === "published" && row.journal_id));
});

test("platform events are discarded when their business transaction rolls back", async () => {
  const marker = `platform-outbox-rollback-${Date.now()}`;
  await assert.rejects(
    () => transactionWithPlatformEvents(async (_client, events) => {
      events.queueBroadcast("plaza.post_deleted", { postId: fixtureRoomId, marker });
      throw new Error("platform rollback probe");
    }),
    /platform rollback probe/
  );
  const rows = await query(`SELECT 1 FROM event_outbox WHERE payload->>'marker' = $1`, [marker]);
  assert.equal(rows.rowCount, 0);
});
