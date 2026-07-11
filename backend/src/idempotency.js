import { createHash } from "node:crypto";
import { query } from "./db.js";

const PROCESSING_STALE_MS = Number(process.env.IDEMPOTENCY_STALE_MS || 60_000);
const WAIT_TIMEOUT_MS = Number(process.env.IDEMPOTENCY_WAIT_MS || 8_000);
const WAIT_INTERVAL_MS = Number(process.env.IDEMPOTENCY_WAIT_INTERVAL_MS || 50);

/**
 * Production must fail closed. Dev may fail open only when the table is missing
 * (pre-migrate) unless IDEMPOTENCY_FAIL_OPEN=false.
 */
export function isIdempotencyFailOpen() {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.IDEMPOTENCY_FAIL_OPEN === "false") return false;
  return true;
}

export function readIdempotencyKey(request) {
  const header = request.headers["idempotency-key"];
  if (!header) return null;
  const key = String(header).trim();
  if (!key || key.length > 128) return null;
  return key;
}

export function hashIdempotencyRequest(request) {
  const method = String(request.method || "POST").toUpperCase();
  const url = String(request.url || "").split("?")[0];
  let body = "";
  try {
    body = request.body === undefined ? "" : JSON.stringify(request.body);
  } catch {
    body = "";
  }
  return createHash("sha256").update(`${method}\n${url}\n${body}`).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function infraError(error, action) {
  const err = new Error(`Idempotency ${action} failed: ${error.message || error}`);
  err.code = "IDEMPOTENCY_UNAVAILABLE";
  err.statusCode = 503;
  err.cause = error;
  return err;
}

function conflictError(message, code = "IDEMPOTENCY_CONFLICT") {
  const err = new Error(message);
  err.code = code;
  err.statusCode = 409;
  return err;
}

async function runIdempotencyQuery(text, params) {
  try {
    return await query(text, params);
  } catch (error) {
    if (isIdempotencyFailOpen() && (error.code === "42P01" || /write_idempotency/i.test(error.message || ""))) {
      return null;
    }
    throw infraError(error, "query");
  }
}

/**
 * Atomically claim an idempotency key for this route/request.
 * @returns {Promise<"execute"|"replay"|null>} null means fail-open (dev only)
 */
export async function claimIdempotencySlot(roomId, idempotencyKey, routeKey, requestHash) {
  if (!idempotencyKey) return "execute";

  const inserted = await runIdempotencyQuery(
    `INSERT INTO write_idempotency (room_id, idempotency_key, route_key, request_hash, status, response, updated_at)
     VALUES ($1, $2, $3, $4, 'processing', NULL, now())
     ON CONFLICT (room_id, idempotency_key) DO NOTHING
     RETURNING room_id`,
    [roomId, idempotencyKey, routeKey, requestHash]
  );
  if (inserted == null) return null;
  if (inserted.rowCount) return "execute";

  // Reclaim failed or stale processing slots so clients can safely retry the same key.
  const reclaim = await runIdempotencyQuery(
    `UPDATE write_idempotency
     SET status = 'processing',
         route_key = $3,
         request_hash = $4,
         response = NULL,
         updated_at = now()
     WHERE room_id = $1
       AND idempotency_key = $2
       AND (
         status = 'failed'
         OR (
           status = 'processing'
           AND updated_at < now() - make_interval(secs => GREATEST($5::int, 1))
         )
       )
     RETURNING room_id`,
    [roomId, idempotencyKey, routeKey, requestHash, Math.ceil(PROCESSING_STALE_MS / 1000)]
  );
  if (reclaim == null) return null;
  if (reclaim.rowCount) return "execute";

  return "replay";
}

export async function loadIdempotencyRow(roomId, idempotencyKey) {
  if (!idempotencyKey) return null;
  const result = await runIdempotencyQuery(
    `SELECT route_key, request_hash, status, response, updated_at
     FROM write_idempotency
     WHERE room_id = $1 AND idempotency_key = $2`,
    [roomId, idempotencyKey]
  );
  if (result == null) return null;
  return result.rows[0] ?? null;
}

export async function completeIdempotencySlot(roomId, idempotencyKey, response) {
  if (!idempotencyKey) return;
  const result = await runIdempotencyQuery(
    `UPDATE write_idempotency
     SET status = 'completed', response = $3::jsonb, updated_at = now()
     WHERE room_id = $1 AND idempotency_key = $2`,
    [roomId, idempotencyKey, JSON.stringify(response ?? null)]
  );
  if (result == null) return;
}

export async function failIdempotencySlot(roomId, idempotencyKey, errorPayload) {
  if (!idempotencyKey) return;
  const result = await runIdempotencyQuery(
    `UPDATE write_idempotency
     SET status = 'failed', response = $3::jsonb, updated_at = now()
     WHERE room_id = $1 AND idempotency_key = $2`,
    [roomId, idempotencyKey, JSON.stringify(errorPayload ?? { error: "failed" })]
  );
  if (result == null) return;
}

/**
 * Wait for a concurrent claim to finish, validating route/hash.
 */
export async function awaitIdempotentReplay(roomId, idempotencyKey, routeKey, requestHash) {
  const started = Date.now();
  while (Date.now() - started < WAIT_TIMEOUT_MS) {
    const row = await loadIdempotencyRow(roomId, idempotencyKey);
    if (!row) {
      await sleep(WAIT_INTERVAL_MS);
      continue;
    }
    if (row.route_key && row.route_key !== routeKey) {
      throw conflictError("Idempotency-Key was already used for a different route", "IDEMPOTENCY_ROUTE_MISMATCH");
    }
    if (row.request_hash && requestHash && row.request_hash !== requestHash) {
      throw conflictError("Idempotency-Key was already used with a different request body", "IDEMPOTENCY_PAYLOAD_MISMATCH");
    }
    if (row.status === "completed") return row.response;
    if (row.status === "failed") {
      const err = new Error(row.response?.error || "Previous idempotent request failed");
      err.code = row.response?.code || "IDEMPOTENCY_PREVIOUS_FAILED";
      err.statusCode = row.response?.statusCode || 409;
      err.details = row.response?.details;
      throw err;
    }
    await sleep(WAIT_INTERVAL_MS);
  }
  throw conflictError("Idempotent request is still processing", "IDEMPOTENCY_IN_PROGRESS");
}

/** @deprecated Prefer claim/complete flow via withRoomIdempotency */
export async function loadIdempotentResponse(roomId, idempotencyKey) {
  const row = await loadIdempotencyRow(roomId, idempotencyKey);
  if (!row || row.status !== "completed") return null;
  return row.response ?? null;
}

/** @deprecated Prefer claim/complete flow via withRoomIdempotency */
export async function storeIdempotentResponse(roomId, idempotencyKey, routeKey, response) {
  if (!idempotencyKey) return;
  await runIdempotencyQuery(
    `INSERT INTO write_idempotency (room_id, idempotency_key, route_key, status, response, updated_at)
     VALUES ($1, $2, $3, 'completed', $4::jsonb, now())
     ON CONFLICT (room_id, idempotency_key) DO UPDATE
       SET status = 'completed', response = EXCLUDED.response, route_key = EXCLUDED.route_key, updated_at = now()`,
    [roomId, idempotencyKey, routeKey, JSON.stringify(response)]
  );
}
