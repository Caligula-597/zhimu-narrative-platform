import { query } from "../db.js";

export const CREATOR_ROOM_FIELDS = `
  id, world_id, release_id, host_user_id, name, invite_code, status, settings,
  public_listing, started_at, completed_at, created_at, updated_at`;

const CREATOR_ROOM_SELECT_FIELDS = `
  room.id, room.world_id, room.release_id, room.host_user_id, room.name,
  room.invite_code, room.status, room.settings, room.public_listing,
  room.started_at, room.completed_at, room.created_at, room.updated_at`;

const ROOM_BINDING_SELECT_FIELDS = `
  world.content_revision AS current_content_revision,
  release.release_number,
  release.label AS release_label,
  release.source_content_revision AS release_source_revision,
  release.created_at AS release_created_at`;

export async function configureCreatorRoomTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '10000ms', true)`
  );
}

export async function lockCreatorRoomActor(client, { worldId, actorId }) {
  const result = await client.query(
    `SELECT world_member.role
     FROM worlds world
     JOIN world_members world_member
       ON world_member.world_id = world.id AND world_member.user_id = $2
     WHERE world.id = $1
     FOR KEY SHARE OF world
     FOR SHARE OF world_member`,
    [worldId, actorId]
  );
  return result.rows[0]?.role ?? null;
}

export async function findCreatorRoomActorRole({ worldId, actorId }, client = null) {
  const db = client?.query ? client.query.bind(client) : query;
  const result = await db(
    `SELECT role
     FROM world_members
     WHERE world_id = $1 AND user_id = $2`,
    [worldId, actorId]
  );
  return result.rows[0]?.role ?? null;
}

export async function insertCreatorRoomGraph(client, {
  worldId,
  actorId,
  name,
  inviteCode,
  publicListing,
  releaseId,
  idempotencyKey,
  requestHash
}) {
  const result = await client.query(
    `WITH created_room AS (
       INSERT INTO rooms
         (world_id, host_user_id, name, invite_code, status, public_listing, release_id,
          creation_idempotency_key, creation_request_hash)
       VALUES ($1, $2, $3, $4, 'testing', $5, $6, $7, $8)
       RETURNING ${CREATOR_ROOM_FIELDS}
     ), created_host AS (
       INSERT INTO room_members (room_id, user_id, member_type)
       SELECT id, $2, 'host' FROM created_room
       RETURNING room_id
     ), created_voice AS (
       INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
       SELECT id, '公共讨论房', 'public', $2 FROM created_room
       RETURNING room_id
     )
     SELECT created_room.*,
            world.content_revision AS current_content_revision,
            release.release_number,
            release.label AS release_label,
            release.source_content_revision AS release_source_revision,
            release.created_at AS release_created_at
     FROM created_room
     JOIN created_host ON created_host.room_id = created_room.id
     JOIN created_voice ON created_voice.room_id = created_room.id
     JOIN worlds world ON world.id = created_room.world_id
     LEFT JOIN world_releases release ON release.id = created_room.release_id`,
    [worldId, actorId, name, inviteCode, publicListing, releaseId, idempotencyKey, requestHash]
  );
  return result.rows[0];
}

export async function findCreatorRoomByCreationKey({ worldId, actorId, idempotencyKey }, client = null) {
  const db = client?.query ? client.query.bind(client) : query;
  const result = await db(
    `SELECT ${CREATOR_ROOM_SELECT_FIELDS}, room.creation_request_hash,
            ${ROOM_BINDING_SELECT_FIELDS}
     FROM rooms room
     JOIN worlds world ON world.id = room.world_id
     LEFT JOIN world_releases release ON release.id = room.release_id
     WHERE room.world_id = $1
       AND room.host_user_id = $2
       AND room.creation_idempotency_key = $3`,
    [worldId, actorId, idempotencyKey]
  );
  return result.rows[0] ?? null;
}

export async function listCreatorRoomsForActor({ worldId, actorId }) {
  const result = await query(
    `SELECT world_member.role AS membership_role,
            room.id, room.name, room.invite_code, room.status,
            room.public_listing, room.created_at, room.host_user_id, room.release_id,
            world.content_revision AS current_content_revision,
            release.release_number, release.label AS release_label,
            release.source_content_revision AS release_source_revision,
            release.created_at AS release_created_at,
            (COUNT(room_member.role_slot_id)
              FILTER (WHERE room_member.status = 'active'))::int AS member_count,
            (SELECT COUNT(*)::int FROM role_slots role_slot WHERE role_slot.world_id = $1)
              AS role_slot_count,
            (room.host_user_id = $2) AS is_mine
     FROM world_members world_member
     LEFT JOIN rooms room
       ON room.world_id = world_member.world_id
      AND (
        world_member.role IN ('owner', 'editor')
        OR room.host_user_id = $2
        OR EXISTS (
          SELECT 1 FROM room_members visible_member
          WHERE visible_member.room_id = room.id
            AND visible_member.user_id = $2
            AND visible_member.status = 'active'
        )
      )
     LEFT JOIN worlds world ON world.id = room.world_id
     LEFT JOIN world_releases release ON release.id = room.release_id
     LEFT JOIN room_members room_member
       ON room_member.room_id = room.id
      AND room_member.status = 'active'
      AND room_member.role_slot_id IS NOT NULL
     WHERE world_member.world_id = $1 AND world_member.user_id = $2
     GROUP BY world_member.role, room.id, world.content_revision,
              release.release_number, release.label,
              release.source_content_revision, release.created_at
     ORDER BY room.created_at DESC NULLS LAST`,
    [worldId, actorId]
  );
  return {
    role: result.rows[0]?.membership_role ?? null,
    rooms: result.rows.filter((row) => row.id).map(({ membership_role: _role, ...room }) => room)
  };
}

export async function lockCreatorRoomForListing(client, { worldId, roomId }) {
  const result = await client.query(
    `SELECT ${CREATOR_ROOM_FIELDS}
     FROM rooms
     WHERE id = $1 AND world_id = $2
     FOR UPDATE`,
    [roomId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function lockCreatorRoomHostMembership(client, { roomId, actorId }) {
  const result = await client.query(
    `SELECT member_type
     FROM room_members
     WHERE room_id = $1
       AND user_id = $2
       AND status = 'active'
       AND member_type IN ('host', 'cohost')
     FOR SHARE`,
    [roomId, actorId]
  );
  return result.rows[0] ?? null;
}

export async function findCreatorRoomHostMembership({ roomId, actorId }, client = null) {
  const db = client?.query ? client.query.bind(client) : query;
  const result = await db(
    `SELECT member_type
     FROM room_members
     WHERE room_id = $1
       AND user_id = $2
       AND status = 'active'
       AND member_type IN ('host', 'cohost')`,
    [roomId, actorId]
  );
  return result.rows[0] ?? null;
}

export async function updateCreatorRoomListing(client, { roomId, publicListing }) {
  const result = await client.query(
    `UPDATE rooms
     SET public_listing = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, name, invite_code, status, public_listing, updated_at`,
    [roomId, publicListing]
  );
  return result.rows[0];
}
