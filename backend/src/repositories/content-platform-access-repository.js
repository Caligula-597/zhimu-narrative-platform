export async function configureContentPlatformTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '15000ms', true)`
  );
}

export async function lockWorldEditor(client, { worldId, actorId }) {
  const result = await client.query(
    `SELECT world_member.role
     FROM worlds world
     JOIN world_members world_member
       ON world_member.world_id = world.id AND world_member.user_id = $2
     WHERE world.id = $1
     FOR KEY SHARE OF world
     FOR SHARE OF world_member`,
    [worldId, actorId]
  );
  return result.rows[0]?.role ?? null;
}

export async function lockActiveHostMembership(client, { roomId, actorId }) {
  const result = await client.query(
    `SELECT room_member.member_type
     FROM rooms room
     JOIN room_members room_member
       ON room_member.room_id = room.id AND room_member.user_id = $2
     WHERE room.id = $1
       AND room_member.status = 'active'
       AND room_member.member_type IN ('host', 'cohost')
     FOR KEY SHARE OF room
     FOR SHARE OF room_member`,
    [roomId, actorId]
  );
  return result.rows[0] ?? null;
}

export async function lockActivePlayerMembership(client, { roomId, actorId }) {
  const result = await client.query(
    `SELECT room_member.role_slot_id
     FROM rooms room
     JOIN room_members room_member
       ON room_member.room_id = room.id AND room_member.user_id = $2
     WHERE room.id = $1
       AND room_member.status = 'active'
       AND room_member.role_slot_id IS NOT NULL
     FOR KEY SHARE OF room
     FOR SHARE OF room_member`,
    [roomId, actorId]
  );
  return result.rows[0] ?? null;
}

export async function lockRoleInRoomWorld(client, { roomId, roleSlotId }) {
  if (!roleSlotId) return null;
  const result = await client.query(
    `SELECT role_slot.id
     FROM rooms room
     JOIN role_slots role_slot ON role_slot.world_id = room.world_id
     WHERE room.id = $1 AND role_slot.id = $2
     FOR KEY SHARE OF room
     FOR KEY SHARE OF role_slot`,
    [roomId, roleSlotId]
  );
  return result.rows[0] ?? null;
}
