import { query } from "../db.js";

export async function requireRoomRole(actorId, roomId) {
  const result = await query(
    `SELECT rm.role_slot_id, rm.member_type
     FROM room_members rm
     WHERE rm.room_id = $1 AND rm.user_id = $2 AND rm.status = 'active'`,
    [roomId, actorId]
  );
  if (!result.rowCount) {
    const error = new Error("Room membership required");
    error.statusCode = 403;
    throw error;
  }
  return result.rows[0];
}

export async function requireWorldRole(actorId, worldId, allowedRoles = ["owner", "editor"]) {
  const result = await query(
    `SELECT role FROM world_members WHERE world_id = $1 AND user_id = $2`,
    [worldId, actorId]
  );
  if (!result.rowCount || !allowedRoles.includes(result.rows[0].role)) {
    const error = new Error("World editor permission required");
    error.statusCode = 403;
    throw error;
  }
  return result.rows[0];
}

export async function requireVoiceRoomAccess(actorId, voiceRoomId) {
  const result = await query(
    `SELECT vr.id, vr.room_id, vr.name, vr.room_type
     FROM voice_rooms vr
     JOIN room_members rm ON rm.room_id = vr.room_id AND rm.user_id = $2 AND rm.status = 'active'
     WHERE vr.id = $1 AND vr.status = 'active'
       AND (
         vr.room_type = 'public'
         OR EXISTS (
           SELECT 1 FROM voice_room_members vrm
           WHERE vrm.voice_room_id = vr.id AND vrm.user_id = $2
         )
       )`,
    [voiceRoomId, actorId]
  );
  if (!result.rowCount) throw Object.assign(new Error("Voice room membership required"), { statusCode: 403 });
  return result.rows[0];
}
