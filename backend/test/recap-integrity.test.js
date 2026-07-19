import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../src/app.js";
import { pool, query } from "../src/db.js";
import {
  assertRecapSnapshotSize,
  createRoomRecap,
  normalizeRecapGenerationError,
  RECAP_LIST_LIMIT,
  RECAP_MAX_PER_ROOM
} from "../src/recap-service.js";
import { fixtureRoomId, hostUserId } from "./helpers/fixture-ids.js";

async function createOwnedRoom(context, prefix) {
  const world = await query(
    `INSERT INTO worlds (owner_user_id, name)
     VALUES ($1, $2)
     RETURNING id`,
    [hostUserId, `${prefix}-world-${Date.now()}`]
  );
  const worldId = world.rows[0].id;
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  const room = await query(
    `INSERT INTO rooms (world_id, host_user_id, name, invite_code)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [worldId, hostUserId, `${prefix}-room`, randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()]
  );
  return { worldId, roomId: room.rows[0].id };
}

test("recap title rejects whitespace before database work", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: `/api/rooms/${fixtureRoomId}/recaps`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "   " }
  });
  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().code, "VALIDATION_ERROR");
});

test("recap generation returns a conflict when the same room is already generating", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const blocker = await pool.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query(
      `SELECT pg_advisory_xact_lock(hashtextextended('zhimu:recap:' || $1::text, 0))`,
      [fixtureRoomId]
    );
    const response = await app.inject({
      method: "POST",
      url: `/api/rooms/${fixtureRoomId}/recaps`,
      headers: { "x-user-id": hostUserId },
      payload: { title: "locked recap" }
    });
    assert.equal(response.statusCode, 409, response.body);
    assert.equal(response.json().code, "RECAP_GENERATION_IN_PROGRESS");
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
});

test("recap creation replays the same response for an idempotent retry", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const { roomId } = await createOwnedRoom(context, "recap-idempotency");
  const key = `recap-${Date.now()}`;
  const request = () => app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/recaps`,
    headers: { "x-user-id": hostUserId, "idempotency-key": key },
    payload: { title: "idempotent recap" }
  });
  const first = await request();
  const second = await request();
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(second.statusCode, 201, second.body);
  assert.equal(second.json().id, first.json().id);
  const stored = await query(`SELECT COUNT(*)::int AS count FROM room_recaps WHERE room_id = $1`, [roomId]);
  assert.equal(stored.rows[0].count, 1);
});

test("legacy recap volume is bounded for both creation and listing", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const { roomId } = await createOwnedRoom(context, "recap-limit");
  await query(
    `INSERT INTO room_recaps (room_id, created_by_user_id, label, snapshot, created_at)
     SELECT $1, $2, 'legacy-' || value,
            jsonb_build_object('description', '', 'stats', jsonb_build_object()),
            now() - make_interval(secs => value)
     FROM generate_series(1, $3::int) value`,
    [roomId, hostUserId, RECAP_MAX_PER_ROOM + 5]
  );

  const rejected = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomId}/recaps`,
    headers: { "x-user-id": hostUserId },
    payload: { title: "over limit" }
  });
  assert.equal(rejected.statusCode, 409, rejected.body);
  assert.equal(rejected.json().code, "RECAP_LIMIT_REACHED");

  const list = await app.inject({
    method: "GET",
    url: `/api/rooms/${roomId}/recaps`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(list.statusCode, 200, list.body);
  assert.equal(list.json().length, RECAP_LIST_LIMIT);
  assert.ok(list.json().every((row) => row.snapshot === undefined));
});

test("a credit reward outage cannot turn a committed recap into a 500", async (context) => {
  const { roomId } = await createOwnedRoom(context, "recap-reward");
  const result = await createRoomRecap({
    actorId: hostUserId,
    roomId,
    title: "reward failure",
    rewardRecap: async () => { throw new Error("credit service unavailable"); }
  });
  assert.equal(result.creditReward, null);
  const stored = await query(`SELECT id FROM room_recaps WHERE id = $1`, [result.id]);
  assert.equal(stored.rowCount, 1);
});

test("oversized recap snapshots fail with a typed safe error", () => {
  assert.throws(
    () => assertRecapSnapshotSize({ body: "x".repeat(128) }, 64),
    (error) => error.code === "RECAP_TOO_LARGE"
      && error.statusCode === 413
      && error.details.byteSize > error.details.maxBytes
  );
});

test("database contention and timeout become typed retryable recap errors", () => {
  const busy = normalizeRecapGenerationError({ code: "55P03" });
  assert.equal(busy.statusCode, 409);
  assert.equal(busy.code, "RECAP_GENERATION_IN_PROGRESS");
  const timeout = normalizeRecapGenerationError({ code: "57014" });
  assert.equal(timeout.statusCode, 503);
  assert.equal(timeout.code, "RECAP_GENERATION_TIMEOUT");
});

test("recap generation indexes are installed", async () => {
  const expected = [
    "idx_clue_ownership_room_acquired",
    "idx_rule_executions_room_executed",
    "idx_investigation_records_room_investigated",
    "idx_room_content_unlocks_room_type_unlocked",
    "idx_reading_progress_room_completed"
  ];
  const result = await query(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
    [expected]
  );
  assert.equal(result.rowCount, expected.length);
});
