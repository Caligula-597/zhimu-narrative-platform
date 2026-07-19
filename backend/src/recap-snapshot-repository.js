import { createQueryScheduler } from "./recap-query-scheduler.js";

export async function fetchRoomRecapRows(query, roomId) {
  const roomRow = await query(
    `SELECT r.id, r.name, r.status, r.world_id, r.invite_code, r.created_at,
            w.name AS world_name, w.summary AS world_summary, w.settings AS world_settings
     FROM rooms r
     JOIN worlds w ON w.id = r.world_id
     WHERE r.id = $1`,
    [roomId]
  );
  if (!roomRow.rowCount) return null;

  const room = roomRow.rows[0];
  // Recap generation runs inside one repeatable-read transaction. Keeping this
  // scheduler at one avoids a single expensive report consuming most of the
  // six-connection application pool.
  const scheduleQuery = createQueryScheduler({ concurrency: 1 });
  const playersPromise = scheduleQuery(async () => {
    const result = await query(
      `WITH section_counts AS (
         SELECT role_slot_id, COUNT(*)::int AS total_sections
         FROM script_sections
         GROUP BY role_slot_id
       ), progress_counts AS (
         SELECT rp.role_slot_id,
                COUNT(*) FILTER (WHERE rp.completed_at IS NOT NULL)::int AS completed_sections,
                MAX(GREATEST(rp.started_at, rp.completed_at)) AS last_activity_at
         FROM reading_progress rp
         WHERE rp.room_id = $1
         GROUP BY rp.role_slot_id
       ), clue_counts AS (
         SELECT role_slot_id,
                COUNT(*)::int AS clue_count,
                COUNT(*) FILTER (WHERE read_at IS NOT NULL)::int AS read_clue_count,
                MAX(GREATEST(acquired_at, read_at)) AS last_activity_at
         FROM clue_ownership
         WHERE room_id = $1
         GROUP BY role_slot_id
       ), note_counts AS (
         SELECT role_slot_id,
                COUNT(*)::int AS note_count,
                MAX(created_at) AS last_activity_at
         FROM notebook_entries
         WHERE room_id = $1
         GROUP BY role_slot_id
       ), investigation_activity AS (
         SELECT role_slot_id, MAX(investigated_at) AS last_activity_at
         FROM investigation_records
         WHERE room_id = $1
         GROUP BY role_slot_id
       )
       SELECT rs.id AS role_slot_id,
              rs.name AS role_name,
              rm.user_id,
              u.display_name AS player_display_name,
              rm.joined_at,
              (rm.user_id IS NOT NULL) AS joined,
              COALESCE(sc.total_sections, 0) AS total_sections,
              COALESCE(pc.completed_sections, 0) AS completed_sections,
              COALESCE(cc.clue_count, 0) AS clue_count,
              COALESCE(cc.read_clue_count, 0) AS read_clue_count,
              COALESCE(nc.note_count, 0) AS note_count,
              GREATEST(
                rm.joined_at,
                pc.last_activity_at,
                cc.last_activity_at,
                nc.last_activity_at,
                ia.last_activity_at
              ) AS last_activity_at
       FROM role_slots rs
       JOIN rooms room ON room.world_id = rs.world_id
       LEFT JOIN room_members rm
         ON rm.room_id = room.id AND rm.role_slot_id = rs.id AND rm.status = 'active'
       LEFT JOIN users u ON u.id = rm.user_id
       LEFT JOIN section_counts sc ON sc.role_slot_id = rs.id
       LEFT JOIN progress_counts pc ON pc.role_slot_id = rs.id
       LEFT JOIN clue_counts cc ON cc.role_slot_id = rs.id
       LEFT JOIN note_counts nc ON nc.role_slot_id = rs.id
       LEFT JOIN investigation_activity ia ON ia.role_slot_id = rs.id
       WHERE room.id = $1
       ORDER BY rs.sequence, rs.created_at`,
      [roomId]
    );
    return result.rows;
  });
  const clueRowsPromise = scheduleQuery(() => query(
    `SELECT c.id AS clue_id, c.name AS clue_name, c.metadata AS clue_metadata,
            rs.id AS role_slot_id, rs.name AS role_name, u.display_name AS player_display_name,
            co.acquired_at, co.read_at, co.shared_with_room, co.metadata AS ownership_metadata
     FROM clue_ownership co
     JOIN clues c ON c.id = co.clue_id
     JOIN role_slots rs ON rs.id = co.role_slot_id
     LEFT JOIN room_members rm ON rm.room_id = co.room_id AND rm.role_slot_id = co.role_slot_id AND rm.status = 'active'
     LEFT JOIN users u ON u.id = rm.user_id
     WHERE co.room_id = $1
     ORDER BY co.acquired_at ASC, c.name ASC`,
    [roomId]
  ));
  const undiscoveredCluesPromise = scheduleQuery(() => query(
    `SELECT c.id AS clue_id, c.name AS clue_name, c.metadata AS clue_metadata
     FROM clues c
     JOIN rooms r ON r.world_id = c.world_id
     WHERE r.id = $1
       AND NOT EXISTS (
         SELECT 1 FROM clue_ownership co
         WHERE co.room_id = $1 AND co.clue_id = c.id
       )
     ORDER BY c.name`,
    [roomId]
  ));
  const hostEventsPromise = scheduleQuery(() => query(
    `SELECT phe.id, phe.title, phe.description, phe.status, phe.actions,
            phe.created_at, phe.resolved_at, ar.name AS rule_name
     FROM pending_host_events phe
     LEFT JOIN automation_rules ar ON ar.id = phe.rule_id
     WHERE phe.room_id = $1 AND phe.status IN ('executed', 'dismissed')
     ORDER BY COALESCE(phe.resolved_at, phe.created_at) ASC`,
    [roomId]
  ));
  const ruleTriggersPromise = scheduleQuery(() => query(
    `SELECT re.executed_at, ar.id AS rule_id, ar.name AS rule_name, ar.mode, ar.conditions, ar.actions, re.result
     FROM rule_executions re
     JOIN automation_rules ar ON ar.id = re.rule_id
     WHERE re.room_id = $1
     ORDER BY re.executed_at ASC`,
    [roomId]
  ));
  const investigationsPromise = scheduleQuery(() => query(
    `SELECT ir.investigated_at, ip.id AS point_id, ip.name AS point_name, s.name AS scene_name,
            rs.id AS role_slot_id, rs.name AS role_name, u.display_name AS player_display_name
     FROM investigation_records ir
     JOIN investigation_points ip ON ip.id = ir.investigation_point_id
     JOIN scenes s ON s.id = ip.scene_id
     JOIN role_slots rs ON rs.id = ir.role_slot_id
     LEFT JOIN room_members rm ON rm.room_id = ir.room_id AND rm.role_slot_id = ir.role_slot_id AND rm.status = 'active'
     LEFT JOIN users u ON u.id = rm.user_id
     WHERE ir.room_id = $1
     ORDER BY ir.investigated_at ASC`,
    [roomId]
  ));
  const notesPromise = scheduleQuery(() => query(
    `SELECT ne.id, ne.title, ne.body, ne.source_type, ne.created_at,
            rs.id AS role_slot_id, rs.name AS role_name, u.display_name AS player_display_name
     FROM notebook_entries ne
     JOIN role_slots rs ON rs.id = ne.role_slot_id
     LEFT JOIN room_members rm ON rm.room_id = ne.room_id AND rm.role_slot_id = ne.role_slot_id AND rm.status = 'active'
     LEFT JOIN users u ON u.id = rm.user_id
     WHERE ne.room_id = $1
     ORDER BY ne.created_at ASC`,
    [roomId]
  ));
  const unlockedScenesPromise = scheduleQuery(() => query(
    `SELECT s.id, s.name, rcu.unlocked_at
     FROM room_content_unlocks rcu
     JOIN scenes s ON s.id = rcu.content_id
     WHERE rcu.room_id = $1 AND rcu.content_type = 'scene'
     ORDER BY rcu.unlocked_at ASC`,
    [roomId]
  ));
  const timelineLogsPromise = scheduleQuery(() => query(
    `SELECT tl.id, tl.event_type, tl.message, tl.visibility, tl.created_at, tl.metadata,
            u.display_name AS actor_name
     FROM timeline_logs tl
     LEFT JOIN users u ON u.id = tl.actor_user_id
     WHERE tl.room_id = $1
     ORDER BY tl.created_at ASC`,
    [roomId]
  ));
  const readingCompletionsPromise = scheduleQuery(() => query(
    `SELECT rp.completed_at, ss.id AS section_id, ss.title AS section_title, ss.sequence,
            ss.chapter_id, ch.title AS chapter_title, ch.sequence AS chapter_sequence,
            rs.id AS role_slot_id, rs.name AS role_name, u.display_name AS player_display_name
     FROM reading_progress rp
     JOIN script_sections ss ON ss.id = rp.script_section_id
     LEFT JOIN chapters ch ON ch.id = ss.chapter_id
     JOIN role_slots rs ON rs.id = rp.role_slot_id
     LEFT JOIN room_members rm ON rm.room_id = rp.room_id AND rm.role_slot_id = rp.role_slot_id AND rm.status = 'active'
     LEFT JOIN users u ON u.id = rm.user_id
     WHERE rp.room_id = $1 AND rp.completed_at IS NOT NULL
     ORDER BY rp.completed_at ASC`,
    [roomId]
  ));
  const chapterRowsPromise = scheduleQuery(() => query(
    `SELECT ch.id, ch.title, ch.summary, ch.sequence, ch.metadata,
            (SELECT COUNT(*)::int
             FROM script_sections ss
             JOIN role_slots rs ON rs.id = ss.role_slot_id
             WHERE ss.chapter_id = ch.id AND rs.world_id = ch.world_id) AS section_count
     FROM chapters ch
     WHERE ch.world_id = $1
     ORDER BY ch.sequence ASC, ch.created_at ASC`,
    [room.world_id]
  ));
  const sceneRowsPromise = scheduleQuery(() => query(
    `SELECT s.id, s.name, s.chapter_id, s.public_text, s.host_text, s.metadata,
            ch.sequence AS chapter_sequence, ch.title AS chapter_title
     FROM scenes s
     LEFT JOIN chapters ch ON ch.id = s.chapter_id
     WHERE s.world_id = $1
     ORDER BY ch.sequence NULLS LAST, s.created_at ASC`,
    [room.world_id]
  ));
  const worldClueRowsPromise = scheduleQuery(() => query(
    `SELECT id, name, public_text, host_text, visibility, metadata
     FROM clues
     WHERE world_id = $1
     ORDER BY created_at ASC`,
    [room.world_id]
  ));
  const finalChapterPromise = scheduleQuery(() => query(
    `SELECT ch.id, ch.title, ch.sequence
     FROM reading_progress rp
     JOIN script_sections ss ON ss.id = rp.script_section_id
     LEFT JOIN chapters ch ON ch.id = ss.chapter_id
     WHERE rp.room_id = $1 AND rp.completed_at IS NOT NULL
     ORDER BY rp.completed_at DESC
     LIMIT 1`,
    [roomId]
  ));

  const [
    players, clueRows, undiscoveredClues, hostEvents, ruleTriggers,
    investigations, notes, unlockedScenes, timelineLogs, readingCompletions,
    chapterRows, sceneRows, worldClueRows, finalChapter
  ] = await Promise.all([
    playersPromise, clueRowsPromise, undiscoveredCluesPromise, hostEventsPromise,
    ruleTriggersPromise, investigationsPromise, notesPromise, unlockedScenesPromise,
    timelineLogsPromise, readingCompletionsPromise, chapterRowsPromise,
    sceneRowsPromise, worldClueRowsPromise, finalChapterPromise
  ]);
  return {
    room,
    players,
    clueRows,
    undiscoveredClues,
    hostEvents,
    ruleTriggers,
    investigations,
    notes,
    unlockedScenes,
    timelineLogs,
    readingCompletions,
    chapterRows,
    sceneRows,
    worldClueRows,
    finalChapter
  };
}
