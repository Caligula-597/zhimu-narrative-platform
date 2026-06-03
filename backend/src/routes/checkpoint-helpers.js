import { fetchHostPlayers } from "./host-helpers.js";

export async function buildRoomCheckpointSnapshot(query, roomId) {
  const room = await query(
    `SELECT r.id, r.name, r.status, r.world_id FROM rooms r WHERE r.id = $1`,
    [roomId]
  );
  if (!room.rowCount) return null;

  const [players, clueRows, unlockedScenes, pendingEvents, recentLogs, phase] = await Promise.all([
    fetchHostPlayers(query, roomId),
    query(
      `SELECT rs.id AS role_slot_id, rs.name AS role_name, u.display_name AS player_display_name,
              c.id AS clue_id, c.name AS clue_name, co.acquired_at, co.read_at,
              co.shared_with_room, co.player_note, co.host_note
       FROM clue_ownership co
       JOIN clues c ON c.id = co.clue_id
       JOIN role_slots rs ON rs.id = co.role_slot_id
       LEFT JOIN room_members rm ON rm.room_id = co.room_id AND rm.role_slot_id = co.role_slot_id AND rm.status = 'active'
       LEFT JOIN users u ON u.id = rm.user_id
       WHERE co.room_id = $1
       ORDER BY co.acquired_at`,
      [roomId]
    ),
    query(
      `SELECT s.id, s.name, rcu.unlocked_at
       FROM room_content_unlocks rcu
       JOIN scenes s ON s.id = rcu.content_id
       WHERE rcu.room_id = $1 AND rcu.content_type = 'scene'
       ORDER BY rcu.unlocked_at`,
      [roomId]
    ),
    query(
      `SELECT id, title, description, status, created_at
       FROM pending_host_events
       WHERE room_id = $1 AND status IN ('pending', 'delayed')
       ORDER BY created_at`,
      [roomId]
    ),
    query(
      `SELECT event_type, message, created_at, metadata
       FROM timeline_logs
       WHERE room_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [roomId]
    ),
    query(
      `SELECT ch.id, ch.title, ch.sequence
       FROM reading_progress rp
       JOIN script_sections ss ON ss.id = rp.script_section_id
       LEFT JOIN chapters ch ON ch.id = ss.chapter_id
       WHERE rp.room_id = $1 AND rp.completed_at IS NOT NULL
       ORDER BY rp.completed_at DESC
       LIMIT 1`,
      [roomId]
    )
  ]);

  return {
    roomId,
    roomName: room.rows[0].name,
    roomStatus: room.rows[0].status,
    phase: phase.rowCount && phase.rows[0].id
      ? { chapterId: phase.rows[0].id, chapterTitle: phase.rows[0].title, sequence: phase.rows[0].sequence }
      : null,
    players: players.map((player) => ({
      roleSlotId: player.role_slot_id,
      roleName: player.role_name,
      playerDisplayName: player.player_display_name,
      joined: player.joined,
      completedSections: player.completed_sections,
      totalSections: player.total_sections,
      ownedClues: player.clue_count,
      readClues: player.read_clue_count
    })),
    clueOwnership: clueRows.rows.map((row) => ({
      roleSlotId: row.role_slot_id,
      roleName: row.role_name,
      playerDisplayName: row.player_display_name,
      clueId: row.clue_id,
      clueName: row.clue_name,
      acquiredAt: row.acquired_at,
      readAt: row.read_at
    })),
    unlockedScenes: unlockedScenes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      unlockedAt: row.unlocked_at
    })),
    pendingEvents: pendingEvents.rows,
    recentLogs: recentLogs.rows
  };
}

export function summarizeCheckpoint(snapshot = {}) {
  const players = snapshot.players ?? [];
  const joined = players.filter((player) => player.joined).length;
  const clues = snapshot.clueOwnership?.length ?? players.reduce((sum, player) => sum + (player.ownedClues || 0), 0);
  return {
    joinedPlayers: joined,
    totalRoles: players.length,
    clueCount: clues,
    unlockedSceneCount: (snapshot.unlockedScenes ?? []).length,
    pendingEventCount: (snapshot.pendingEvents ?? []).length
  };
}
