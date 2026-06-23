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
  if (result.rowCount) return result.rows[0];

  const room = await query(`SELECT host_user_id FROM rooms WHERE id = $1`, [roomId]);
  if (room.rowCount && room.rows[0].host_user_id === actorId) {
    await query(
      `INSERT INTO room_members (room_id, user_id, member_type)
       VALUES ($1, $2, 'host')
       ON CONFLICT (room_id, user_id)
       DO UPDATE SET status = 'active', member_type = EXCLUDED.member_type`,
      [roomId, actorId]
    );
    return { role_slot_id: null, member_type: "host" };
  }

  throwErr("ROOM_MEMBERSHIP_REQUIRED");
}

export const WORLD_EDITOR_ROLES = ["owner", "editor"];
export const WORLD_READER_ROLES = ["owner", "editor", "host", "viewer"];

export async function requireWorldRole(actorId, worldId, allowedRoles = WORLD_EDITOR_ROLES) {
  const result = await query(
    `SELECT role FROM world_members WHERE world_id = $1 AND user_id = $2`,
    [worldId, actorId]
  );
  if (!result.rowCount) throwErr("WORLD_ACCESS_DENIED");
  if (!allowedRoles.includes(result.rows[0].role)) throwErr("WORLD_EDITOR_REQUIRED");
  return result.rows[0];
}

/** Read script / studio data (public catalog players, hosts, collaborators). */
export async function requireWorldReader(actorId, worldId) {
  const result = await query(
    `SELECT role FROM world_members WHERE world_id = $1 AND user_id = $2`,
    [worldId, actorId]
  );
  if (!result.rowCount || !WORLD_READER_ROLES.includes(result.rows[0].role)) {
    throwErr("WORLD_ACCESS_DENIED");
  }
  return result.rows[0];
}
