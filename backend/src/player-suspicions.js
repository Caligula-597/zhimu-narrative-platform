/**
 * B2: Player suspicion levels (0–5) toward other roles in a room.
 */
import { throwErr } from "./api-errors.js";

function sanitizeText(value = "", max = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

export async function fetchPlayerSuspicions(runQuery, roomId, observerRoleSlotId) {
  const { rows } = await runQuery(
    `SELECT ps.id, ps.target_role_slot_id, rs.name AS target_role_name,
            ps.level, ps.reason, ps.updated_at
     FROM player_suspicions ps
     JOIN role_slots rs ON rs.id = ps.target_role_slot_id
     WHERE ps.room_id = $1 AND ps.observer_role_slot_id = $2
     ORDER BY ps.level DESC, rs.sequence`,
    [roomId, observerRoleSlotId]
  );
  return rows;
}

export async function upsertPlayerSuspicion(runQuery, { roomId, observerRoleSlotId, targetRoleSlotId, level, reason }) {
  if (observerRoleSlotId === targetRoleSlotId) throwErr("BAD_REQUEST", "Cannot suspect yourself");
  const lvl = Math.min(5, Math.max(0, Number(level) || 0));
  const inWorld = await runQuery(
    `SELECT 1 FROM role_slots rs
     JOIN rooms r ON r.world_id = rs.world_id
     WHERE r.id = $1 AND rs.id = $2`,
    [roomId, targetRoleSlotId]
  );
  if (!inWorld.rowCount) throwErr("ROLE_SLOT_WORLD_MISMATCH");

  const { rows } = await runQuery(
    `INSERT INTO player_suspicions (room_id, observer_role_slot_id, target_role_slot_id, level, reason, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (room_id, observer_role_slot_id, target_role_slot_id)
     DO UPDATE SET level = EXCLUDED.level, reason = EXCLUDED.reason, updated_at = now()
     RETURNING id, target_role_slot_id, level, reason, updated_at`,
    [roomId, observerRoleSlotId, targetRoleSlotId, lvl, sanitizeText(reason) || null]
  );
  return rows[0];
}

export async function listRoomSuspicionsForHost(runQuery, roomId) {
  const { rows } = await runQuery(
    `SELECT ps.id, ps.observer_role_slot_id, obs.name AS observer_role_name,
            ps.target_role_slot_id, tgt.name AS target_role_name,
            ps.level, ps.reason, ps.updated_at
     FROM player_suspicions ps
     JOIN role_slots obs ON obs.id = ps.observer_role_slot_id
     JOIN role_slots tgt ON tgt.id = ps.target_role_slot_id
     WHERE ps.room_id = $1
     ORDER BY ps.updated_at DESC`,
    [roomId]
  );
  return rows;
}
