import { query } from "../db.js";

export async function findVoiceRoomAccess(actorId, voiceRoomId, executor = query) {
  const result = await executor(
    `SELECT vr.id, vr.room_id, vr.name, vr.room_type, vr.provider_room_key, vr.status,
            rm.member_type, COALESCE((
              SELECT profile.display_name FROM user_portal_profiles profile
              WHERE profile.user_id = u.id
                AND profile.portal = CASE WHEN rm.member_type IN ('host', 'cohost') THEN 'host' ELSE 'player' END
            ), u.display_name) AS display_name,
            COALESCE((r.settings->>'hostVoiceListen')::boolean, false) AS host_voice_listen,
            EXISTS (
              SELECT 1 FROM voice_room_members vrm
              WHERE vrm.voice_room_id = vr.id AND vrm.user_id = $2
            ) AS voice_member
     FROM voice_rooms vr
     JOIN rooms r ON r.id = vr.room_id
     JOIN room_members rm
       ON rm.room_id = vr.room_id AND rm.user_id = $2 AND rm.status = 'active'
     JOIN users u ON u.id = $2
     WHERE vr.id = $1
       AND vr.status = 'active'
       AND (vr.expires_at IS NULL OR vr.expires_at > now())`,
    [voiceRoomId, actorId]
  );
  return result.rows[0] ?? null;
}

export async function listVoiceRoomMessages(voiceRoomId, executor = query) {
  const result = await executor(
    `SELECT vrm.id, vrm.body, vrm.created_at, COALESCE((
       SELECT profile.display_name FROM user_portal_profiles profile
       WHERE profile.user_id = u.id AND profile.portal = 'player'
     ), u.display_name) AS sender_name
     FROM voice_room_messages vrm
     JOIN users u ON u.id = vrm.sender_user_id
     WHERE vrm.voice_room_id = $1
     ORDER BY vrm.created_at DESC
     LIMIT 80`,
    [voiceRoomId]
  );
  return result.rows.reverse();
}

export async function configureVoiceTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '10000ms', true)`
  );
}

export async function lockRoomForVoiceMutation(client, roomId) {
  const result = await client.query(
    `SELECT id
     FROM rooms
     WHERE id = $1
     FOR UPDATE`,
    [roomId]
  );
  return result.rowCount > 0;
}

export async function countActiveVoiceRooms(client, roomId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM voice_rooms
     WHERE room_id = $1
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > now())`,
    [roomId]
  );
  return result.rows[0]?.count ?? 0;
}

export async function findActiveRoomMemberIds(client, roomId, userIds) {
  const result = await client.query(
    `SELECT user_id
     FROM room_members
     WHERE room_id = $1
       AND status = 'active'
       AND user_id = ANY($2::uuid[])`,
    [roomId, userIds]
  );
  return result.rows.map((row) => row.user_id);
}

export async function insertVoiceRoom(client, {
  roomId,
  name,
  roomType,
  actorId,
  privateRoomLifetimeHours
}) {
  const result = await client.query(
    `INSERT INTO voice_rooms (
       room_id, name, room_type, created_by_user_id, expires_at
     )
     VALUES (
       $1, $2, $3::voice_room_type, $4,
       CASE WHEN $3::text = 'invite_private'
            THEN now() + ($5::text || ' hours')::interval
            ELSE NULL END
     )
     RETURNING id, room_id, name, room_type, status, expires_at`,
    [roomId, name, roomType, actorId, privateRoomLifetimeHours]
  );
  return result.rows[0];
}

export async function insertVoiceRoomMembers(client, { voiceRoomId, userIds, actorId }) {
  const result = await client.query(
    `INSERT INTO voice_room_members (voice_room_id, user_id, invited_by_user_id, joined_at)
     SELECT $1, requested.user_id, $3, now()
     FROM unnest($2::uuid[]) AS requested(user_id)
     ON CONFLICT (voice_room_id, user_id) DO NOTHING
     RETURNING user_id`,
    [voiceRoomId, userIds, actorId]
  );
  return result.rows.map((row) => row.user_id);
}

export async function insertVoiceMessageWithAudience(client, { voiceRoomId, actorId, body }) {
  const result = await client.query(
    `WITH inserted AS (
       INSERT INTO voice_room_messages (voice_room_id, sender_user_id, body)
       SELECT vr.id, $2, $3
       FROM voice_rooms vr
       WHERE vr.id = $1
         AND vr.status = 'active'
         AND (vr.expires_at IS NULL OR vr.expires_at > now())
       RETURNING id, body, created_at, voice_room_id
     )
     SELECT inserted.id, inserted.body, inserted.created_at, inserted.voice_room_id,
            vr.room_id, vr.room_type,
            COALESCE(
              array_agg(vrm.user_id) FILTER (WHERE vrm.user_id IS NOT NULL),
              '{}'::uuid[]
            ) AS audience_user_ids
     FROM inserted
     JOIN voice_rooms vr ON vr.id = inserted.voice_room_id
     LEFT JOIN voice_room_members vrm
       ON vrm.voice_room_id = vr.id AND vr.room_type <> 'public'
     GROUP BY inserted.id, inserted.body, inserted.created_at, inserted.voice_room_id,
              vr.room_id, vr.room_type`,
    [voiceRoomId, actorId, body]
  );
  return result.rows[0] ?? null;
}

export async function ensureVoiceProviderRoomKey(voiceRoomId, proposedKey, executor = query) {
  const result = await executor(
    `UPDATE voice_rooms
     SET provider_room_key = COALESCE(provider_room_key, $2)
     WHERE id = $1
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > now())
     RETURNING provider_room_key`,
    [voiceRoomId, proposedKey]
  );
  return result.rows[0]?.provider_room_key ?? null;
}
