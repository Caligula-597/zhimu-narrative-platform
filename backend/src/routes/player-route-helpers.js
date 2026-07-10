/** Shared helpers for player route modules. */
export async function playerDisplayName(query, roomId, roleSlotId) {
  const result = await query(
    `SELECT u.display_name, rs.name AS role_name
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     JOIN role_slots rs ON rs.id = rm.role_slot_id
     WHERE rm.room_id = $1 AND rm.role_slot_id = $2 AND rm.status = 'active'`,
    [roomId, roleSlotId]
  );
  if (!result.rowCount) return "玩家";
  return result.rows[0].display_name || result.rows[0].role_name;
}
