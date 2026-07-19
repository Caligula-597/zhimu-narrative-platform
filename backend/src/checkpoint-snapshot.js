import { loadRoomCheckpointSnapshot } from "./repositories/checkpoint-snapshot-repository.js";

export async function buildRoomCheckpointSnapshot(roomId, options = {}) {
  const row = await loadRoomCheckpointSnapshot(roomId, options);
  if (!row) return null;
  return {
    schemaVersion: 2,
    roomId,
    roomName: row.name,
    roomStatus: row.status,
    phase: row.phase ?? null,
    players: row.players ?? [],
    clueOwnership: row.clue_ownership ?? [],
    unlockedScenes: row.unlocked_scenes ?? [],
    pendingEvents: row.pending_events ?? [],
    recentLogs: row.recent_logs ?? [],
    timelineLogs: row.timeline_logs ?? [],
    timelineLogsTruncated: row.timeline_logs_truncated === true,
    readingProgress: row.reading_progress ?? [],
    inventory: row.inventory ?? [],
    contentUnlocks: row.content_unlocks ?? [],
    ruleExecutions: row.rule_executions ?? [],
    investigationRecords: row.investigation_records ?? [],
    playerStates: row.player_states ?? []
  };
}

export function summarizeCheckpoint(snapshot = {}) {
  const players = Array.isArray(snapshot.players) ? snapshot.players : [];
  const clueOwnership = Array.isArray(snapshot.clueOwnership) ? snapshot.clueOwnership : null;
  return {
    joinedPlayers: players.filter((player) => player?.joined).length,
    totalRoles: players.length,
    clueCount: clueOwnership?.length
      ?? players.reduce((sum, player) => sum + (Number(player?.ownedClues) || 0), 0),
    unlockedSceneCount: Array.isArray(snapshot.unlockedScenes) ? snapshot.unlockedScenes.length : 0,
    pendingEventCount: Array.isArray(snapshot.pendingEvents) ? snapshot.pendingEvents.length : 0
  };
}
