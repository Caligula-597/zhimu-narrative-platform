import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { requireHostMembership } from "./routes/host-route-guards.js";
import { transactionWithEvents } from "./transaction-events.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/;

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

async function loadRoomOrThrow(roomId, client = null) {
  const run = client?.query ? client.query.bind(client) : query;
  const result = await run(
    `SELECT id, host_user_id FROM rooms WHERE id = $1`,
    [roomId]
  );
  if (!result.rowCount) throwErr("ROOM_NOT_FOUND");
  return result.rows[0];
}

async function assertPrimaryHost(actorId, roomId, client = null) {
  const room = await loadRoomOrThrow(roomId, client);
  if (String(room.host_user_id) !== String(actorId)) {
    throwErr("COHOST_PRIMARY_REQUIRED");
  }
  return room;
}

async function resolveTargetUserId({ userId, email }) {
  const rawUserId = userId == null ? "" : String(userId).trim();
  const normalizedEmail = normalizeEmail(email);

  if (rawUserId) {
    if (!UUID_RE.test(rawUserId)) throwErr("COHOST_TARGET_INVALID");
    const result = await query(
      `SELECT id FROM users WHERE id = $1 AND user_kind = 'registered'`,
      [rawUserId]
    );
    if (!result.rowCount) throwErr("COHOST_TARGET_INVALID");
    return result.rows[0].id;
  }

  if (normalizedEmail) {
    if (!EMAIL_RE.test(normalizedEmail)) throwErr("EMAIL_INVALID");
    const result = await query(
      `SELECT id FROM users WHERE lower(email) = $1 AND user_kind = 'registered'`,
      [normalizedEmail]
    );
    if (!result.rowCount) throwErr("COHOST_TARGET_INVALID");
    return result.rows[0].id;
  }

  throwErr("COHOST_TARGET_INVALID");
}

function mapCohostRow(row) {
  return {
    userId: String(row.user_id),
    displayName: row.display_name || "",
    email: row.email || "",
    joinedAt: row.joined_at ? new Date(row.joined_at).toISOString() : null
  };
}

export async function listCohosts(roomId, actorId) {
  await requireHostMembership(actorId, roomId);
  const room = await loadRoomOrThrow(roomId);
  const result = await query(
    `SELECT rm.user_id, rm.joined_at, u.email,
            COALESCE((
              SELECT profile.display_name
              FROM user_portal_profiles profile
              WHERE profile.user_id = u.id AND profile.portal = 'host'
            ), u.display_name) AS display_name
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     WHERE rm.room_id = $1
       AND rm.status = 'active'
       AND rm.member_type = 'cohost'
     ORDER BY rm.joined_at ASC, rm.user_id ASC`,
    [roomId]
  );
  return {
    primaryHostUserId: String(room.host_user_id),
    canManage: String(room.host_user_id) === String(actorId),
    cohosts: result.rows.map(mapCohostRow)
  };
}

export async function appointCohost({ actorId, roomId, userId, email }) {
  await assertPrimaryHost(actorId, roomId);
  const targetUserId = await resolveTargetUserId({ userId, email });
  const room = await loadRoomOrThrow(roomId);
  if (String(targetUserId) === String(room.host_user_id)) {
    throwErr("COHOST_TARGET_INVALID");
  }

  return transactionWithEvents(async (client, queueEvent) => {
    await assertPrimaryHost(actorId, roomId, client);

    const existing = await client.query(
      `SELECT member_type, status
       FROM room_members
       WHERE room_id = $1 AND user_id = $2
       FOR UPDATE`,
      [roomId, targetUserId]
    );
    const row = existing.rows[0];
    if (row && row.status === "active" && ["host", "cohost"].includes(row.member_type)) {
      throwErr("COHOST_ALREADY_ASSIGNED");
    }

    const upserted = await client.query(
      `INSERT INTO room_members (room_id, user_id, member_type, role_slot_id, status)
       VALUES ($1, $2, 'cohost', NULL, 'active')
       ON CONFLICT (room_id, user_id) DO UPDATE
         SET member_type = 'cohost',
             status = 'active',
             role_slot_id = NULL
       RETURNING user_id, joined_at`,
      [roomId, targetUserId]
    );

    const profile = await client.query(
      `SELECT u.email,
              COALESCE((
                SELECT profile.display_name
                FROM user_portal_profiles profile
                WHERE profile.user_id = u.id AND profile.portal = 'host'
              ), u.display_name) AS display_name
       FROM users u
       WHERE u.id = $1`,
      [targetUserId]
    );

    const cohost = mapCohostRow({
      user_id: upserted.rows[0].user_id,
      joined_at: upserted.rows[0].joined_at,
      email: profile.rows[0]?.email,
      display_name: profile.rows[0]?.display_name
    });

    queueEvent(roomId, "room.cohost_updated", {
      action: "appointed",
      userId: cohost.userId,
      displayName: cohost.displayName
    });

    return { ok: true, cohost };
  });
}

export async function removeCohost({ actorId, roomId, userId }) {
  await assertPrimaryHost(actorId, roomId);
  const targetUserId = String(userId || "").trim();
  if (!UUID_RE.test(targetUserId)) throwErr("COHOST_TARGET_INVALID");

  return transactionWithEvents(async (client, queueEvent) => {
    await assertPrimaryHost(actorId, roomId, client);

    const removed = await client.query(
      `UPDATE room_members
       SET member_type = 'player',
           status = 'removed',
           role_slot_id = NULL
       WHERE room_id = $1
         AND user_id = $2
         AND status = 'active'
         AND member_type = 'cohost'
       RETURNING user_id`,
      [roomId, targetUserId]
    );
    if (!removed.rowCount) throwErr("COHOST_NOT_FOUND");

    queueEvent(roomId, "room.cohost_updated", {
      action: "removed",
      userId: String(removed.rows[0].user_id)
    });

    return { ok: true, userId: String(removed.rows[0].user_id) };
  });
}
