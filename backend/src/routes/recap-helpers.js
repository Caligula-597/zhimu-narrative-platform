import { summarizeHostAction } from "./host-helpers.js";
import { applyRoleRankings } from "../recap-narrative.js";
import { fetchRoomRecapRows } from "../recap-snapshot-repository.js";
export { filterRecapForPlayer, summarizeRecap } from "../recap-projection-service.js";
import { buildKeyTimeline } from "../recap-timeline-service.js";
import { buildStoryNarrative } from "../recap-story-service.js";
import { buildRolePerformances } from "../recap-role-performance-service.js";

function summarizeRuleConditions(conditions = {}) {
  const parts = (conditions.all ?? []).map((row) => {
    if (row.type === "reading_completed") return "完成阅读";
    if (row.type === "clue_owned") return "持有线索";
    if (row.type === "investigation_completed") return "完成调查";
    if (row.type === "item_owned") return "持有物品";
    return row.type;
  });
  return parts.join(" 且 ") || "（无条件）";
}
function summarizeRuleActions(actions = []) {
  return (actions ?? []).map((action) => summarizeHostAction(action)).join(" → ") || "（无动作）";
}

export async function buildRoomRecapSnapshot(query, roomId) {
  const rows = await fetchRoomRecapRows(query, roomId);
  if (!rows) return null;
  const {
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
  } = rows;
  const worldScenesById = new Map(
    sceneRows.rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        chapterId: row.chapter_id,
        publicText: row.public_text,
        hostText: row.host_text,
        metadata: row.metadata ?? {},
        recapSummary: row.metadata?.recapSummary ?? "",
        chapterSequence: row.chapter_sequence,
        chapterTitle: row.chapter_title
      }
    ])
  );
  const worldCluesById = new Map(
    worldClueRows.rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        publicText: row.public_text,
        hostText: row.host_text,
        visibility: row.visibility,
        importance: row.metadata?.importance ?? "normal"
      }
    ])
  );
  const clueDiscovery = clueRows.rows.map((row) => ({
    clueId: row.clue_id,
    clueName: row.clue_name,
    roleSlotId: row.role_slot_id,
    roleName: row.role_name,
    playerDisplayName: row.player_display_name,
    acquiredAt: row.acquired_at,
    readAt: row.read_at,
    sharedWithRoom: row.shared_with_room,
    source: row.ownership_metadata?.source ?? "unknown"
  }));

  const hostConfirmedEvents = hostEvents.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    ruleName: row.rule_name,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    actionsSummary: summarizeRuleActions(row.actions)
  }));

  const endingTriggers = ruleTriggers.rows.map((row) => ({
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    mode: row.mode,
    executedAt: row.executed_at,
    conditionsSummary: summarizeRuleConditions(row.conditions),
    actionsSummary: summarizeRuleActions(row.actions),
    result: row.result ?? {}
  }));

  const keyTimeline = buildKeyTimeline({
    clueDiscovery,
    investigations: investigations.rows,
    readingCompletions: readingCompletions.rows,
    unlockedScenes: unlockedScenes.rows,
    hostConfirmedEvents,
    endingTriggers,
    timelineLogs: timelineLogs.rows
  });

  const readingCompletionRows = readingCompletions.rows.map((row) => ({
    completedAt: row.completed_at,
    sectionId: row.section_id,
    sectionTitle: row.section_title,
    sequence: row.sequence,
    chapterId: row.chapter_id,
    chapterTitle: row.chapter_title,
    chapterSequence: row.chapter_sequence,
    roleSlotId: row.role_slot_id,
    roleName: row.role_name,
    playerDisplayName: row.player_display_name
  }));

  const firstJoin = players.filter((player) => player.joined_at).map((player) => player.joined_at).sort()[0] ?? null;
  const lastActivity = players.map((player) => player.last_activity_at).filter(Boolean).sort().reverse()[0] ?? null;

  const worldSettings = room.world_settings ?? {};
  const recapTruthSummary = worldSettings.recapTruthSummary ?? "";

  const snapshotCore = {
    generatedAt: new Date().toISOString(),
    room: {
      id: room.id,
      name: room.name,
      status: room.status,
      worldId: room.world_id,
      worldName: room.world_name,
      inviteCode: room.invite_code,
      createdAt: room.created_at,
      firstJoinAt: firstJoin,
      lastActivityAt: lastActivity
    },
    truth: {
      worldSummary: room.world_summary ?? "",
      recapTruthSummary,
      finalChapter: finalChapter.rowCount
        ? { id: finalChapter.rows[0].id, title: finalChapter.rows[0].title, sequence: finalChapter.rows[0].sequence }
        : null
    },
    players: players.map((player) => ({
      roleSlotId: player.role_slot_id,
      roleName: player.role_name,
      playerDisplayName: player.player_display_name,
      joined: player.joined,
      joinedAt: player.joined_at,
      completedSections: player.completed_sections,
      totalSections: player.total_sections,
      ownedClues: player.clue_count,
      readClues: player.read_clue_count,
      noteCount: player.note_count
    })),
    keyTimeline,
    clueDiscovery,
    undiscoveredClues: undiscoveredClues.rows.map((row) => ({
      clueId: row.clue_id,
      clueName: row.clue_name,
      importance: row.clue_metadata?.importance ?? "normal"
    })),
    hostConfirmedEvents,
    endingTriggers,
    investigations: investigations.rows.map((row) => ({
      roleSlotId: row.role_slot_id,
      roleName: row.role_name,
      playerDisplayName: row.player_display_name,
      pointId: row.point_id,
      pointName: row.point_name,
      sceneName: row.scene_name,
      investigatedAt: row.investigated_at
    })),
    notes: notes.rows.map((row) => ({
      id: row.id,
      roleSlotId: row.role_slot_id,
      roleName: row.role_name,
      playerDisplayName: row.player_display_name,
      title: row.title,
      body: row.body,
      sourceType: row.source_type,
      createdAt: row.created_at
    })),
    unlockedScenes: unlockedScenes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      unlockedAt: row.unlocked_at
    })),
    stats: {
      joinedPlayers: players.filter((player) => player.joined).length,
      totalRoles: players.length,
      cluesDiscovered: clueDiscovery.length,
      cluesUndiscovered: undiscoveredClues.rows.length,
      investigationsCompleted: investigations.rows.length,
      hostEventsResolved: hostConfirmedEvents.length,
      rulesTriggered: endingTriggers.length,
      notesWritten: notes.rows.length
    }
  };

  const storyNarrative = buildStoryNarrative({
    room: snapshotCore.room,
    truth: snapshotCore.truth,
    chapters: chapterRows.rows,
    players: snapshotCore.players,
    readingCompletions: readingCompletionRows,
    keyTimeline,
    hostConfirmedEvents,
    endingTriggers,
    clueDiscovery,
    undiscoveredClues: snapshotCore.undiscoveredClues,
    unlockedScenes: snapshotCore.unlockedScenes,
    stats: snapshotCore.stats,
    worldScenesById,
    worldCluesById,
    recapTruthSummary
  });

  const rolePerformances = applyRoleRankings(
    buildRolePerformances({
      players: snapshotCore.players,
      readingCompletions: readingCompletionRows,
      clueDiscovery,
      investigations: snapshotCore.investigations,
      notes: snapshotCore.notes,
      keyTimeline,
      chapters: chapterRows.rows
    })
  );

  return {
    ...snapshotCore,
    readingCompletions: readingCompletionRows,
    storyNarrative,
    rolePerformances
  };
}
