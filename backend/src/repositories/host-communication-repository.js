export async function configureHostCommunicationTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '10000ms', true)`
  );
}

export async function hasActiveHostCommunicationMembership(client, { roomId, actorId }) {
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

export async function roleBelongsToCommunicationRoomWorld(client, { roomId, roleSlotId }) {
  const result = await client.query(
    `SELECT 1
     FROM role_slots rs
     JOIN rooms room ON room.world_id = rs.world_id
     WHERE room.id = $1 AND rs.id = $2`,
    [roomId, roleSlotId]
  );
  return result.rowCount > 0;
}

export async function insertHostManualTimelineLog(client, {
  roomId,
  actorId,
  eventType,
  message,
  roleSlotId
}) {
  const result = await client.query(
    `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
     VALUES ($1, $2, 'host', $3, $4,
             jsonb_build_object('roleSlotId', $5::text, 'source', 'host_manual'))
     RETURNING id, event_type, created_at`,
    [roomId, actorId, eventType, message, roleSlotId ?? null]
  );
  return result.rows[0];
}

export async function listPendingHostCommunicationEvents(client, roomId) {
  const result = await client.query(
    `SELECT phe.actions, ar.conditions AS rule_conditions
     FROM pending_host_events phe
     LEFT JOIN automation_rules ar ON ar.id = phe.rule_id
     WHERE phe.room_id = $1 AND phe.status = 'pending'
     ORDER BY phe.created_at, phe.id`,
    [roomId]
  );
  return result.rows;
}

export async function listActivePlayerRoleSlotIdsForCommunication(client, roomId) {
  const result = await client.query(
    `SELECT rm.role_slot_id::text AS role_slot_id
     FROM room_members rm
     JOIN rooms room ON room.id = rm.room_id
     JOIN role_slots rs ON rs.id = rm.role_slot_id AND rs.world_id = room.world_id
     WHERE rm.room_id = $1
       AND rm.status = 'active'
       AND rm.member_type = 'player'
       AND rm.role_slot_id IS NOT NULL
     ORDER BY rm.role_slot_id
     FOR SHARE OF rm`,
    [roomId]
  );
  return result.rows.map((row) => String(row.role_slot_id));
}

export async function insertHostNudgeTimelineLog(client, {
  roomId,
  actorId,
  message,
  roleSlotIds
}) {
  const result = await client.query(
    `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata)
     VALUES ($1, $2, 'host', 'host_nudge', $3, $4::jsonb)
     RETURNING id, created_at`,
    [roomId, actorId, message, JSON.stringify({ roleSlotIds })]
  );
  return result.rows[0];
}

export async function insertHostCommunicationAudit(client, {
  roomId,
  actorId,
  action,
  targetId,
  metadata
}) {
  await client.query(
    `INSERT INTO host_audit_log
       (room_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, 'room', $4, $5::jsonb)`,
    [roomId, actorId, action, String(targetId), JSON.stringify(metadata)]
  );
}
