/** Validate role slots belong to the same world as the room. */
export async function assertRolesInRoomWorld(runQuery, roomId, roleSlotIds, { excludeRoleSlotId } = {}) {
  const unique = [...new Set((roleSlotIds ?? []).filter(Boolean))].filter((id) => id !== excludeRoleSlotId);
  if (!unique.length) return [];
  const result = await runQuery(
    `SELECT rs.id FROM role_slots rs
     JOIN rooms r ON r.world_id = rs.world_id
     WHERE r.id = $1 AND rs.id = ANY($2::uuid[])`,
    [roomId, unique]
  );
  if (result.rowCount !== unique.length) {
    const err = new Error("ROLE_SLOT_WORLD_MISMATCH");
    err.code = "ROLE_SLOT_WORLD_MISMATCH";
    throw err;
  }
  return unique;
}
