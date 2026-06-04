import { query } from "../db.js";
import { throwErr } from "../api-errors.js";
export { requireVoiceRoomAccess, resolveVoiceRoomAccess } from "./voice-access.js";

export async function requireRoomRole(actorId, roomId) {
  const result = await query(
    `SELECT rm.role_slot_id, rm.member_type
     FROM room_members rm
     WHERE rm.room_id = $1 AND rm.user_id = $2 AND rm.status = 'active'`,
    [roomId, actorId]
  );
  if (!result.rowCount) throwErr("ROOM_MEMBERSHIP_REQUIRED");
  return result.rows[0];
}

export async function requireWorldRole(actorId, worldId, allowedRoles = ["owner", "editor"]) {
  const result = await query(
    `SELECT role FROM world_members WHERE world_id = $1 AND user_id = $2`,
    [worldId, actorId]
  );
  if (!result.rowCount || !allowedRoles.includes(result.rows[0].role)) throwErr("WORLD_EDITOR_REQUIRED");
  return result.rows[0];
}
