import { fetchHostPlayers, summarizeHostAction } from "./host-helpers.js";
import {
  applyRoleRankings,
  buildChapterMoments,
  buildChapterSynopsis,
  buildPlotSpineForChapter,
  buildRevelationTrack,
  buildTruthConclusion,
  pickRecapExcerpt
} from "../recap-narrative.js";

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
  const players = await fetchHostPlayers(query, roomId);
  const clueRows = await query(
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
  );
  const undiscoveredClues = await query(
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
  );
  const hostEvents = await query(
    `SELECT phe.id, phe.title, phe.description, phe.status, phe.actions,
            phe.created_at, phe.resolved_at, ar.name AS rule_name
     FROM pending_host_events phe
     LEFT JOIN automation_rules ar ON ar.id = phe.rule_id
     WHERE phe.room_id = $1 AND phe.status IN ('executed', 'dismissed')
     ORDER BY COALESCE(phe.resolved_at, phe.created_at) ASC`,
    [roomId]
  );
  const ruleTriggers = await query(
    `SELECT re.executed_at, ar.id AS rule_id, ar.name AS rule_name, ar.mode, ar.conditions, ar.actions, re.result
     FROM rule_executions re
     JOIN automation_rules ar ON ar.id = re.rule_id
     WHERE re.room_id = $1
     ORDER BY re.executed_at ASC`,
    [roomId]
  );
  const investigations = await query(
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
  );
  const notes = await query(
    `SELECT ne.id, ne.title, ne.body, ne.source_type, ne.created_at,
            rs.id AS role_slot_id, rs.name AS role_name, u.display_name AS player_display_name
     FROM notebook_entries ne
     JOIN role_slots rs ON rs.id = ne.role_slot_id
     LEFT JOIN room_members rm ON rm.room_id = ne.room_id AND rm.role_slot_id = ne.role_slot_id AND rm.status = 'active'
     LEFT JOIN users u ON u.id = rm.user_id
     WHERE ne.room_id = $1
     ORDER BY ne.created_at ASC`,
    [roomId]
  );
  const unlockedScenes = await query(
    `SELECT s.id, s.name, rcu.unlocked_at
     FROM room_content_unlocks rcu
     JOIN scenes s ON s.id = rcu.content_id
     WHERE rcu.room_id = $1 AND rcu.content_type = 'scene'
     ORDER BY rcu.unlocked_at ASC`,
    [roomId]
  );
  const timelineLogs = await query(
    `SELECT tl.id, tl.event_type, tl.message, tl.visibility, tl.created_at, tl.metadata,
            u.display_name AS actor_name
     FROM timeline_logs tl
     LEFT JOIN users u ON u.id = tl.actor_user_id
     WHERE tl.room_id = $1
     ORDER BY tl.created_at ASC`,
    [roomId]
  );
  const readingCompletions = await query(
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
  );
  const chapterRows = await query(
    `SELECT ch.id, ch.title, ch.summary, ch.sequence, ch.metadata,
            (SELECT COUNT(*)::int
             FROM script_sections ss
             JOIN role_slots rs ON rs.id = ss.role_slot_id
             WHERE ss.chapter_id = ch.id AND rs.world_id = ch.world_id) AS section_count
     FROM chapters ch
     WHERE ch.world_id = $1
     ORDER BY ch.sequence ASC, ch.created_at ASC`,
    [room.world_id]
  );
  const sceneRows = await query(
    `SELECT s.id, s.name, s.chapter_id, s.public_text, s.host_text, s.metadata,
            ch.sequence AS chapter_sequence, ch.title AS chapter_title
     FROM scenes s
     LEFT JOIN chapters ch ON ch.id = s.chapter_id
     WHERE s.world_id = $1
     ORDER BY ch.sequence NULLS LAST, s.created_at ASC`,
    [room.world_id]
  );
  const worldClueRows = await query(
    `SELECT id, name, public_text, host_text, visibility, metadata
     FROM clues
     WHERE world_id = $1
     ORDER BY created_at ASC`,
    [room.world_id]
  );
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
  const finalChapter = await query(
    `SELECT ch.id, ch.title, ch.sequence
     FROM reading_progress rp
     JOIN script_sections ss ON ss.id = rp.script_section_id
     LEFT JOIN chapters ch ON ch.id = ss.chapter_id
     WHERE rp.room_id = $1 AND rp.completed_at IS NOT NULL
     ORDER BY rp.completed_at DESC
     LIMIT 1`,
    [roomId]
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

function buildKeyTimeline({ clueDiscovery, investigations, readingCompletions, unlockedScenes, hostConfirmedEvents, endingTriggers, timelineLogs }) {
  const events = [];
  for (const row of readingCompletions) {
    events.push({
      kind: "reading_complete",
      at: row.completed_at,
      roleSlotId: row.role_slot_id,
      roleName: row.role_name,
      playerDisplayName: row.player_display_name,
      label: `${row.role_name} 完成阅读「${row.section_title}」`,
      sectionTitle: row.section_title,
      sequence: row.sequence,
      chapterId: row.chapter_id ?? null,
      chapterTitle: row.chapter_title ?? null,
      chapterSequence: row.chapter_sequence ?? null
    });
  }
  for (const row of clueDiscovery) {
    events.push({
      kind: "clue_acquired",
      at: row.acquiredAt,
      roleSlotId: row.roleSlotId,
      roleName: row.roleName,
      playerDisplayName: row.playerDisplayName,
      clueId: row.clueId,
      clueName: row.clueName,
      sharedWithRoom: row.sharedWithRoom,
      label: `${row.roleName} 获得线索「${row.clueName}」`
    });
    if (row.readAt) {
      events.push({
        kind: "clue_read",
        at: row.readAt,
        roleSlotId: row.roleSlotId,
        roleName: row.roleName,
        playerDisplayName: row.playerDisplayName,
        clueId: row.clueId,
        clueName: row.clueName,
        label: `${row.roleName} 阅读线索「${row.clueName}」`
      });
    }
  }
  for (const row of investigations) {
    events.push({
      kind: "investigation",
      at: row.investigated_at,
      roleSlotId: row.role_slot_id,
      roleName: row.role_name,
      playerDisplayName: row.player_display_name,
      pointName: row.point_name,
      sceneName: row.scene_name,
      label: `${row.role_name} 调查「${row.point_name}」（${row.scene_name}）`
    });
  }
  for (const row of unlockedScenes) {
    events.push({
      kind: "scene_unlock",
      at: row.unlocked_at,
      sceneId: row.id,
      sceneName: row.name,
      label: `场景「${row.name}」开放探索`
    });
  }
  for (const row of hostConfirmedEvents) {
    events.push({
      kind: "host_event",
      at: row.resolvedAt ?? row.createdAt,
      title: row.title,
      status: row.status,
      ruleName: row.ruleName,
      label: row.status === "executed" ? `主持确认：${row.title}` : `主持驳回：${row.title}`
    });
  }
  for (const row of endingTriggers) {
    events.push({
      kind: "rule_triggered",
      at: row.executedAt,
      ruleId: row.ruleId,
      ruleName: row.ruleName,
      mode: row.mode,
      label: `规则「${row.ruleName}」触发：${row.actionsSummary}`
    });
  }
  for (const row of timelineLogs) {
    events.push({
      kind: "log",
      at: row.created_at,
      eventType: row.event_type,
      message: row.message,
      visibility: row.visibility,
      roleSlotId: row.metadata?.roleSlotId ?? null,
      actorName: row.actor_name,
      label: row.message
    });
  }
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return events;
}

function eventChapterKey(event) {
  if (event.chapterId) return String(event.chapterId);
  if (event.chapterSequence != null) return `seq:${event.chapterSequence}`;
  return null;
}

function chapterKey(chapter) {
  return chapter?.id ? String(chapter.id) : chapter?.sequence != null ? `seq:${chapter.sequence}` : null;
}

function buildStoryNarrative({
  room,
  truth,
  chapters,
  players,
  readingCompletions,
  keyTimeline,
  hostConfirmedEvents,
  endingTriggers,
  clueDiscovery,
  undiscoveredClues,
  unlockedScenes,
  stats,
  worldScenesById = new Map(),
  worldCluesById = new Map(),
  recapTruthSummary = ""
}) {
  const joinedPlayers = players.filter((player) => player.joined);
  const opening = {
    phase: "opening",
    title: "开本",
    summary: truth.worldSummary
      ? `${room.worldName} · ${truth.worldSummary}`
      : `${room.worldName} · ${room.name}`,
    cast: joinedPlayers.map((player) => ({
      roleSlotId: player.roleSlotId,
      roleName: player.roleName,
      playerDisplayName: player.playerDisplayName,
      joinedAt: player.joinedAt
    })),
    at: room.firstJoinAt ?? room.createdAt
  };

  const chapterList = chapters.length
    ? chapters
    : [{ id: null, title: "本局推进", summary: "", sequence: 1, section_count: 0 }];

  const chapterActs = chapterList.map((chapter, index) => {
    const key = chapterKey(chapter);
    const chapterReads = readingCompletions.filter(
      (row) => (row.chapterId && String(row.chapterId) === String(chapter.id))
        || (row.chapterSequence != null && row.chapterSequence === chapter.sequence)
    );
    const roleIds = new Set(players.map((player) => player.roleSlotId));
    const rolesFinished = new Set(chapterReads.map((row) => row.roleSlotId)).size;
    const beats = keyTimeline.filter((event) => {
      if (event.kind === "reading_complete") {
        const eventKey = eventChapterKey(event);
        if (key && eventKey === key) return true;
        if (!key && index === 0) return true;
        return false;
      }
      if (["host_event", "rule_triggered", "scene_unlock"].includes(event.kind)) {
        const at = event.at ? new Date(event.at).getTime() : NaN;
        const chapterTimes = chapterReads.map((row) => new Date(row.completedAt).getTime()).filter(Number.isFinite);
        const prevTimes = chapterList.slice(0, index).flatMap((prev) =>
          readingCompletions
            .filter((row) => String(row.chapterId) === String(prev.id) || row.chapterSequence === prev.sequence)
            .map((row) => new Date(row.completedAt).getTime())
        );
        const nextTimes = chapterList.slice(index + 1).flatMap((next) =>
          readingCompletions
            .filter((row) => String(row.chapterId) === String(next.id) || row.chapterSequence === next.sequence)
            .map((row) => new Date(row.completedAt).getTime())
        );
        const start = prevTimes.length ? Math.max(...prevTimes) : 0;
        const end = nextTimes.length ? Math.min(...nextTimes) : Number.POSITIVE_INFINITY;
        if (!Number.isFinite(at)) return index === chapterList.length - 1;
        if (chapterTimes.length) {
          const chapterStart = Math.min(...chapterTimes);
          const chapterEnd = Math.max(...chapterTimes);
          return at >= Math.min(chapterStart, start) && at <= Math.max(chapterEnd, end);
        }
        return index === chapterList.length - 1 && at >= start && at <= end;
      }
      if (["clue_acquired", "clue_read", "investigation"].includes(event.kind)) {
        const eventKey = eventChapterKey(event);
        if (eventKey && key && eventKey === key) return true;
        const readInChapter = chapterReads.some((row) => row.roleSlotId === event.roleSlotId);
        if (!readInChapter) return false;
        const at = event.at ? new Date(event.at).getTime() : NaN;
        const chapterTimes = chapterReads
          .filter((row) => row.roleSlotId === event.roleSlotId)
          .map((row) => new Date(row.completedAt).getTime());
        if (!Number.isFinite(at) || !chapterTimes.length) return readInChapter;
        return at >= Math.min(...chapterTimes) - 600_000;
      }
      return false;
    });

    const cluesInAct = clueDiscovery.filter((row) =>
      beats.some((event) => event.kind === "clue_acquired" && event.clueId === row.clueId)
    );

    const summaryParts = [];
    if (chapter.title) summaryParts.push(`第 ${chapter.sequence ?? index + 1} 章《${chapter.title}》`);
    summaryParts.push(`${rolesFinished}/${roleIds.size || players.length} 角色完成本分幕阅读`);
    if (cluesInAct.length) summaryParts.push(`${cluesInAct.length} 条线索在本章流转`);
    if (beats.some((event) => event.kind === "host_event")) summaryParts.push("含主持确认节点");

    const synopsis = buildChapterSynopsis({
      chapter: { ...chapter, summary: pickRecapExcerpt({ recapSummary: chapter.metadata?.recapSummary, summary: chapter.summary, max: 400 }) || chapter.summary },
      chapterReads,
      beats,
      rolesFinished,
      roleTotal: roleIds.size || players.length,
      cluesInAct
    });
    const plotSpine = buildPlotSpineForChapter({
      chapter,
      beats,
      worldScenesById,
      worldCluesById,
      clueDiscovery
    });

    return {
      phase: "chapter",
      chapterId: chapter.id,
      sequence: chapter.sequence ?? index + 1,
      title: chapter.title || `第 ${index + 1} 章`,
      summary: chapter.summary || summaryParts.join(" · "),
      synopsis,
      plotSpine,
      progress: {
        rolesFinished,
        roleTotal: roleIds.size || players.length,
        sectionsCompleted: chapterReads.length,
        sectionTotal: Number(chapter.section_count) || null
      },
      beats,
      narrativeLine: synopsis || summaryParts.join(" · ")
    };
  });

  const revelationTrack = buildRevelationTrack({
    hostConfirmedEvents,
    endingTriggers,
    clueDiscovery,
    worldCluesById
  });

  const epilogueBeats = keyTimeline.filter((event) =>
    !chapterActs.some((act) => act.beats.includes(event))
  );

  const truthConclusion = buildTruthConclusion({
    recapTruthSummary,
    finalChapter: truth.finalChapter,
    endingTriggers,
    hostConfirmedEvents,
    stats,
    undiscoveredClues,
    joinedPlayers: joinedPlayers.length
  });

  const epilogue = {
    phase: "epilogue",
    title: "结局与余波",
    summary: truthConclusion.summary,
    truthConclusion,
    finalChapter: truth.finalChapter,
    endingTriggers,
    hostConfirmedEvents,
    undiscoveredClues,
    beats: epilogueBeats,
    stats
  };

  return {
    perspective: "omniscient",
    opening,
    revelationTrack,
    chapters: chapterActs,
    epilogue,
    fullTimeline: keyTimeline
  };
}

function buildRolePerformances({
  players,
  readingCompletions,
  clueDiscovery,
  investigations,
  notes,
  keyTimeline,
  chapters
}) {
  return players.map((player) => {
    const roleSlotId = player.roleSlotId;
    const reads = readingCompletions.filter((row) => row.roleSlotId === roleSlotId);
    const clues = clueDiscovery.filter((row) => row.roleSlotId === roleSlotId);
    const roleInvestigations = investigations.filter((row) => row.roleSlotId === roleSlotId);
    const roleNotes = notes.filter((row) => row.roleSlotId === roleSlotId);
    const timeline = keyTimeline.filter((event) => event.roleSlotId === roleSlotId);

    const chapterProgress = (chapters.length ? chapters : [{ id: null, title: "本局", sequence: 1 }]).map((chapter) => {
      const chapterReads = reads.filter(
        (row) => String(row.chapterId) === String(chapter.id) || row.chapterSequence === chapter.sequence
      );
      return {
        chapterId: chapter.id,
        sequence: chapter.sequence,
        title: chapter.title,
        sectionsCompleted: chapterReads.length,
        lastCompletedAt: chapterReads.length
          ? chapterReads.map((row) => row.completedAt).sort().reverse()[0]
          : null
      };
    });

    const highlights = [];
    if (!player.joined) highlights.push("未加入本局");
    else {
      if (player.completedSections >= player.totalSections && player.totalSections > 0) {
        highlights.push("完成全部分幕阅读");
      } else if (player.totalSections > 0) {
        highlights.push(`阅读进度 ${player.completedSections}/${player.totalSections}`);
      }
      if (clues.length) {
        const unread = clues.filter((row) => !row.readAt).length;
        highlights.push(unread
          ? `获得 ${clues.length} 条线索，${unread} 条未读`
          : `获得并阅读 ${clues.length} 条线索`);
      }
      if (roleInvestigations.length) highlights.push(`完成 ${roleInvestigations.length} 次调查`);
      if (roleNotes.length) highlights.push(`记录 ${roleNotes.length} 条笔记`);
      const firstRead = reads.map((row) => row.completedAt).sort()[0];
      if (firstRead) highlights.push(`最早阅读完成于 ${firstRead}`);
    }

    return {
      roleSlotId,
      roleName: player.roleName,
      playerDisplayName: player.playerDisplayName,
      joined: player.joined,
      joinedAt: player.joinedAt,
      stats: {
        completedSections: player.completedSections,
        totalSections: player.totalSections,
        ownedClues: player.ownedClues,
        readClues: player.readClues,
        investigations: roleInvestigations.length,
        notes: roleNotes.length
      },
      chapterProgress,
      chapterMoments: buildChapterMoments({
        chapters,
        readingCompletions,
        clueDiscovery,
        investigations,
        roleSlotId
      }),
      clues,
      investigations: roleInvestigations,
      notes: roleNotes,
      timeline,
      highlights
    };
  });
}

export function filterRecapForPlayer(snapshot, roleSlotId) {
  const myPerformance = (snapshot.rolePerformances ?? []).find((row) => row.roleSlotId === roleSlotId) ?? null;
  const personalNotes = (snapshot.notes ?? []).filter((row) => row.roleSlotId === roleSlotId);

  return {
    ...snapshot,
    perspective: "postgame",
    highlightRoleSlotId: roleSlotId,
    roleSlotId,
    storyNarrative: snapshot.storyNarrative ?? null,
    rolePerformances: snapshot.rolePerformances ?? [],
    myPerformance,
    personalNotes,
    clueDiscovery: snapshot.clueDiscovery ?? [],
    missedClues: snapshot.undiscoveredClues ?? [],
    keyTimeline: snapshot.keyTimeline ?? [],
    investigations: (snapshot.investigations ?? []).filter((row) => row.roleSlotId === roleSlotId),
    notes: personalNotes,
    hostConfirmedEvents: snapshot.hostConfirmedEvents ?? [],
    endingTriggers: snapshot.endingTriggers ?? []
  };
}

export function summarizeRecap(snapshot = {}) {
  return {
    joinedPlayers: snapshot.stats?.joinedPlayers ?? 0,
    cluesDiscovered: snapshot.stats?.cluesDiscovered ?? 0,
    cluesUndiscovered: snapshot.stats?.cluesUndiscovered ?? 0,
    investigationsCompleted: snapshot.stats?.investigationsCompleted ?? 0,
    rulesTriggered: snapshot.stats?.rulesTriggered ?? 0,
    notesWritten: snapshot.stats?.notesWritten ?? 0
  };
}
