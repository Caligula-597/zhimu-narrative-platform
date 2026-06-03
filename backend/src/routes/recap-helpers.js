import { fetchHostPlayers, summarizeHostAction } from "./host-helpers.js";

const PUBLIC_TIMELINE_KINDS = new Set(["scene_unlock", "host_event", "rule_triggered"]);

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
            w.name AS world_name, w.summary AS world_summary
     FROM rooms r
     JOIN worlds w ON w.id = r.world_id
     WHERE r.id = $1`,
    [roomId]
  );
  if (!roomRow.rowCount) return null;

  const room = roomRow.rows[0];
  const [
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
    finalChapter
  ] = await Promise.all([
    fetchHostPlayers(query, roomId),
    query(
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
    ),
    query(
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
    ),
    query(
      `SELECT phe.id, phe.title, phe.description, phe.status, phe.actions,
              phe.created_at, phe.resolved_at, ar.name AS rule_name
       FROM pending_host_events phe
       LEFT JOIN automation_rules ar ON ar.id = phe.rule_id
       WHERE phe.room_id = $1 AND phe.status IN ('executed', 'dismissed')
       ORDER BY COALESCE(phe.resolved_at, phe.created_at) ASC`,
      [roomId]
    ),
    query(
      `SELECT re.executed_at, ar.id AS rule_id, ar.name AS rule_name, ar.mode, ar.conditions, ar.actions, re.result
       FROM rule_executions re
       JOIN automation_rules ar ON ar.id = re.rule_id
       WHERE re.room_id = $1
       ORDER BY re.executed_at ASC`,
      [roomId]
    ),
    query(
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
    ),
    query(
      `SELECT ne.id, ne.title, ne.body, ne.source_type, ne.created_at,
              rs.id AS role_slot_id, rs.name AS role_name, u.display_name AS player_display_name
       FROM notebook_entries ne
       JOIN role_slots rs ON rs.id = ne.role_slot_id
       LEFT JOIN room_members rm ON rm.room_id = ne.room_id AND rm.role_slot_id = ne.role_slot_id AND rm.status = 'active'
       LEFT JOIN users u ON u.id = rm.user_id
       WHERE ne.room_id = $1
       ORDER BY ne.created_at ASC`,
      [roomId]
    ),
    query(
      `SELECT s.id, s.name, rcu.unlocked_at
       FROM room_content_unlocks rcu
       JOIN scenes s ON s.id = rcu.content_id
       WHERE rcu.room_id = $1 AND rcu.content_type = 'scene'
       ORDER BY rcu.unlocked_at ASC`,
      [roomId]
    ),
    query(
      `SELECT tl.id, tl.event_type, tl.message, tl.visibility, tl.created_at, tl.metadata,
              u.display_name AS actor_name
       FROM timeline_logs tl
       LEFT JOIN users u ON u.id = tl.actor_user_id
       WHERE tl.room_id = $1
       ORDER BY tl.created_at ASC`,
      [roomId]
    ),
    query(
      `SELECT rp.completed_at, ss.id AS section_id, ss.title AS section_title, ss.sequence,
              rs.id AS role_slot_id, rs.name AS role_name, u.display_name AS player_display_name
       FROM reading_progress rp
       JOIN script_sections ss ON ss.id = rp.script_section_id
       JOIN role_slots rs ON rs.id = rp.role_slot_id
       LEFT JOIN room_members rm ON rm.room_id = rp.room_id AND rm.role_slot_id = rp.role_slot_id AND rm.status = 'active'
       LEFT JOIN users u ON u.id = rm.user_id
       WHERE rp.room_id = $1 AND rp.completed_at IS NOT NULL
       ORDER BY rp.completed_at ASC`,
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

  const firstJoin = players.filter((player) => player.joined_at).map((player) => player.joined_at).sort()[0] ?? null;
  const lastActivity = players.map((player) => player.last_activity_at).filter(Boolean).sort().reverse()[0] ?? null;

  return {
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
      sequence: row.sequence
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

export function filterRecapForPlayer(snapshot, roleSlotId) {
  const ownedClueIds = new Set(
    (snapshot.clueDiscovery ?? [])
      .filter((row) => row.roleSlotId === roleSlotId)
      .map((row) => row.clueId)
  );
  const sharedClueIds = new Set(
    (snapshot.clueDiscovery ?? [])
      .filter((row) => row.sharedWithRoom)
      .map((row) => row.clueId)
  );
  const visibleClueIds = new Set([...ownedClueIds, ...sharedClueIds]);

  const clueDiscovery = (snapshot.clueDiscovery ?? []).map((row) => {
    if (row.roleSlotId === roleSlotId || visibleClueIds.has(row.clueId)) return row;
    return {
      ...row,
      clueName: null,
      masked: true,
      label: `${row.roleName} 获得了一条未公开线索`
    };
  });

  const missedClues = (snapshot.clueDiscovery ?? [])
    .filter((row) => row.roleSlotId !== roleSlotId && !visibleClueIds.has(row.clueId))
    .map((row) => ({
      clueId: row.clueId,
      clueName: null,
      acquiredByRoleName: row.roleName,
      acquiredAt: row.acquiredAt,
      masked: true
    }))
    .concat(
      (snapshot.undiscoveredClues ?? []).map((row) => ({
        clueId: row.clueId,
        clueName: row.clueName,
        acquiredByRoleName: null,
        acquiredAt: null,
        masked: false
      }))
    );

  const keyTimeline = (snapshot.keyTimeline ?? []).filter((event) => {
    if (PUBLIC_TIMELINE_KINDS.has(event.kind)) return true;
    if (event.roleSlotId === roleSlotId) return true;
    if (event.kind === "clue_acquired" || event.kind === "clue_read") {
      return event.clueId && visibleClueIds.has(event.clueId);
    }
    if (event.kind === "log") {
      if (event.roleSlotId === roleSlotId) return true;
      if (event.visibility === "public" || event.visibility === "postgame") return true;
      return false;
    }
    return false;
  }).map((event) => {
    if ((event.kind === "clue_acquired" || event.kind === "clue_read") && event.clueId && !visibleClueIds.has(event.clueId)) {
      return { ...event, clueName: null, masked: true, label: `${event.roleName} 获得/阅读了一条未公开线索` };
    }
    return event;
  });

  return {
    ...snapshot,
    perspective: "player",
    roleSlotId,
    clueDiscovery,
    missedClues,
    undiscoveredClues: missedClues.filter((row) => !row.acquiredByRoleName),
    keyTimeline,
    investigations: (snapshot.investigations ?? []).filter((row) => row.roleSlotId === roleSlotId),
    notes: (snapshot.notes ?? []).filter((row) => row.roleSlotId === roleSlotId),
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
