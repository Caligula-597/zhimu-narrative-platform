import { query } from "../db.js";
import { listRoomVotesWith } from "./content-platform-vote-repository.js";

export async function fetchRoomRunReportDataWith(runQuery, roomId) {
  const [summary, votes] = await Promise.all([
    runQuery(
      `WITH room_world AS (
         SELECT world_id FROM rooms WHERE id = $1
       ), reading_stats AS (
         SELECT section.id, section.title,
                count(progress.*)::int AS started_count,
                count(progress.completed_at)::int AS completed_count
         FROM room_world room
         JOIN role_slots role_slot ON role_slot.world_id = room.world_id
         JOIN script_sections section ON section.role_slot_id = role_slot.id
         LEFT JOIN reading_progress progress
           ON progress.script_section_id = section.id AND progress.room_id = $1
         GROUP BY section.id, section.title
       ), clue_stats AS (
         SELECT clue.id, clue.name,
                count(ownership.*)::int AS acquired_count,
                count(ownership.read_at)::int AS read_count
         FROM room_world room
         JOIN clues clue ON clue.world_id = room.world_id
         LEFT JOIN clue_ownership ownership
           ON ownership.clue_id = clue.id AND ownership.room_id = $1
         GROUP BY clue.id, clue.name
       )
       SELECT
         COALESCE((
           SELECT jsonb_agg(to_jsonb(reading_stats)
             ORDER BY completed_count ASC, started_count DESC)
           FROM reading_stats
         ), '[]'::jsonb) AS reading,
         COALESCE((
           SELECT jsonb_agg(to_jsonb(clue_stats)
             ORDER BY acquired_count ASC, read_count ASC)
           FROM clue_stats
         ), '[]'::jsonb) AS clues`,
      [roomId]
    ),
    listRoomVotesWith(runQuery, roomId, { host: true })
  ]);

  return {
    reading: summary.rows[0]?.reading ?? [],
    clues: summary.rows[0]?.clues ?? [],
    votes
  };
}

export function fetchRoomRunReportData(roomId) {
  return fetchRoomRunReportDataWith(query, roomId);
}
