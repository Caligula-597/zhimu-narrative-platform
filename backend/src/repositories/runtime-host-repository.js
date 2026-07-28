import { query } from "../db.js";

export async function loadRuntimeHostPlayerFacts(
  roomId,
  roleSlotIds,
  runQuery = query
) {
  if (!roleSlotIds.length) return [];
  const result = await runQuery(
    `WITH requested_role AS (
       SELECT role_slot_id, ordinal
       FROM unnest($2::uuid[]) WITH ORDINALITY requested(role_slot_id, ordinal)
     )
     SELECT requested.role_slot_id,
            member.user_id,
            COALESCE((
              SELECT profile.display_name FROM user_portal_profiles profile
              WHERE profile.user_id = player.id AND profile.portal = 'player'
            ), player.display_name) AS player_display_name,
            member.joined_at,
            (member.user_id IS NOT NULL) AS joined,
            room.status AS room_status,
            state.current_scene_id,
            COALESCE(state.variables->>'hostNotes', '') AS host_notes,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'script_section_id', progress.script_section_id,
                'started_at', progress.started_at,
                'completed_at', progress.completed_at
              ) ORDER BY progress.started_at NULLS FIRST)
              FROM reading_progress progress
              WHERE progress.room_id = room.id
                AND progress.role_slot_id = requested.role_slot_id
            ), '[]'::jsonb) AS progress,
            COALESCE((
              SELECT array_agg(unlock.content_id)
              FROM room_content_unlocks unlock
              WHERE unlock.room_id = room.id
                AND unlock.content_type = 'script_section'
            ), '{}'::uuid[]) AS unlocked_section_ids,
            (SELECT COUNT(*)::int FROM clue_ownership ownership
             WHERE ownership.room_id = room.id
               AND ownership.role_slot_id = requested.role_slot_id) AS clue_count,
            (SELECT COUNT(*)::int FROM clue_ownership ownership
             WHERE ownership.room_id = room.id
               AND ownership.role_slot_id = requested.role_slot_id
               AND ownership.read_at IS NOT NULL) AS read_clue_count,
            (SELECT COUNT(*)::int FROM notebook_entries note
             WHERE note.room_id = room.id
               AND note.role_slot_id = requested.role_slot_id) AS note_count,
            GREATEST(
              member.joined_at,
              (SELECT MAX(GREATEST(progress.started_at, progress.completed_at))
               FROM reading_progress progress
               WHERE progress.room_id = room.id
                 AND progress.role_slot_id = requested.role_slot_id),
              (SELECT MAX(GREATEST(ownership.acquired_at, ownership.read_at))
               FROM clue_ownership ownership
               WHERE ownership.room_id = room.id
                 AND ownership.role_slot_id = requested.role_slot_id),
              (SELECT MAX(record.investigated_at)
               FROM investigation_records record
               WHERE record.room_id = room.id
                 AND record.role_slot_id = requested.role_slot_id),
              (SELECT MAX(note.created_at)
               FROM notebook_entries note
               WHERE note.room_id = room.id
                 AND note.role_slot_id = requested.role_slot_id)
            ) AS last_activity_at,
            latest_log.message AS last_operation_message,
            latest_log.event_type AS last_operation_type
     FROM requested_role requested
     JOIN rooms room ON room.id = $1
     LEFT JOIN room_members member
       ON member.room_id = room.id
      AND member.role_slot_id = requested.role_slot_id
      AND member.status = 'active'
     LEFT JOIN users player ON player.id = member.user_id
     LEFT JOIN player_states state
       ON state.room_id = room.id
      AND state.role_slot_id = requested.role_slot_id
     LEFT JOIN LATERAL (
       SELECT log.message, log.event_type
       FROM timeline_logs log
       WHERE log.room_id = room.id
         AND (
           log.actor_user_id = member.user_id
           OR log.metadata->>'roleSlotId' = requested.role_slot_id::text
         )
       ORDER BY log.created_at DESC
       LIMIT 1
     ) latest_log ON true
     ORDER BY requested.ordinal`,
    [roomId, roleSlotIds]
  );
  return result.rows;
}

export async function loadRuntimeHostClueFacts(roomId, runQuery = query) {
  const result = await runQuery(
    `SELECT
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'role_slot_id', member.role_slot_id,
           'player_display_name', COALESCE((
             SELECT profile.display_name FROM user_portal_profiles profile
             WHERE profile.user_id = player.id AND profile.portal = 'player'
           ), player.display_name),
           'joined', true
         ))
         FROM room_members member
         LEFT JOIN users player ON player.id = member.user_id
         WHERE member.room_id = $1
           AND member.status = 'active'
           AND member.role_slot_id IS NOT NULL
       ), '[]'::jsonb) AS members,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'clue_id', ownership.clue_id,
           'role_slot_id', ownership.role_slot_id,
           'read_flag', ownership.read_at IS NOT NULL,
           'shared_with_room', ownership.shared_with_room,
           'shared_with_roles', ownership.shared_with_roles,
           'player_note', ownership.player_note,
           'host_note', ownership.host_note
         ))
         FROM clue_ownership ownership
         WHERE ownership.room_id = $1
       ), '[]'::jsonb) AS ownership,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'clue_id', receipt.clue_id,
           'role_slot_id', receipt.role_slot_id,
           'read_at', receipt.read_at
         ))
         FROM clue_read_receipts receipt
         WHERE receipt.room_id = $1
       ), '[]'::jsonb) AS receipts`,
    [roomId]
  );
  const row = result.rows[0] ?? {};
  return {
    members: row.members ?? [],
    ownership: row.ownership ?? [],
    receipts: row.receipts ?? []
  };
}
