import { query } from "./db.js";

export async function getLatestRoomEventId(roomId) {
  const result = await query(
    `SELECT COALESCE(MAX(id), 0) AS id FROM room_event_journal WHERE room_id = $1`,
    [roomId]
  );
  return Number(result.rows[0]?.id || 0);
}

export async function fetchJournalEventsAfter(roomId, afterJournalId, limitOrOptions = 200) {
  const params = [roomId];
  const options = typeof limitOrOptions === "object" && limitOrOptions !== null ? limitOrOptions : {};
  const limit = typeof limitOrOptions === "number" ? limitOrOptions : options.limit;
  const cappedLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  let sql = `
    SELECT id, event_type, payload, created_at
    FROM room_event_journal
    WHERE room_id = $1`;
  if (afterJournalId != null && afterJournalId !== "") {
    const parsedAfterId = Number(afterJournalId);
    if (!Number.isSafeInteger(parsedAfterId) || parsedAfterId < 0) return [];
    params.push(parsedAfterId);
    sql += ` AND id > $2`;
  }
  if (options.throughId != null) {
    const parsedThroughId = Number(options.throughId);
    if (!Number.isSafeInteger(parsedThroughId) || parsedThroughId < 0) return [];
    params.push(parsedThroughId);
    sql += ` AND id <= $${params.length}`;
  }
  params.push(cappedLimit);
  sql += ` ORDER BY id ASC LIMIT $${params.length}`;
  const result = await query(sql, params);
  return result.rows;
}
