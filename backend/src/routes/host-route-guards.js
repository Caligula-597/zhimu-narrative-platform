import { throwErr } from "../api-errors.js";
import { requireRoomRole } from "./route-guards.js";

export async function requireHostMembership(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!["host", "cohost"].includes(membership.member_type)) throwErr("HOST_ROLE_REQUIRED");
  return membership;
}

export async function assertRoleInRoomWorld(runQuery, roomId, roleSlotId) {
  const result = await runQuery(
    `SELECT 1 FROM role_slots rs
     JOIN rooms r ON r.world_id = rs.world_id
     WHERE r.id = $1 AND rs.id = $2`,
    [roomId, roleSlotId]
  );
  if (!result.rowCount) throwErr("ROLE_SLOT_WORLD_MISMATCH");
}
