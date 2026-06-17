import assert from "node:assert/strict";
import { fixtureRoomId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { wakeDueDelayedHostEvents } from "../src/host-delay-wake.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";


test("host delay rejects invalid delayMinutes schema", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const inserted = await query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status)
     VALUES ($1, $2, 'schema 测试', '', '[]'::jsonb, 'pending')
     RETURNING id`,
    [fixtureRoomId, `delay-schema-${Date.now()}`]
  );

  for (const payload of [{ delayMinutes: 0 }, { delayMinutes: 2000 }, { delayMinutes: "x" }]) {
    const response = await app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/host-events/${inserted.rows[0].id}/delay`,
      headers: { "x-user-id": hostUserId, "idempotency-key": `delay-bad-${Date.now()}-${Math.random()}` },
      payload
    });
    assert.equal(response.statusCode, 400, JSON.stringify(payload));
  }
});

test("host delay returns 404 for missing event", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host-events/${randomUUID()}/delay`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `delay-missing-${Date.now()}` },
    payload: { delayMinutes: 15 }
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "HOST_EVENT_NOT_FOUND");
});

test("host delay rejects players without host membership", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const inserted = await query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status)
     VALUES ($1, $2, 'player delay probe', '', '[]'::jsonb, 'pending')
     RETURNING id`,
    [fixtureRoomId, `delay-player-${Date.now()}`]
  );

  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host-events/${inserted.rows[0].id}/delay`,
    headers: { "x-user-id": playerUserId, "idempotency-key": `delay-player-${Date.now()}` },
    payload: { delayMinutes: 10 }
  });
  assert.equal(response.statusCode, 403);
});

test("host delay rejects dismissed events", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const inserted = await query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status)
     VALUES ($1, $2, 'dismissed delay probe', '', '[]'::jsonb, 'dismissed')
     RETURNING id`,
    [fixtureRoomId, `delay-dismissed-${Date.now()}`]
  );

  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host-events/${inserted.rows[0].id}/delay`,
    headers: { "x-user-id": hostUserId, "idempotency-key": `delay-dismissed-${Date.now()}` },
    payload: { delayMinutes: 10 }
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "HOST_EVENT_ALREADY_RESOLVED");
});

test("wakeDueDelayedHostEvents returns zero when no rows are due", async () => {
  const count = await wakeDueDelayedHostEvents(async () => ({ rowCount: 0, rows: [] }));
  assert.equal(count, 0);
});

test("wakeDueDelayedHostEvents restores delayed rows in database", async (context) => {
  const inserted = await query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status, delay_until)
     VALUES ($1, $2, 'wake fn probe', '', '[]'::jsonb, 'delayed', now() - interval '2 minutes')
     RETURNING id`,
    [fixtureRoomId, `wake-fn-${Date.now()}`]
  );
  const eventId = inserted.rows[0].id;

  const count = await wakeDueDelayedHostEvents();
  assert.ok(count >= 1);

  const row = await query(`SELECT status, delay_until FROM pending_host_events WHERE id = $1`, [eventId]);
  assert.equal(row.rows[0].status, "pending");
  assert.equal(row.rows[0].delay_until, null);
});
