export async function configureHostContentActionTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '30000ms', true)`
  );
}

export async function hasActiveHostMembership(client, { roomId, actorId }) {
  const result = await client.query(
    `SELECT 1
     FROM room_members
     WHERE room_id = $1 AND user_id = $2 AND status = 'active'
       AND member_type IN ('host', 'cohost')`,
    [roomId, actorId]
  );
  return result.rowCount > 0;
}

export async function findClueInRoomWorld(client, { roomId, clueId }) {
  const result = await client.query(
    `SELECT c.id, c.name
     FROM clues c
     JOIN rooms room ON room.world_id = c.world_id
     WHERE c.id = $1 AND room.id = $2`,
    [clueId, roomId]
  );
  return result.rows[0] ?? null;
}

export async function findRoleIdsInRoomWorld(client, { roomId, roleSlotIds }) {
  const result = await client.query(
    `SELECT role_slot.id
     FROM role_slots role_slot
     JOIN rooms room ON room.world_id = role_slot.world_id
     WHERE room.id = $1 AND role_slot.id = ANY($2::uuid[])`,
    [roomId, roleSlotIds]
  );
  return result.rows.map((row) => row.id);
}

export async function grantClueToRoles(client, { roomId, roleSlotIds, clueId }) {
  const result = await client.query(
    `INSERT INTO clue_ownership (room_id, role_slot_id, clue_id, metadata)
     SELECT $1, target.role_slot_id, $3, '{"source":"host_manual"}'::jsonb
     FROM unnest($2::uuid[]) AS target(role_slot_id)
     ON CONFLICT (room_id, role_slot_id, clue_id) DO NOTHING
     RETURNING role_slot_id`,
    [roomId, roleSlotIds, clueId]
  );
  return result.rows.map((row) => row.role_slot_id);
}

export async function revokeClueFromRole(client, { roomId, roleSlotId, clueId }) {
  const result = await client.query(
    `DELETE FROM clue_ownership
     WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
     RETURNING clue_id`,
    [roomId, roleSlotId, clueId]
  );
  return result.rowCount > 0;
}

export async function resendClueToRole(client, { roomId, roleSlotId, clueId }) {
  const result = await client.query(
    `INSERT INTO clue_ownership
       (room_id, role_slot_id, clue_id, acquired_at, metadata)
     VALUES ($1, $2, $3, now(), '{"source":"host_manual","resentCount":1}'::jsonb)
     ON CONFLICT (room_id, role_slot_id, clue_id)
     DO UPDATE SET
       acquired_at = now(),
       metadata = COALESCE(clue_ownership.metadata, '{}'::jsonb)
         || jsonb_build_object(
           'source', 'host_manual',
           'resentCount', CASE
             WHEN clue_ownership.metadata->>'resentCount' ~ '^[0-9]{1,9}$'
               THEN (clue_ownership.metadata->>'resentCount')::int + 1
             ELSE 1
           END
         )
     RETURNING (xmax = 0) AS newly_granted,
               CASE
                 WHEN metadata->>'resentCount' ~ '^[0-9]{1,9}$' THEN (metadata->>'resentCount')::int
                 ELSE 0
               END AS resend_count`,
    [roomId, roleSlotId, clueId]
  );
  return {
    newlyGranted: Boolean(result.rows[0]?.newly_granted),
    resendCount: Number(result.rows[0]?.resend_count || 0)
  };
}

export async function findSectionInRoomRole(client, { roomId, roleSlotId, scriptSectionId }) {
  const result = await client.query(
    `SELECT section.id, section.title, section.sequence,
            EXISTS (
              SELECT 1 FROM room_content_unlocks unlock
              WHERE unlock.room_id = $3
                AND unlock.content_type = 'script_section'
                AND unlock.content_id = section.id
            ) AS unlocked
     FROM script_sections section
     JOIN role_slots role_slot ON role_slot.id = section.role_slot_id
     JOIN rooms room ON room.world_id = role_slot.world_id
     WHERE section.id = $1 AND section.role_slot_id = $2 AND room.id = $3`,
    [scriptSectionId, roleSlotId, roomId]
  );
  return result.rows[0] ?? null;
}

export async function relockSection(client, { roomId, scriptSectionId }) {
  const result = await client.query(
    `DELETE FROM room_content_unlocks
     WHERE room_id = $1 AND content_type = 'script_section' AND content_id = $2
     RETURNING content_id`,
    [roomId, scriptSectionId]
  );
  return result.rowCount > 0;
}

export async function skipSectionProgress(client, { roomId, roleSlotId, scriptSectionId }) {
  const result = await client.query(
    `INSERT INTO reading_progress
       (room_id, role_slot_id, script_section_id, started_at, completed_at)
     VALUES ($1, $2, $3, now(), now())
     ON CONFLICT (room_id, role_slot_id, script_section_id)
     DO UPDATE SET
       started_at = COALESCE(reading_progress.started_at, now()),
       completed_at = now()
     WHERE reading_progress.completed_at IS NULL
     RETURNING completed_at`,
    [roomId, roleSlotId, scriptSectionId]
  );
  return {
    completedAt: result.rows[0]?.completed_at ?? null,
    newlyCompleted: result.rowCount > 0
  };
}

export async function unlockSection(client, { roomId, scriptSectionId }) {
  const result = await client.query(
    `INSERT INTO room_content_unlocks (room_id, content_type, content_id, unlocked_at)
     VALUES ($1, 'script_section', $2, now())
     ON CONFLICT (room_id, content_type, content_id) DO NOTHING
     RETURNING content_id`,
    [roomId, scriptSectionId]
  );
  return result.rowCount > 0;
}

export async function findSceneInRoomWorld(client, { roomId, sceneId }) {
  const result = await client.query(
    `SELECT scene.id, scene.name
     FROM scenes scene
     JOIN rooms room ON room.world_id = scene.world_id
     WHERE scene.id = $1 AND room.id = $2`,
    [sceneId, roomId]
  );
  return result.rows[0] ?? null;
}

export async function unlockScene(client, { roomId, sceneId }) {
  const result = await client.query(
    `INSERT INTO room_content_unlocks (room_id, content_type, content_id, unlocked_at)
     VALUES ($1, 'scene', $2, now())
     ON CONFLICT (room_id, content_type, content_id) DO NOTHING
     RETURNING content_id`,
    [roomId, sceneId]
  );
  return result.rowCount > 0;
}

export async function appendHostContentTimeline(client, {
  roomId,
  actorId,
  eventType,
  message,
  metadata
}) {
  await client.query(
    `INSERT INTO timeline_logs
       (room_id, actor_user_id, visibility, event_type, message, metadata)
     VALUES ($1, $2, 'host', $3, $4, $5::jsonb)`,
    [roomId, actorId, eventType, message, JSON.stringify(metadata ?? {})]
  );
}

export async function appendHostContentAudit(client, {
  roomId,
  actorId,
  action,
  targetType,
  targetId,
  metadata
}) {
  await client.query(
    `INSERT INTO host_audit_log
       (room_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [roomId, actorId, action, targetType, targetId, JSON.stringify(metadata ?? {})]
  );
}
