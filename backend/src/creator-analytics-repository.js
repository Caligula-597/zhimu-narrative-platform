import { query } from "./db.js";

export async function fetchCreatorAnalyticsData(runQuery, worldId) {
  const result = await runQuery(
    `WITH section_stats AS (
       SELECT section.id, section.title, role_slot.name AS role_name,
              count(progress.started_at)::int AS started_count,
              count(progress.completed_at)::int AS completed_count
       FROM script_sections section
       JOIN role_slots role_slot ON role_slot.id = section.role_slot_id
       LEFT JOIN rooms room ON room.world_id = role_slot.world_id
       LEFT JOIN reading_progress progress
         ON progress.room_id = room.id AND progress.script_section_id = section.id
       WHERE role_slot.world_id = $1
       GROUP BY section.id, section.title, role_slot.name
       ORDER BY completed_count ASC, started_count DESC
       LIMIT 50
     ), clue_stats AS (
       SELECT clue.id, clue.name,
              count(ownership.*)::int AS acquired_count,
              count(ownership.read_at)::int AS read_count
       FROM clues clue
       LEFT JOIN rooms room ON room.world_id = clue.world_id
       LEFT JOIN clue_ownership ownership
         ON ownership.room_id = room.id AND ownership.clue_id = clue.id
       WHERE clue.world_id = $1
       GROUP BY clue.id, clue.name
       ORDER BY acquired_count ASC, read_count ASC
       LIMIT 50
     ), feedback_stats AS (
       SELECT feedback.kind, feedback.status, count(*)::int AS count
       FROM feedback
       JOIN rooms room ON room.id = feedback.room_id
       WHERE room.world_id = $1
       GROUP BY feedback.kind, feedback.status
     ), scoped_rooms AS (
       SELECT id FROM rooms WHERE world_id = $1
     ), participants AS (
       SELECT member.room_id, member.role_slot_id, MIN(member.joined_at) AS joined_at
       FROM room_members member
       JOIN scoped_rooms room ON room.id = member.room_id
       WHERE member.member_type = 'player' AND member.role_slot_id IS NOT NULL
       GROUP BY member.room_id, member.role_slot_id
     ), reading_milestones AS (
       SELECT participant.room_id, participant.role_slot_id,
              bool_or(progress.started_at IS NOT NULL) AS started_reading,
              bool_or(section.sequence = 1 AND progress.completed_at IS NOT NULL) AS completed_opening,
              MIN(progress.completed_at) FILTER (WHERE section.sequence = 1) AS opening_completed_at
       FROM participants participant
       JOIN reading_progress progress
         ON progress.room_id = participant.room_id
        AND progress.role_slot_id = participant.role_slot_id
       JOIN script_sections section ON section.id = progress.script_section_id
       GROUP BY participant.room_id, participant.role_slot_id
     ), investigation_milestones AS (
       SELECT DISTINCT participant.room_id, participant.role_slot_id
       FROM participants participant
       JOIN investigation_records record
         ON record.room_id = participant.room_id
        AND record.role_slot_id = participant.role_slot_id
     ), clue_milestones AS (
       SELECT DISTINCT participant.room_id, participant.role_slot_id
       FROM participants participant
       JOIN clue_ownership ownership
         ON ownership.room_id = participant.room_id
        AND ownership.role_slot_id = participant.role_slot_id
       WHERE ownership.read_at IS NOT NULL
     ), milestones AS (
       SELECT participant.*,
              COALESCE(reading.started_reading, false) AS started_reading,
              COALESCE(reading.completed_opening, false) AS completed_opening,
              (investigation.room_id IS NOT NULL) AS investigated,
              (clue.room_id IS NOT NULL) AS read_clue,
              reading.opening_completed_at
       FROM participants participant
       LEFT JOIN reading_milestones reading USING (room_id, role_slot_id)
       LEFT JOIN investigation_milestones investigation USING (room_id, role_slot_id)
       LEFT JOIN clue_milestones clue USING (room_id, role_slot_id)
     ), funnel AS (
       SELECT (SELECT count(*)::int FROM scoped_rooms) AS room_count,
              count(DISTINCT room_id)::int AS rooms_with_players,
              count(*)::int AS joined_players,
              count(*) FILTER (WHERE started_reading)::int AS started_reading,
              count(*) FILTER (WHERE completed_opening)::int AS completed_opening,
              count(*) FILTER (WHERE investigated)::int AS investigated,
              count(*) FILTER (WHERE read_clue)::int AS read_clue,
              percentile_cont(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (opening_completed_at - joined_at))
              ) FILTER (
                WHERE opening_completed_at IS NOT NULL
                  AND joined_at IS NOT NULL
                  AND opening_completed_at >= joined_at
              ) AS median_seconds_to_opening_complete
       FROM milestones
     )
     SELECT
       COALESCE((
         SELECT jsonb_agg(to_jsonb(section_stats)
           ORDER BY completed_count ASC, started_count DESC)
         FROM section_stats
       ), '[]'::jsonb) AS sections,
       COALESCE((
         SELECT jsonb_agg(to_jsonb(clue_stats)
           ORDER BY acquired_count ASC, read_count ASC)
         FROM clue_stats
       ), '[]'::jsonb) AS clues,
       COALESCE((
         SELECT jsonb_agg(to_jsonb(feedback_stats) ORDER BY kind, status)
         FROM feedback_stats
       ), '[]'::jsonb) AS feedback,
       COALESCE((SELECT to_jsonb(funnel) FROM funnel), '{}'::jsonb) AS funnel`,
    [worldId]
  );
  const row = result.rows[0] ?? {};
  return {
    sections: row.sections ?? [],
    clues: row.clues ?? [],
    feedback: row.feedback ?? [],
    funnel: row.funnel ?? {}
  };
}

export function getCreatorAnalyticsData(worldId) {
  return fetchCreatorAnalyticsData(query, worldId);
}
