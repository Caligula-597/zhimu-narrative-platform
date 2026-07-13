export function buildKeyTimeline({ clueDiscovery, investigations, readingCompletions, unlockedScenes, hostConfirmedEvents, endingTriggers, timelineLogs }) {
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
