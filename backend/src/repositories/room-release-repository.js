const ROOM_RELEASE_BINDING_FIELDS = `
  room.id, room.world_id, room.release_id, room.host_user_id, room.name,
  room.invite_code, room.status, room.settings, room.public_listing,
  room.started_at, room.completed_at, room.created_at, room.updated_at,
  world.content_revision AS current_content_revision,
  current_release.release_number,
  current_release.label AS release_label,
  current_release.source_content_revision AS release_source_revision,
  current_release.created_at AS release_created_at`;

export async function configureRoomReleaseTransaction(client, { readOnly = false } = {}) {
  if (readOnly) {
    await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  }
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '15000ms', true)`
  );
}

export async function loadRoomReleaseBinding(client, { worldId, roomId, lock = false }) {
  const result = await client.query(
    `SELECT ${ROOM_RELEASE_BINDING_FIELDS},
            COALESCE((
              SELECT jsonb_agg(member.role_slot_id ORDER BY member.role_slot_id)
              FROM room_members member
              WHERE member.room_id = room.id
                AND member.status = 'active'
                AND member.role_slot_id IS NOT NULL
            ), '[]'::jsonb) AS assigned_role_ids,
            jsonb_build_object(
              'readingProgress', (SELECT COUNT(*)::int FROM reading_progress item WHERE item.room_id = room.id),
              'notebookEntries', (SELECT COUNT(*)::int FROM notebook_entries item WHERE item.room_id = room.id),
              'clueOwnership', (SELECT COUNT(*)::int FROM clue_ownership item WHERE item.room_id = room.id),
              'inventory', (SELECT COUNT(*)::int FROM inventory item WHERE item.room_id = room.id AND item.quantity > 0),
              'contentUnlocks', (SELECT COUNT(*)::int FROM room_content_unlocks item WHERE item.room_id = room.id),
              'investigations', (SELECT COUNT(*)::int FROM investigation_records item WHERE item.room_id = room.id),
              'pendingHostEvents', (SELECT COUNT(*)::int FROM pending_host_events item WHERE item.room_id = room.id),
              'ruleExecutions', (SELECT COUNT(*)::int FROM rule_executions item WHERE item.room_id = room.id),
              'timelineLogs', (SELECT COUNT(*)::int FROM timeline_logs item WHERE item.room_id = room.id),
              'roleStates', (SELECT COUNT(*)::int FROM room_role_states item WHERE item.room_id = room.id),
              'votes', (SELECT COUNT(*)::int FROM room_votes item WHERE item.room_id = room.id),
              'privateActions', (SELECT COUNT(*)::int FROM room_private_actions item WHERE item.room_id = room.id),
              'miniGames', (SELECT COUNT(*)::int FROM room_mini_games item WHERE item.room_id = room.id),
              'taskProgress', (SELECT COUNT(*)::int FROM player_task_progress item WHERE item.room_id = room.id),
              'testimonies', (SELECT COUNT(*)::int FROM testimonies item WHERE item.room_id = room.id),
              'mechanismRuntime', (SELECT COUNT(*)::int FROM room_mechanism_states item WHERE item.room_id = room.id),
              'mechanismActions', (SELECT COUNT(*)::int FROM room_mechanism_action_log item WHERE item.room_id = room.id),
              'checkpoints', (SELECT COUNT(*)::int FROM checkpoints item WHERE item.room_id = room.id)
            ) AS runtime_evidence
     FROM rooms room
     JOIN worlds world ON world.id = room.world_id
     LEFT JOIN world_releases current_release ON current_release.id = room.release_id
     WHERE room.world_id = $1 AND room.id = $2
     ${lock ? "FOR UPDATE OF room" : ""}`,
    [worldId, roomId]
  );
  return result.rows[0] ?? null;
}

export async function loadRoomReleaseSnapshot(client, { worldId, releaseId, lock = false }) {
  const result = await client.query(
    `SELECT release.id, release.world_id, release.release_number, release.label,
            release.source_content_revision, release.snapshot_schema_version,
            release.narrative_profile, release.readiness, release.content_summary,
            release.content_sha256, release.snapshot_bytes,
            release.created_by_user_id, release.created_at, release.snapshot,
            release.release_number = (
              SELECT MAX(latest.release_number)
              FROM world_releases latest
              WHERE latest.world_id = release.world_id
            ) AS is_latest
     FROM world_releases release
     WHERE release.world_id = $1 AND release.id = $2
     ${lock ? "FOR KEY SHARE OF release" : ""}`,
    [worldId, releaseId]
  );
  return result.rows[0] ?? null;
}

export async function lockRoomAssignedRoleIds(client, { roomId }) {
  const result = await client.query(
    `SELECT role_slot_id
     FROM room_members
     WHERE room_id = $1
       AND status = 'active'
       AND role_slot_id IS NOT NULL
     ORDER BY role_slot_id
     FOR SHARE`,
    [roomId]
  );
  return result.rows.map((row) => row.role_slot_id);
}

export async function updateRoomReleaseBinding(client, { roomId, releaseId }) {
  const result = await client.query(
    `WITH updated AS (
       UPDATE rooms
       SET release_id = $2, updated_at = now()
       WHERE id = $1
       RETURNING *
     )
     SELECT updated.*,
            world.content_revision AS current_content_revision,
            release.release_number,
            release.label AS release_label,
            release.source_content_revision AS release_source_revision,
            release.created_at AS release_created_at
     FROM updated
     JOIN worlds world ON world.id = updated.world_id
     JOIN world_releases release ON release.id = updated.release_id`,
    [roomId, releaseId]
  );
  return result.rows[0] ?? null;
}

export async function insertRoomReleaseAudit(client, {
  roomId,
  actorId,
  previousReleaseId,
  targetReleaseId,
  direction,
  impactFingerprint
}) {
  await client.query(
    `INSERT INTO host_audit_log
       (room_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, 'room_content_release_changed', 'world_release', $3, $4::jsonb)`,
    [
      roomId,
      actorId,
      targetReleaseId,
      JSON.stringify({
        previousReleaseId,
        targetReleaseId,
        direction,
        impactFingerprint
      })
    ]
  );
}
