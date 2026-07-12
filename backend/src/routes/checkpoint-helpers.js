import { pool } from "../db.js";
import { fetchHostPlayers } from "./host-helpers.js";

const SNAPSHOT_QUERIES = (roomId) => ({
  clueRows: [
    `SELECT rs.id AS role_slot_id, rs.name AS role_name, u.display_name AS player_display_name,
            c.id AS clue_id, c.name AS clue_name, co.acquired_at, co.read_at,
            co.shared_with_room, co.shared_with_roles, co.player_note, co.host_note, co.shared_at
     FROM clue_ownership co
     JOIN clues c ON c.id = co.clue_id
     JOIN role_slots rs ON rs.id = co.role_slot_id
     LEFT JOIN room_members rm ON rm.room_id = co.room_id AND rm.role_slot_id = co.role_slot_id AND rm.status = 'active'
     LEFT JOIN users u ON u.id = rm.user_id
     WHERE co.room_id = $1
     ORDER BY co.acquired_at`,
    [roomId]
  ],
  unlockedScenes: [
    `SELECT s.id, s.name, rcu.unlocked_at
     FROM room_content_unlocks rcu
     JOIN scenes s ON s.id = rcu.content_id
     WHERE rcu.room_id = $1 AND rcu.content_type = 'scene'
     ORDER BY rcu.unlocked_at`,
    [roomId]
  ],
  pendingEvents: [
    `SELECT id, rule_id, event_key, title, description, actions, status, created_at, delay_until
     FROM pending_host_events
     WHERE room_id = $1 AND status IN ('pending', 'delayed')
     ORDER BY created_at`,
    [roomId]
  ],
  recentLogs: [
    `SELECT event_type, message, created_at, metadata
     FROM timeline_logs
     WHERE room_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [roomId]
  ],
  timelineLogs: [
    `SELECT visibility, event_type, message, metadata, actor_user_id, created_at
     FROM timeline_logs
     WHERE room_id = $1
     ORDER BY created_at ASC`,
    [roomId]
  ],
  phase: [
    `SELECT ch.id, ch.title, ch.sequence
     FROM reading_progress rp
     JOIN script_sections ss ON ss.id = rp.script_section_id
     LEFT JOIN chapters ch ON ch.id = ss.chapter_id
     WHERE rp.room_id = $1 AND rp.completed_at IS NOT NULL
     ORDER BY rp.completed_at DESC
     LIMIT 1`,
    [roomId]
  ],
  readingProgress: [
    `SELECT role_slot_id, script_section_id, started_at, completed_at
     FROM reading_progress WHERE room_id = $1`,
    [roomId]
  ],
  inventory: [
    `SELECT role_slot_id, item_id, quantity, metadata
     FROM inventory WHERE room_id = $1 AND quantity > 0`,
    [roomId]
  ],
  contentUnlocks: [
    `SELECT content_type, content_id, unlocked_at, unlocked_by_rule_id
     FROM room_content_unlocks WHERE room_id = $1`,
    [roomId]
  ],
  ruleExecutions: [
    `SELECT rule_id, executed_at, result
     FROM rule_executions WHERE room_id = $1
     ORDER BY executed_at DESC LIMIT 50`,
    [roomId]
  ],
  investigationRecords: [
    `SELECT investigation_point_id, role_slot_id, result, investigated_at
     FROM investigation_records WHERE room_id = $1`,
    [roomId]
  ],
  playerStates: [
    `SELECT role_slot_id, current_scene_id, variables, updated_at
     FROM player_states WHERE room_id = $1`,
    [roomId]
  ]
});

async function runSnapshotQueries(queryFn, roomId) {
  const defs = SNAPSHOT_QUERIES(roomId);
  const players = await fetchHostPlayers(queryFn, roomId);
  const parts = { players };
  for (const [key, [text, params]] of Object.entries(defs)) {
    parts[key] = await queryFn(text, params);
  }
  return parts;
}

/** Build a consistent snapshot; queries stay sequential when sharing a transaction client. */
export async function buildRoomCheckpointSnapshot(roomId, options = {}) {
  const client = options.client ?? null;
  const queryFn = client
    ? (text, params) => client.query(text, params)
    : (text, params) => pool.query(text, params);

  const room = await queryFn(
    `SELECT r.id, r.name, r.status, r.world_id FROM rooms r WHERE r.id = $1`,
    [roomId]
  );
  if (!room.rowCount) return null;

  const snapshotParts = await runSnapshotQueries(queryFn, roomId);

    const {
      players,
      clueRows,
      unlockedScenes,
      pendingEvents,
      recentLogs,
      timelineLogs,
      phase,
      readingProgress,
      inventory,
      contentUnlocks,
      ruleExecutions,
      investigationRecords,
      playerStates
    } = snapshotParts;

    return {
      schemaVersion: 2,
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
        readAt: row.read_at,
        sharedWithRoom: row.shared_with_room,
        sharedWithRoles: row.shared_with_roles,
        playerNote: row.player_note,
        hostNote: row.host_note,
        sharedAt: row.shared_at
      })),
      unlockedScenes: unlockedScenes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        unlockedAt: row.unlocked_at
      })),
      pendingEvents: pendingEvents.rows,
      recentLogs: recentLogs.rows,
      timelineLogs: timelineLogs.rows,
      readingProgress: readingProgress.rows,
      inventory: inventory.rows,
      contentUnlocks: contentUnlocks.rows,
      ruleExecutions: ruleExecutions.rows,
      investigationRecords: investigationRecords.rows,
      playerStates: playerStates.rows
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
