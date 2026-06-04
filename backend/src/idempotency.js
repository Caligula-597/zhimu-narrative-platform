import { query } from "./db.js";

export async function loadIdempotentResponse(roomId, idempotencyKey) {
  if (!idempotencyKey) return null;
  try {
    const result = await query(
      `SELECT response FROM write_idempotency
       WHERE room_id = $1 AND idempotency_key = $2`,
      [roomId, idempotencyKey]
    );
    return result.rows[0]?.response ?? null;
  } catch {
    return null;
  }
}

export async function storeIdempotentResponse(roomId, idempotencyKey, routeKey, response) {
  if (!idempotencyKey) return;
  try {
    await query(
      `INSERT INTO write_idempotency (room_id, idempotency_key, route_key, response)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (room_id, idempotency_key) DO NOTHING`,
      [roomId, idempotencyKey, routeKey, JSON.stringify(response)]
    );
  } catch {
    /* table may be missing before migrate; must not block writes */
  }
}

export function readIdempotencyKey(request) {
  const header = request.headers["idempotency-key"];
  if (!header) return null;
  const key = String(header).trim();
  if (!key || key.length > 128) return null;
  return key;
}
