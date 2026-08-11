export async function loadAuthoredRoomRelationships(client, roomId) {
  const roomResult = await client.query(
    `SELECT room.world_id, room.release_id, release.snapshot
     FROM rooms room
     LEFT JOIN world_releases release ON release.id = room.release_id
     WHERE room.id = $1`,
    [roomId],
  );
  const room = roomResult.rows[0];
  if (!room) return [];
  if (room.release_id) {
    const roles = new Map((room.snapshot?.roles || []).map((role) => [String(role.id), role.name]));
    return (room.snapshot?.roleRelationships || []).map((relationship) => ({
      ...relationship,
      from_role_name: roles.get(String(relationship.from_role_slot_id)) || "",
      to_role_name: roles.get(String(relationship.to_role_slot_id)) || "",
    }));
  }
  const result = await client.query(
    `SELECT relationship.*, source_role.name AS from_role_name, target_role.name AS to_role_name
     FROM world_role_relationships relationship
     JOIN role_slots source_role ON source_role.id = relationship.from_role_slot_id
     JOIN role_slots target_role ON target_role.id = relationship.to_role_slot_id
     WHERE relationship.world_id = $1
     ORDER BY source_role.sequence, target_role.sequence, relationship.created_at`,
    [room.world_id],
  );
  return result.rows;
}
