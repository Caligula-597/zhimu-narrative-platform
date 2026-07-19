export async function configureHostPlayerManagementTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '10000ms', true)`
  );
}

export async function hasActiveHostPlayerManagementMembership(client, { roomId, actorId }) {
  const result = await client.query(
    `SELECT 1
     FROM room_members
     WHERE room_id = $1
       AND user_id = $2
       AND status = 'active'
       AND member_type IN ('host', 'cohost')
     FOR SHARE`,
    [roomId, actorId]
  );
  return result.rowCount > 0;
}

export async function roleBelongsToHostPlayerRoomWorld(client, { roomId, roleSlotId }) {
  const result = await client.query(
    `SELECT 1
     FROM role_slots rs
     JOIN rooms room ON room.world_id = rs.world_id
     WHERE room.id = $1 AND rs.id = $2`,
    [roomId, roleSlotId]
  );
  return result.rowCount > 0;
}

export async function upsertHostPlayerNotes(client, { roomId, roleSlotId, notes }) {
  const result = await client.query(
    `INSERT INTO player_states (room_id, role_slot_id, variables, updated_at)
     SELECT room.id, rs.id, jsonb_build_object('hostNotes', $3::text), now()
     FROM rooms room
     JOIN role_slots rs ON rs.world_id = room.world_id
     WHERE room.id = $1 AND rs.id = $2
     ON CONFLICT (room_id, role_slot_id)
     DO UPDATE SET variables = COALESCE(player_states.variables, '{}'::jsonb)
                         || jsonb_build_object('hostNotes', $3::text),
                   updated_at = now()
     RETURNING updated_at`,
    [roomId, roleSlotId, notes]
  );
  return result.rows[0] ?? null;
}

export async function lockActivePlayerOccupant(client, { roomId, roleSlotId }) {
  const result = await client.query(
    `SELECT rm.user_id, u.display_name, rs.name AS role_name
     FROM room_members rm
     JOIN rooms room ON room.id = rm.room_id
     JOIN role_slots rs ON rs.id = rm.role_slot_id AND rs.world_id = room.world_id
     JOIN users u ON u.id = rm.user_id
     WHERE rm.room_id = $1
       AND rm.role_slot_id = $2
       AND rm.status = 'active'
       AND rm.member_type = 'player'
     FOR UPDATE OF rm`,
    [roomId, roleSlotId]
  );
  return result.rows[0] ?? null;
}

export async function removeLockedPlayerOccupant(client, { roomId, roleSlotId, userId }) {
  const result = await client.query(
    `UPDATE room_members
     SET status = 'removed', role_slot_id = NULL
     WHERE room_id = $1
       AND role_slot_id = $2
       AND user_id = $3
       AND status = 'active'
       AND member_type = 'player'
     RETURNING user_id`,
    [roomId, roleSlotId, userId]
  );
  return result.rowCount > 0;
}

export async function insertPlayerKickedTimelineLog(client, {
  roomId,
  actorId,
  roleSlotId,
  userId,
  roleName,
  displayName
}) {
  const result = await client.query(
    `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
     VALUES ($1, $2, 'host', 'player_kicked', $3, $4::jsonb)
     RETURNING id`,
    [
      roomId,
      actorId,
      `主持人将 ${displayName || "玩家"} 移出角色「${roleName}」`,
      JSON.stringify({ roleSlotId, userId, roleName })
    ]
  );
  return result.rows[0];
}

export async function insertHostPlayerManagementAudit(client, {
  roomId,
  actorId,
  action,
  roleSlotId,
  metadata
}) {
  await client.query(
    `INSERT INTO host_audit_log
       (room_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, 'role_slot', $4, $5::jsonb)`,
    [roomId, actorId, action, String(roleSlotId), JSON.stringify(metadata)]
  );
}
