import { query, transaction } from "./db.js";
import { validateRoomEvent } from "./room-event-schemas.js";
import { validatePlatformEvent } from "./platform-event-schemas.js";

const MAX_ATTEMPTS = 10;
const STALE_CLAIM_SECONDS = 60;

function assertValidRoomEvent(type, data) {
  const { ok, errors } = validateRoomEvent(type, data);
  if (!ok) throw new Error(`Invalid room event: ${errors.join("; ")}`);
}

function assertValidPlatformEvent(type, data) {
  const { ok, errors } = validatePlatformEvent(type, data);
  if (!ok) throw new Error(`Invalid platform event: ${errors.join("; ")}`);
}

async function markOutboxAudienceGone(client, current, reason) {
  await client.query(
    `UPDATE event_outbox
     SET status = 'published', published_at = now(), claimed_at = NULL,
         journal_id = NULL, last_error = $2, updated_at = now()
     WHERE id = $1`,
    [current.id, `discarded: ${reason}`]
  );
  return { discarded: true, event: current.payload, journalId: null };
}

export async function enqueueRoomEvents(client, events) {
  const ids = [];
  for (const { roomId, type, data = {} } of events) {
    assertValidRoomEvent(type, data);
    const event = { ...data, type, roomId, at: new Date().toISOString() };
    const inserted = await client.query(
      `INSERT INTO event_outbox (event_scope, audience_id, event_type, payload)
       VALUES ('room', $1, $2, $3::jsonb)
       RETURNING id`,
      [roomId, type, JSON.stringify(event)]
    );
    ids.push(String(inserted.rows[0].id));
  }
  return ids;
}

export async function enqueuePlatformEvents(client, events) {
  const ids = [];
  for (const { audienceType, userId = null, type, data = {} } of events) {
    assertValidPlatformEvent(type, data);
    if (audienceType !== "user" && audienceType !== "broadcast") {
      throw new Error(`Invalid platform audience: ${audienceType}`);
    }
    if (audienceType === "user" && !userId) throw new Error("Platform user event requires userId");
    const event = {
      ...data,
      type,
      at: new Date().toISOString()
    };
    if (audienceType === "user") event.userId = userId;
    else delete event.userId;
    const inserted = await client.query(
      `INSERT INTO event_outbox (event_scope, audience_id, event_type, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id`,
      [audienceType === "user" ? "platform_user" : "platform_broadcast", userId, type, JSON.stringify(event)]
    );
    ids.push(String(inserted.rows[0].id));
  }
  return ids;
}

export async function claimEventOutbox({ ids = null, limit = 50 } = {}) {
  const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return transaction(async (client) => {
    const params = [];
    let idFilter = "";
    if (ids?.length) {
      params.push(ids.map(String));
      idFilter = `AND id = ANY($${params.length}::bigint[])`;
    }
    params.push(STALE_CLAIM_SECONDS, cappedLimit);
    const result = await client.query(
      `WITH claimable AS (
         SELECT id
         FROM event_outbox
         WHERE ${idFilter ? idFilter.replace(/^AND /, "") : "true"}
           AND available_at <= now()
           AND (
             status = 'pending'
             OR (status = 'processing' AND claimed_at < now() - ($${params.length - 1}::text || ' seconds')::interval)
           )
         ORDER BY id
         LIMIT $${params.length}
         FOR UPDATE SKIP LOCKED
       )
       UPDATE event_outbox AS outbox
       SET status = 'processing',
           claimed_at = now(),
           attempts = attempts + 1,
           updated_at = now()
       FROM claimable
       WHERE outbox.id = claimable.id
       RETURNING outbox.*`,
      params
    );
    return result.rows;
  });
}

export async function persistClaimedRoomEvent(row) {
  return transaction(async (client) => {
    const locked = await client.query(
      `SELECT * FROM event_outbox WHERE id = $1 FOR UPDATE`,
      [row.id]
    );
    const current = locked.rows[0];
    if (!current || current.status !== "processing") return null;
    const event = current.payload;
    assertValidRoomEvent(current.event_type, event);
    if (event.type !== current.event_type) throw new Error("Room outbox event type mismatch");
    if (event.roomId !== current.audience_id) throw new Error("Room outbox audience mismatch");
    // Hold the audience row through the journal insert. Without this lock a
    // concurrent room deletion can commit between the existence check and the
    // FK-protected insert, turning a harmless stale outbox row into a retry.
    const audience = await client.query(`SELECT 1 FROM rooms WHERE id = $1 FOR KEY SHARE`, [current.audience_id]);
    if (!audience.rowCount) return markOutboxAudienceGone(client, current, "room audience no longer exists");
    const journal = await client.query(
      `INSERT INTO room_event_journal (room_id, event_type, payload)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id, created_at`,
      [current.audience_id, current.event_type, JSON.stringify(event)]
    );
    await client.query(
      `UPDATE event_outbox
       SET status = 'published',
           journal_id = $2,
           published_at = now(),
           claimed_at = NULL,
           last_error = NULL,
           updated_at = now()
       WHERE id = $1`,
      [current.id, journal.rows[0].id]
    );
    return { event, journalId: journal.rows[0].id };
  });
}

export async function persistClaimedPlatformEvent(row) {
  return transaction(async (client) => {
    const locked = await client.query(`SELECT * FROM event_outbox WHERE id = $1 FOR UPDATE`, [row.id]);
    const current = locked.rows[0];
    if (!current || current.status !== "processing") return null;
    const audienceType = current.event_scope === "platform_broadcast" ? "broadcast" : "user";
    if (current.event_scope !== "platform_broadcast" && current.event_scope !== "platform_user") {
      throw new Error(`Invalid platform outbox scope: ${current.event_scope}`);
    }
    const event = current.payload;
    assertValidPlatformEvent(current.event_type, event);
    if (event.type !== current.event_type) throw new Error("Platform outbox event type mismatch");
    if (audienceType === "user" && event.userId !== current.audience_id) {
      throw new Error("Platform outbox user audience mismatch");
    }
    if (audienceType === "broadcast" && event.userId != null) {
      throw new Error("Platform broadcast event must not carry userId");
    }
    if (audienceType === "user") {
      const audience = await client.query(`SELECT 1 FROM users WHERE id = $1 FOR KEY SHARE`, [current.audience_id]);
      if (!audience.rowCount) return markOutboxAudienceGone(client, current, "user audience no longer exists");
    }
    const journal = await client.query(
      `INSERT INTO platform_event_journal (audience_type, audience_user_id, event_type, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, created_at`,
      [audienceType, current.audience_id, current.event_type, JSON.stringify(event)]
    );
    await client.query(
      `UPDATE event_outbox
       SET status = 'published', journal_id = $2, published_at = now(),
           claimed_at = NULL, last_error = NULL, updated_at = now()
       WHERE id = $1`,
      [current.id, journal.rows[0].id]
    );
    return {
      audienceType,
      userId: current.audience_id,
      event,
      journalId: journal.rows[0].id
    };
  });
}

export async function releaseFailedOutboxEvent(row, error) {
  const attempts = Number(row.attempts || 1);
  const dead = attempts >= MAX_ATTEMPTS;
  const delaySeconds = Math.min(2 ** Math.max(attempts - 1, 0), 300);
  await query(
    `UPDATE event_outbox
     SET status = $2,
         available_at = CASE WHEN $2 = 'dead' THEN available_at ELSE now() + ($3::text || ' seconds')::interval END,
         claimed_at = NULL,
         last_error = $4,
         updated_at = now()
     WHERE id = $1 AND status = 'processing'`,
    [row.id, dead ? "dead" : "pending", delaySeconds, String(error?.message || error).slice(0, 2000)]
  );
  return { dead, delaySeconds };
}

export async function readEventOutboxCounts() {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
       COUNT(*) FILTER (WHERE status = 'dead')::int AS dead,
       COALESCE(EXTRACT(EPOCH FROM (now() - (MIN(created_at) FILTER (WHERE status IN ('pending', 'processing'))))), 0)::int AS oldest_pending_seconds
     FROM event_outbox`
  );
  return result.rows[0] || { pending: 0, processing: 0, dead: 0, oldest_pending_seconds: 0 };
}
