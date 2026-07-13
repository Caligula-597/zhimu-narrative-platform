import { query } from "./db.js";

export async function appendPlatformEventJournal({ audienceType, userId = null, event }) {
  const result = await query(
    `INSERT INTO platform_event_journal (audience_type, audience_user_id, event_type, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, created_at`,
    [audienceType, userId, event.type, JSON.stringify(event)]
  );
  return result.rows[0];
}

export async function getLatestPlatformEventId(userId) {
  const result = await query(
    `SELECT COALESCE(MAX(id), 0) AS id
     FROM platform_event_journal
     WHERE audience_type = 'broadcast'
        OR (audience_type = 'user' AND audience_user_id = $1)`,
    [userId]
  );
  return Number(result.rows[0]?.id || 0);
}

export async function fetchPlatformEventsAfter(userId, afterId, { throughId, limit = 200 } = {}) {
  const parsedAfterId = Number(afterId);
  const parsedThroughId = Number(throughId);
  if (!Number.isSafeInteger(parsedAfterId) || parsedAfterId < 0) return [];
  if (!Number.isSafeInteger(parsedThroughId) || parsedThroughId < parsedAfterId) return [];
  const cappedLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const result = await query(
    `SELECT id, event_type, payload, created_at
     FROM platform_event_journal
     WHERE id > $2 AND id <= $3
       AND (audience_type = 'broadcast'
         OR (audience_type = 'user' AND audience_user_id = $1))
     ORDER BY id ASC
     LIMIT $4`,
    [userId, parsedAfterId, parsedThroughId, cappedLimit]
  );
  return result.rows;
}
