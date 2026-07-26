import { query } from "../db.js";

export async function loadRuntimeKnowledgeFacts({ roomId, roleSlotId }, runQuery = query) {
  const result = await runQuery(
    `SELECT
       (SELECT jsonb_build_object(
          'user_id', member.user_id,
          'display_name', player.display_name,
          'joined_at', member.joined_at,
          'member_type', member.member_type
        )
        FROM room_members member
        LEFT JOIN users player ON player.id = member.user_id
        WHERE member.room_id = $1
          AND member.role_slot_id = $2
          AND member.status = 'active'
        LIMIT 1) AS member,
       (SELECT jsonb_build_object(
          'current_scene_id', state.current_scene_id,
          'variables', state.variables,
          'updated_at', state.updated_at
        )
        FROM player_states state
        WHERE state.room_id = $1 AND state.role_slot_id = $2) AS player_state,
       COALESCE((
         SELECT jsonb_agg(to_jsonb(progress) ORDER BY progress.started_at NULLS FIRST)
         FROM reading_progress progress
         WHERE progress.room_id = $1 AND progress.role_slot_id = $2
       ), '[]'::jsonb) AS progress,
       COALESCE((
         SELECT jsonb_agg(to_jsonb(unlock) ORDER BY unlock.unlocked_at)
         FROM room_content_unlocks unlock
         WHERE unlock.room_id = $1
           AND unlock.content_type IN ('script_section', 'scene')
       ), '[]'::jsonb) AS unlocks,
       COALESCE((
         SELECT jsonb_agg(to_jsonb(visible_clue) ORDER BY visible_clue.acquired_at DESC)
         FROM (
           SELECT DISTINCT ON (ownership.clue_id)
                  ownership.clue_id,
                  ownership.role_slot_id AS owner_role_slot_id,
                  ownership.acquired_at,
                  CASE WHEN ownership.role_slot_id = $2
                       THEN ownership.read_at ELSE receipt.read_at END AS read_at,
                  ownership.shared_with_room,
                  ownership.shared_with_roles,
                  CASE WHEN ownership.role_slot_id = $2
                       THEN ownership.player_note ELSE '' END AS player_note,
                  ownership.host_note,
                  ownership.shared_at
           FROM clue_ownership ownership
           LEFT JOIN clue_read_receipts receipt
             ON receipt.room_id = ownership.room_id
            AND receipt.clue_id = ownership.clue_id
            AND receipt.role_slot_id = $2
           WHERE ownership.room_id = $1
             AND (
               ownership.role_slot_id = $2
               OR ownership.shared_with_room
               OR $2 = ANY(ownership.shared_with_roles)
             )
           ORDER BY ownership.clue_id,
                    (ownership.role_slot_id = $2) DESC,
                    ownership.acquired_at DESC
         ) visible_clue
       ), '[]'::jsonb) AS clues,
       COALESCE((
         SELECT jsonb_agg(to_jsonb(note) ORDER BY note.created_at DESC)
         FROM notebook_entries note
         WHERE note.room_id = $1 AND note.role_slot_id = $2
       ), '[]'::jsonb) AS notes,
       COALESCE((
         SELECT jsonb_agg(to_jsonb(record) ORDER BY record.investigated_at DESC)
         FROM investigation_records record
         WHERE record.room_id = $1 AND record.role_slot_id = $2
       ), '[]'::jsonb) AS investigations,
       COALESCE((
         SELECT jsonb_agg(to_jsonb(log_row) ORDER BY log_row.created_at DESC)
         FROM (
           SELECT log.event_type, log.message, log.metadata, log.created_at
           FROM timeline_logs log
           LEFT JOIN room_members actor
             ON actor.room_id = log.room_id
            AND actor.user_id = log.actor_user_id
            AND actor.status = 'active'
           WHERE log.room_id = $1
             AND (
               actor.role_slot_id = $2
               OR log.metadata->>'roleSlotId' = $2::text
               OR log.metadata->>'targetRoleSlotId' = $2::text
             )
           ORDER BY log.created_at DESC
           LIMIT 30
         ) log_row
       ), '[]'::jsonb) AS recent_logs`,
    [roomId, roleSlotId]
  );
  return result.rows[0] ?? null;
}
