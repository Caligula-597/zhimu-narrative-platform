/** Shared helpers for player route modules. */
export async function playerDisplayName(query, roomId, roleSlotId) {
  const result = await query(
    `SELECT COALESCE((
       SELECT profile.display_name FROM user_portal_profiles profile
       WHERE profile.user_id = u.id AND profile.portal = 'player'
     ), u.display_name) AS display_name, rs.name AS role_name
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     JOIN role_slots rs ON rs.id = rm.role_slot_id
     WHERE rm.room_id = $1 AND rm.role_slot_id = $2 AND rm.status = 'active'`,
    [roomId, roleSlotId]
  );
  if (!result.rowCount) return "玩家";
  return result.rows[0].display_name || result.rows[0].role_name;
}
