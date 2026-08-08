import { query } from "../db.js";

export async function loadRuntimeStateFacts({ roomId, roleSlotId = null }, runQuery = query) {
  const result = await runQuery(
    `SELECT
       (SELECT COUNT(*)::int
        FROM room_members member
        WHERE member.room_id = $1
          AND member.status = 'active'
          AND member.role_slot_id IS NOT NULL) AS joined_players,
       (SELECT COUNT(*)::int
        FROM role_slots role
        JOIN rooms room ON room.world_id = role.world_id
        WHERE room.id = $1) AS total_roles,
       (SELECT COUNT(*)::int
        FROM pending_host_events event
        WHERE event.room_id = $1 AND event.status = 'pending') AS pending_host_events,
       (SELECT COUNT(*)::int
        FROM room_private_actions action
        WHERE action.room_id = $1
          AND action.status IN ('submitted', 'seen')) AS pending_private_actions,
       (SELECT COUNT(*)::int
        FROM room_votes vote
        WHERE vote.room_id = $1 AND vote.status = 'open') AS open_votes,
       (SELECT COUNT(*)::int
        FROM room_votes vote
        WHERE vote.room_id = $1
          AND vote.status = 'open'
          AND $2::uuid IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM room_vote_ballots ballot
            WHERE ballot.vote_id = vote.id AND ballot.role_slot_id = $2::uuid
          )) AS player_open_votes,
       (SELECT to_jsonb(game)
        FROM room_mini_games game
        WHERE game.room_id = $1 AND game.status = 'active'
        ORDER BY game.updated_at DESC
        LIMIT 1) AS active_game,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'script_section_id', progress.script_section_id,
           'started_at', progress.started_at,
           'completed_at', progress.completed_at
         ))
         FROM reading_progress progress
         WHERE progress.room_id = $1
           AND ($2::uuid IS NULL OR progress.role_slot_id = $2::uuid)
       ), '[]'::jsonb) AS player_progress,
       COALESCE((
         SELECT array_agg(unlock.content_id)
         FROM room_content_unlocks unlock
         WHERE unlock.room_id = $1
           AND unlock.content_type = 'script_section'
       ), '{}'::uuid[]) AS unlocked_section_ids,
       (SELECT section.title
        FROM script_sections section
        JOIN rooms room ON room.id = $1
        LEFT JOIN reading_progress progress
          ON progress.room_id = room.id
         AND progress.role_slot_id = $2::uuid
         AND progress.script_section_id = section.id
        WHERE $2::uuid IS NOT NULL
          AND section.role_slot_id = $2::uuid
          AND (
            section.publication_status = 'published'
            OR (room.status = 'testing' AND section.publication_status = 'testing')
          )
          AND (
            section.sequence = 1
            OR EXISTS (
              SELECT 1 FROM room_content_unlocks unlock
              WHERE unlock.room_id = room.id
                AND unlock.content_type = 'script_section'
                AND unlock.content_id = section.id
            )
          )
          AND progress.completed_at IS NULL
        ORDER BY section.sequence
        LIMIT 1) AS live_next_section_title,
       (SELECT COUNT(*)::int
        FROM reading_progress progress
        WHERE progress.room_id = $1
          AND progress.role_slot_id = $2::uuid
          AND progress.completed_at IS NOT NULL) AS live_completed_sections,
       (SELECT to_jsonb(mechanism_state)
        FROM room_mechanism_states mechanism_state
        WHERE mechanism_state.room_id = $1) AS mechanism_state,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'decisionKey', submission.decision_key,
           'optionKey', submission.option_key,
           'answer', submission.answer,
           'submittedAt', submission.updated_at
         ))
         FROM room_mechanism_decision_submissions submission
         JOIN room_mechanism_states mechanism_state
           ON mechanism_state.room_id = submission.room_id
          AND mechanism_state.initialized_at = submission.runtime_initialized_at
         WHERE submission.room_id = $1
           AND $2::uuid IS NOT NULL
           AND submission.role_slot_id = $2::uuid
       ), '[]'::jsonb) AS mechanism_submissions,
       (SELECT COALESCE(MAX(journal.id), 0)
        FROM room_event_journal journal
        WHERE journal.room_id = $1) AS server_cursor`,
    [roomId, roleSlotId]
  );
  return result.rows[0] ?? {};
}
