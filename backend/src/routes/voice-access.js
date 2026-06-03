import { query } from "../db.js";

/** Shared voice-room authorization for messages, invites, and LiveKit tokens. */
export async function resolveVoiceRoomAccess(actorId, voiceRoomId) {
  const result = await query(
    `SELECT vr.id, vr.room_id, vr.name, vr.room_type, vr.provider_room_key, vr.status,
            rm.member_type,
            COALESCE((r.settings->>'hostVoiceListen')::boolean, false) AS host_voice_listen,
            EXISTS (
              SELECT 1 FROM voice_room_members vrm
              WHERE vrm.voice_room_id = vr.id AND vrm.user_id = $2
            ) AS voice_member
     FROM voice_rooms vr
     JOIN rooms r ON r.id = vr.room_id
     JOIN room_members rm ON rm.room_id = vr.room_id AND rm.user_id = $2 AND rm.status = 'active'
     WHERE vr.id = $1 AND vr.status = 'active'`,
    [voiceRoomId, actorId]
  );
  if (!result.rowCount) {
    return { allowed: false, error: "Voice room membership required" };
  }
  const row = result.rows[0];
  if (row.room_type === "public" || row.voice_member) {
    return { allowed: true, ...row };
  }
  if (row.member_type === "host" && row.host_voice_listen) {
    return { allowed: true, ...row, host_listen: true };
  }
  return { allowed: false, error: "Voice room membership required" };
}

export async function requireVoiceRoomAccess(actorId, voiceRoomId) {
  const access = await resolveVoiceRoomAccess(actorId, voiceRoomId);
  if (!access.allowed) {
    throw Object.assign(new Error(access.error), { statusCode: 403 });
  }
  return access;
}

export async function ensureVoiceProviderRoomKey(voiceRoomId, existingKey) {
  if (existingKey) return existingKey;
  const providerRoomKey = `zhimu-voice-${voiceRoomId}`;
  await query(`UPDATE voice_rooms SET provider_room_key = $2 WHERE id = $1`, [voiceRoomId, providerRoomKey]);
  return providerRoomKey;
}
