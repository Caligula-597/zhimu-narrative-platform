import { query } from "./db.js";

export async function appendRoomEventJournal(roomId, event) {
  const result = await query(
    `INSERT INTO room_event_journal (room_id, event_type, payload)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id, created_at`,
    [roomId, event.type, JSON.stringify(event)]
  );
  return result.rows[0];
}

export async function fetchJournalEventsAfter(roomId, afterJournalId, limit = 200) {
  const params = [roomId];
  let sql = `
    SELECT id, event_type, payload, created_at
    FROM room_event_journal
    WHERE room_id = $1`;
  if (afterJournalId) {
    params.push(Number(afterJournalId));
    sql += ` AND id > $2`;
  }
  params.push(limit);
  sql += ` ORDER BY id ASC LIMIT $${params.length}`;
  const result = await query(sql, params);
  return result.rows;
}
