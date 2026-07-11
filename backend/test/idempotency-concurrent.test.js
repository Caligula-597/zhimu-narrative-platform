import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId, playerUserId, fixtureRoomId } from "./helpers/fixture-ids.js";
import { queryFixtureRoleId } from "./helpers/fixture-helpers.js";
import {
  claimIdempotencySlot,
  hashIdempotencyRequest,
  isIdempotencyFailOpen,
  readIdempotencyKey
} from "../src/idempotency.js";

test("production idempotency never fail-opens", () => {
  const prevNode = process.env.NODE_ENV;
  const prevFlag = process.env.IDEMPOTENCY_FAIL_OPEN;
  try {
    process.env.NODE_ENV = "production";
    process.env.IDEMPOTENCY_FAIL_OPEN = "true";
    assert.equal(isIdempotencyFailOpen(), false);
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevFlag == null) delete process.env.IDEMPOTENCY_FAIL_OPEN;
    else process.env.IDEMPOTENCY_FAIL_OPEN = prevFlag;
  }
});

test("hashIdempotencyRequest changes when body changes", () => {
  const a = hashIdempotencyRequest({ method: "POST", url: "/api/x", body: { a: 1 } });
  const b = hashIdempotencyRequest({ method: "POST", url: "/api/x", body: { a: 2 } });
  assert.notEqual(a, b);
  assert.equal(readIdempotencyKey({ headers: { "idempotency-key": "  k1  " } }), "k1");
});

test("concurrent identical Idempotency-Key executes business once", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const roleSlotId = await queryFixtureRoleId();
  const clue = await query(
    `SELECT c.id FROM clues c JOIN rooms r ON r.world_id = c.world_id WHERE r.id = $1 LIMIT 1`,
    [fixtureRoomId]
  );
  const clueId = clue.rows[0].id;
  const key = `concurrent-grant-${Date.now()}`;

  await query(
    `DELETE FROM clue_ownership WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3`,
    [fixtureRoomId, roleSlotId, clueId]
  );

  const inject = () =>
    app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/host/grant-clue`,
      headers: { "x-user-id": hostUserId, "idempotency-key": key },
      payload: { roleSlotId, clueId, message: "concurrent idempotency" }
    });

  const [first, second] = await Promise.all([inject(), inject()]);
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(second.statusCode, 200, second.body);
  assert.deepEqual(second.json(), first.json());

  const owned = await query(
    `SELECT 1 FROM clue_ownership WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3`,
    [fixtureRoomId, roleSlotId, clueId]
  );
  assert.equal(owned.rowCount, 1, "concurrent duplicate must not double-grant clue");

  const slots = await query(
    `SELECT status, route_key FROM write_idempotency WHERE room_id = $1 AND idempotency_key = $2`,
    [fixtureRoomId, key]
  );
  assert.equal(slots.rowCount, 1);
  assert.equal(slots.rows[0].status, "completed");
  assert.equal(slots.rows[0].route_key, "host.grant_clue");
});

test("same Idempotency-Key with different payload returns 409", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const roleSlotId = await queryFixtureRoleId();
  const clues = await query(
    `SELECT c.id FROM clues c JOIN rooms r ON r.world_id = c.world_id WHERE r.id = $1 LIMIT 2`,
    [fixtureRoomId]
  );
  if (clues.rowCount < 2) {
    context.skip("fixture needs at least two clues");
    return;
  }
  const key = `payload-mismatch-${Date.now()}`;
  const first = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId, "idempotency-key": key },
    payload: { roleSlotId, clueId: clues.rows[0].id, message: "first" }
  });
  assert.equal(first.statusCode, 200, first.body);

  const second = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/host/grant-clue`,
    headers: { "x-user-id": hostUserId, "idempotency-key": key },
    payload: { roleSlotId, clueId: clues.rows[1].id, message: "different" }
  });
  assert.equal(second.statusCode, 409);
  assert.equal(second.json().code, "IDEMPOTENCY_PAYLOAD_MISMATCH");
});

test("claimIdempotencySlot is exclusive for first writer", async () => {
  const roomId = fixtureRoomId;
  const key = `unit-claim-${Date.now()}`;
  const first = await claimIdempotencySlot(roomId, key, "test.route", "hash-a");
  const second = await claimIdempotencySlot(roomId, key, "test.route", "hash-a");
  assert.equal(first, "execute");
  assert.equal(second, "replay");
  await query(`DELETE FROM write_idempotency WHERE room_id = $1 AND idempotency_key = $2`, [roomId, key]);
});
