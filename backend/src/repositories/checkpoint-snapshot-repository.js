import { query } from "../db.js";

function run(client, text, params = []) {
  return client ? client.query(text, params) : query(text, params);
}

const SNAPSHOT_ARRAY = "'[]'::jsonb";

/**
 * One statement captures every checkpoint component from the same PostgreSQL
 * statement snapshot. This replaces the former 14 sequential round trips.
 */
export async function loadRoomCheckpointSnapshot(roomId, { client = null, includeTimelineLogs = true } = {}) {
  const result = await run(
    client,
    `SELECT room.id,
            room.name,
            room.status,
            room.world_id,
            COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'roleSlotId', rs.id,
                  'roleName', rs.name,
                  'playerDisplayName', member.display_name,
                  'joined', member.user_id IS NOT NULL,
                  'completedSections', (
                    SELECT COUNT(*)::int
                    FROM reading_progress progress
                    WHERE progress.room_id = room.id
                      AND progress.role_slot_id = rs.id
                      AND progress.completed_at IS NOT NULL
                  ),
                  'totalSections', (
                    SELECT COUNT(*)::int FROM script_sections section
                    WHERE section.role_slot_id = rs.id
                  ),
                  'ownedClues', (
                    SELECT COUNT(*)::int FROM clue_ownership owned
                    WHERE owned.room_id = room.id AND owned.role_slot_id = rs.id
                  ),
                  'readClues', (
                    SELECT COUNT(*)::int FROM clue_ownership owned
                    WHERE owned.room_id = room.id AND owned.role_slot_id = rs.id
                      AND owned.read_at IS NOT NULL
                  )
                ) ORDER BY rs.sequence, rs.created_at
              )
              FROM role_slots rs
              LEFT JOIN LATERAL (
                SELECT rm.user_id, usr.display_name
                FROM room_members rm
                LEFT JOIN users usr ON usr.id = rm.user_id
                WHERE rm.room_id = room.id AND rm.role_slot_id = rs.id AND rm.status = 'active'
                LIMIT 1
              ) member ON true
              WHERE rs.world_id = room.world_id
            ), ${SNAPSHOT_ARRAY}) AS players,
            COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'roleSlotId', ownership.role_slot_id,
                  'roleName', role.name,
                  'playerDisplayName', member.display_name,
                  'clueId', ownership.clue_id,
                  'clueName', clue.name,
                  'acquiredAt', ownership.acquired_at,
                  'readAt', ownership.read_at,
                  'sharedWithRoom', ownership.shared_with_room,
                  'sharedWithRoles', ownership.shared_with_roles,
                  'playerNote', ownership.player_note,
                  'hostNote', ownership.host_note,
                  'sharedAt', ownership.shared_at
                ) ORDER BY ownership.acquired_at
              )
              FROM clue_ownership ownership
              JOIN clues clue ON clue.id = ownership.clue_id
              JOIN role_slots role ON role.id = ownership.role_slot_id
              LEFT JOIN LATERAL (
                SELECT usr.display_name
                FROM room_members rm
                LEFT JOIN users usr ON usr.id = rm.user_id
                WHERE rm.room_id = room.id
                  AND rm.role_slot_id = ownership.role_slot_id
                  AND rm.status = 'active'
                LIMIT 1
              ) member ON true
              WHERE ownership.room_id = room.id
            ), ${SNAPSHOT_ARRAY}) AS clue_ownership,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', scene.id, 'name', scene.name, 'unlockedAt', unlock.unlocked_at
              ) ORDER BY unlock.unlocked_at)
              FROM room_content_unlocks unlock
              JOIN scenes scene ON scene.id = unlock.content_id
              WHERE unlock.room_id = room.id AND unlock.content_type = 'scene'
            ), ${SNAPSHOT_ARRAY}) AS unlocked_scenes,
            COALESCE((
              SELECT jsonb_agg(to_jsonb(event) ORDER BY event.created_at)
              FROM (
                SELECT id, rule_id, event_key, title, description, actions, status, created_at, delay_until
                FROM pending_host_events
                WHERE room_id = room.id AND status IN ('pending', 'delayed')
              ) event
            ), ${SNAPSHOT_ARRAY}) AS pending_events,
            COALESCE((
              SELECT jsonb_agg(to_jsonb(log_row) ORDER BY log_row.created_at DESC)
              FROM (
                SELECT event_type, message, created_at, metadata
                FROM timeline_logs
                WHERE room_id = room.id
                ORDER BY created_at DESC
                LIMIT 20
              ) log_row
            ), ${SNAPSHOT_ARRAY}) AS recent_logs,
            COALESCE((
              SELECT jsonb_agg(to_jsonb(log_row) ORDER BY log_row.created_at)
              FROM (
                SELECT visibility, event_type, message, metadata, actor_user_id, created_at
                FROM timeline_logs
                WHERE $2::boolean AND room_id = room.id
                ORDER BY created_at DESC
                LIMIT 5000
              ) log_row
            ), ${SNAPSHOT_ARRAY}) AS timeline_logs,
            CASE WHEN $2::boolean THEN EXISTS (
              SELECT 1 FROM timeline_logs
              WHERE room_id = room.id
              ORDER BY created_at DESC
              OFFSET 5000 LIMIT 1
            ) ELSE false END AS timeline_logs_truncated,
            (
              SELECT jsonb_build_object(
                'chapterId', chapter.id,
                'chapterTitle', chapter.title,
                'sequence', chapter.sequence
              )
              FROM reading_progress progress
              JOIN script_sections section ON section.id = progress.script_section_id
              LEFT JOIN chapters chapter ON chapter.id = section.chapter_id
              WHERE progress.room_id = room.id AND progress.completed_at IS NOT NULL
                AND chapter.id IS NOT NULL
              ORDER BY progress.completed_at DESC
              LIMIT 1
            ) AS phase,
            COALESCE((
              SELECT jsonb_agg(to_jsonb(progress))
              FROM (
                SELECT role_slot_id, script_section_id, started_at, completed_at
                FROM reading_progress WHERE room_id = room.id
              ) progress
            ), ${SNAPSHOT_ARRAY}) AS reading_progress,
            COALESCE((
              SELECT jsonb_agg(to_jsonb(item))
              FROM (
                SELECT role_slot_id, item_id, quantity, metadata
                FROM inventory WHERE room_id = room.id AND quantity > 0
              ) item
            ), ${SNAPSHOT_ARRAY}) AS inventory,
            COALESCE((
              SELECT jsonb_agg(to_jsonb(unlock))
              FROM (
                SELECT content_type, content_id, unlocked_at, unlocked_by_rule_id
                FROM room_content_unlocks WHERE room_id = room.id
              ) unlock
            ), ${SNAPSHOT_ARRAY}) AS content_unlocks,
            COALESCE((
              SELECT jsonb_agg(to_jsonb(execution) ORDER BY execution.executed_at DESC)
              FROM (
                SELECT rule_id, executed_at, result
                FROM rule_executions
                WHERE room_id = room.id
                ORDER BY executed_at DESC
                LIMIT 50
              ) execution
            ), ${SNAPSHOT_ARRAY}) AS rule_executions,
            COALESCE((
              SELECT jsonb_agg(to_jsonb(record))
              FROM (
                SELECT investigation_point_id, role_slot_id, result, investigated_at
                FROM investigation_records WHERE room_id = room.id
              ) record
            ), ${SNAPSHOT_ARRAY}) AS investigation_records,
            COALESCE((
              SELECT jsonb_agg(to_jsonb(state))
              FROM (
                SELECT role_slot_id, current_scene_id, variables, updated_at
                FROM player_states WHERE room_id = room.id
              ) state
            ), ${SNAPSHOT_ARRAY}) AS player_states,
            (
              SELECT jsonb_build_object(
                'mechanismSchemaVersion', mechanism.mechanism_schema_version,
                'contentBindingMode', mechanism.content_binding_mode,
                'contentReleaseId', mechanism.content_release_id,
                'sourceContentRevision', mechanism.source_content_revision,
                'mechanismPackageSha256', mechanism.mechanism_package_sha256,
                'capturedRevision', mechanism.revision,
                'runtime', jsonb_build_object(
                  'schemaVersion', 1,
                  'mechanismSchemaVersion', mechanism.mechanism_schema_version,
                  'status', mechanism.status,
                  'currentRoundKey', mechanism.current_round_key,
                  'currentRoundSequence', mechanism.current_round_sequence,
                  'preparedRoundKey', mechanism.prepared_round_key,
                  'currentBranch', mechanism.current_branch,
                  'currentVariantKey', mechanism.current_variant_key,
                  'states', mechanism.state_values,
                  'resources', mechanism.resource_values,
                  'evidence', mechanism.evidence_states,
                  'events', mechanism.event_states,
                  'decisionStates', mechanism.decision_states,
                  'executedInvestigations', mechanism.executed_investigations,
                  'investigationUseCounts', mechanism.investigation_use_counts,
                  'ending', mechanism.ending
                )
              )
              FROM room_mechanism_states mechanism
              WHERE mechanism.room_id = room.id
            ) AS mechanism_runtime
     FROM rooms room
     WHERE room.id = $1`,
    [roomId, includeTimelineLogs]
  );
  return result.rows[0] ?? null;
}
