export async function fetchCreatorAnalyticsData(query, worldId) {
  const [sections, clues, feedback, funnel] = await Promise.all([
    query(
      `SELECT ss.id, ss.title, rs.name AS role_name,
              count(rp.started_at)::int AS started_count,
              count(rp.completed_at)::int AS completed_count
       FROM script_sections ss
       JOIN role_slots rs ON rs.id = ss.role_slot_id
       LEFT JOIN rooms r ON r.world_id = rs.world_id
       LEFT JOIN reading_progress rp ON rp.room_id = r.id AND rp.script_section_id = ss.id
       WHERE rs.world_id = $1
       GROUP BY ss.id, ss.title, rs.name
       ORDER BY completed_count ASC, started_count DESC
       LIMIT 50`,
      [worldId]
    ),
    query(
      `SELECT c.id, c.name,
              count(co.*)::int AS acquired_count,
              count(co.read_at)::int AS read_count
       FROM clues c
       LEFT JOIN rooms r ON r.world_id = c.world_id
       LEFT JOIN clue_ownership co ON co.room_id = r.id AND co.clue_id = c.id
       WHERE c.world_id = $1
       GROUP BY c.id, c.name
       ORDER BY acquired_count ASC, read_count ASC
       LIMIT 50`,
      [worldId]
    ),
    query(
      `SELECT f.kind, f.status, count(*)::int AS count
       FROM feedback f
       JOIN rooms r ON r.id = f.room_id
       WHERE r.world_id = $1
       GROUP BY f.kind, f.status
       ORDER BY f.kind, f.status`,
      [worldId]
    ),
    query(
      `WITH scoped_rooms AS (
         SELECT id FROM rooms WHERE world_id = $1
       ), participants AS (
         SELECT rm.room_id, rm.role_slot_id, MIN(rm.joined_at) AS joined_at
         FROM room_members rm
         JOIN scoped_rooms sr ON sr.id = rm.room_id
         WHERE rm.member_type = 'player' AND rm.role_slot_id IS NOT NULL
         GROUP BY rm.room_id, rm.role_slot_id
       ), reading_milestones AS (
         SELECT p.room_id, p.role_slot_id,
                bool_or(rp.started_at IS NOT NULL) AS started_reading,
                bool_or(ss.sequence = 1 AND rp.completed_at IS NOT NULL) AS completed_opening,
                MIN(rp.completed_at) FILTER (WHERE ss.sequence = 1) AS opening_completed_at
         FROM participants p
         JOIN reading_progress rp ON rp.room_id = p.room_id AND rp.role_slot_id = p.role_slot_id
         JOIN script_sections ss ON ss.id = rp.script_section_id
         GROUP BY p.room_id, p.role_slot_id
       ), investigation_milestones AS (
         SELECT DISTINCT p.room_id, p.role_slot_id
         FROM participants p
         JOIN investigation_records ir ON ir.room_id = p.room_id AND ir.role_slot_id = p.role_slot_id
       ), clue_milestones AS (
         SELECT DISTINCT p.room_id, p.role_slot_id
         FROM participants p
         JOIN clue_ownership co ON co.room_id = p.room_id AND co.role_slot_id = p.role_slot_id
         WHERE co.read_at IS NOT NULL
       ), milestones AS (
         SELECT p.*,
                COALESCE(rm.started_reading, false) AS started_reading,
                COALESCE(rm.completed_opening, false) AS completed_opening,
                (im.room_id IS NOT NULL) AS investigated,
                (cm.room_id IS NOT NULL) AS read_clue,
                rm.opening_completed_at
         FROM participants p
         LEFT JOIN reading_milestones rm USING (room_id, role_slot_id)
         LEFT JOIN investigation_milestones im USING (room_id, role_slot_id)
         LEFT JOIN clue_milestones cm USING (room_id, role_slot_id)
       )
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
                WHERE opening_completed_at IS NOT NULL AND joined_at IS NOT NULL
                  AND opening_completed_at >= joined_at
              )
                AS median_seconds_to_opening_complete
       FROM milestones`,
      [worldId]
    )
  ]);

  return {
    sections: sections.rows,
    clues: clues.rows,
    feedback: feedback.rows,
    funnel: funnel.rows[0]
  };
}
