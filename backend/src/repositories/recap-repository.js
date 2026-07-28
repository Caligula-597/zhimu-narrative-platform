import { query } from "../db.js";

export async function configureRecapTransaction(client) {
  await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await client.query("SET LOCAL lock_timeout = '3s'");
  await client.query("SET LOCAL statement_timeout = '30s'");
}

export async function tryLockRecapGeneration(client, roomId) {
  const result = await client.query(
    `SELECT pg_try_advisory_xact_lock(
       hashtextextended('zhimu:recap:' || $1::text, 0)
     ) AS acquired`,
    [roomId]
  );
  return result.rows[0]?.acquired === true;
}

export async function lockRecapRoom(client, roomId) {
  const result = await client.query(
    `SELECT id, host_user_id, world_id
     FROM rooms
     WHERE id = $1
     FOR KEY SHARE`,
    [roomId]
  );
  return result.rows[0] ?? null;
}

export async function lockActiveRecapMembership(client, { roomId, actorId }) {
  const result = await client.query(
    `SELECT role_slot_id, member_type
     FROM room_members
     WHERE room_id = $1 AND user_id = $2 AND status = 'active'
     FOR UPDATE`,
    [roomId, actorId]
  );
  return result.rows[0] ?? null;
}

export async function readRecapWorldEditorRole(client, { worldId, actorId }) {
  const result = await client.query(
    `SELECT role
     FROM world_members
     WHERE world_id = $1 AND user_id = $2 AND role IN ('owner', 'editor')`,
    [worldId, actorId]
  );
  return result.rows[0]?.role ?? null;
}

export async function upsertRecapHostMembership(client, { roomId, actorId }) {
  const result = await client.query(
    `INSERT INTO room_members (room_id, user_id, member_type)
     VALUES ($1, $2, 'host')
     ON CONFLICT (room_id, user_id)
     DO UPDATE SET status = 'active', member_type = EXCLUDED.member_type
     RETURNING role_slot_id, member_type`,
    [roomId, actorId]
  );
  return result.rows[0];
}

export async function countRoomRecaps(client, roomId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM room_recaps
     WHERE room_id = $1`,
    [roomId]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function insertRoomRecap(client, { roomId, actorId, title, snapshotJson }) {
  const result = await client.query(
    `INSERT INTO room_recaps (room_id, created_by_user_id, label, snapshot)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, label, snapshot, created_at`,
    [roomId, actorId, title, snapshotJson]
  );
  return result.rows[0];
}

export async function listRoomRecapRows({ roomId, actorId, limit }) {
  const result = await query(
    `SELECT rr.id,
            rr.label,
            rr.snapshot->>'description' AS description,
            rr.snapshot->'stats' AS stats,
            rr.created_at,
            COALESCE((
              SELECT profile.display_name FROM user_portal_profiles profile
              WHERE profile.user_id = u.id
                AND profile.portal = CASE
                  WHEN u.id = room.host_user_id THEN 'host'
                  ELSE 'player'
                END
            ), u.display_name) AS created_by_name
     FROM room_recaps rr
     JOIN rooms room ON room.id = rr.room_id
     JOIN users u ON u.id = rr.created_by_user_id
     JOIN room_members access
       ON access.room_id = rr.room_id
      AND access.user_id = $2
      AND access.status = 'active'
     WHERE rr.room_id = $1
     ORDER BY rr.created_at DESC, rr.id DESC
     LIMIT $3`,
    [roomId, actorId, limit]
  );
  return result.rows;
}

export async function findRoomRecap({ roomId, recapId, actorId }) {
  const result = await query(
    `SELECT rr.id, rr.label, rr.snapshot, rr.created_at,
            COALESCE((
              SELECT profile.display_name FROM user_portal_profiles profile
              WHERE profile.user_id = u.id
                AND profile.portal = CASE
                  WHEN u.id = room.host_user_id THEN 'host'
                  ELSE 'player'
                END
            ), u.display_name) AS created_by_name
     FROM room_recaps rr
     JOIN rooms room ON room.id = rr.room_id
     JOIN users u ON u.id = rr.created_by_user_id
     JOIN room_members access
       ON access.room_id = rr.room_id
      AND access.user_id = $3
      AND access.status = 'active'
     WHERE rr.id = $1 AND rr.room_id = $2`,
    [recapId, roomId, actorId]
  );
  return result.rows[0] ?? null;
}

export async function findLatestRoomRecap({ roomId, actorId }) {
  const result = await query(
    `SELECT rr.id, rr.label, rr.snapshot, rr.created_at,
            COALESCE((
              SELECT profile.display_name FROM user_portal_profiles profile
              WHERE profile.user_id = u.id
                AND profile.portal = CASE
                  WHEN u.id = room.host_user_id THEN 'host'
                  ELSE 'player'
                END
            ), u.display_name) AS created_by_name
     FROM room_recaps rr
     JOIN rooms room ON room.id = rr.room_id
     JOIN users u ON u.id = rr.created_by_user_id
     JOIN room_members access
       ON access.room_id = rr.room_id
      AND access.user_id = $2
      AND access.status = 'active'
     WHERE rr.room_id = $1
     ORDER BY rr.created_at DESC, rr.id DESC
     LIMIT 1`,
    [roomId, actorId]
  );
  return result.rows[0] ?? null;
}
