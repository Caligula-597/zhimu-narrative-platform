/** Pure helpers for omniscient postgame recap narrative (no DB). */

export function truncateExcerpt(text, max = 160) {
  const raw = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 1)}…`;
}

export function buildRevelationTrack({ hostConfirmedEvents = [], endingTriggers = [], clueDiscovery = [], worldCluesById = new Map() }) {
  const rows = [];
  for (const event of hostConfirmedEvents) {
    if (event.status !== "executed") continue;
    rows.push({
      kind: "host_revelation",
      at: event.resolvedAt ?? event.createdAt,
      title: event.title,
      excerpt: truncateExcerpt(event.description, 200),
      meta: { ruleName: event.ruleName, actionsSummary: event.actionsSummary }
    });
  }
  for (const rule of endingTriggers) {
    rows.push({
      kind: "rule_revelation",
      at: rule.executedAt,
      title: rule.ruleName,
      excerpt: truncateExcerpt(`${rule.conditionsSummary} → ${rule.actionsSummary}`, 200),
      meta: { mode: rule.mode }
    });
  }
  for (const row of clueDiscovery) {
    const world = worldCluesById.get(row.clueId);
    const hostText = world?.hostText || world?.host_text;
    if (!hostText || (!row.readAt && !row.sharedWithRoom)) continue;
    rows.push({
      kind: "clue_revelation",
      at: row.readAt ?? row.acquiredAt,
      title: row.clueName || world?.name || "线索",
      excerpt: truncateExcerpt(hostText, 200),
      meta: { roleName: row.roleName, sharedWithRoom: row.sharedWithRoom }
    });
  }
  rows.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return rows;
}

export function buildChapterSynopsis({
  chapter,
  chapterReads,
  beats,
  rolesFinished,
  roleTotal,
  cluesInAct
}) {
  const parts = [];
  if (chapter.title) parts.push(`《${chapter.title}》`);
  if (rolesFinished > 0) {
    const names = [...new Set(chapterReads.map((row) => row.roleName).filter(Boolean))];
    const nameHint = names.length ? `${names.slice(0, 4).join("、")}${names.length > 4 ? " 等" : ""}` : "";
    parts.push(`${nameHint}${nameHint ? " " : ""}${rolesFinished}/${roleTotal} 角色完成本章阅读`);
  } else {
    parts.push("本章尚无角色完成阅读");
  }
  const scenes = beats.filter((event) => event.kind === "scene_unlock");
  if (scenes.length) {
    parts.push(`开放场景 ${scenes.map((event) => `「${event.sceneName}」`).join("、")}`);
  }
  const clueNames = cluesInAct.map((row) => row.clueName).filter(Boolean);
  if (clueNames.length) {
    parts.push(`线索流转 ${clueNames.slice(0, 5).join("、")}${clueNames.length > 5 ? " 等" : ""}`);
  }
  const hostNodes = beats.filter((event) => event.kind === "host_event" && event.status === "executed");
  if (hostNodes.length) {
    parts.push(`主持揭示 ${hostNodes.map((event) => `「${event.title}」`).join("、")}`);
  }
  const rules = beats.filter((event) => event.kind === "rule_triggered");
  if (rules.length) {
    parts.push(`规则触发 ${rules.map((event) => `「${event.ruleName}」`).join("、")}`);
  }
  return parts.join("；");
}

export function buildPlotSpineForChapter({
  chapter,
  beats,
  worldScenesById,
  worldCluesById,
  clueDiscovery
}) {
  const nodes = [];
  const chapterSummary = chapter.summary || chapter.chapter_summary;
  if (chapterSummary) {
    nodes.push({
      kind: "chapter_intro",
      at: beats[0]?.at ?? null,
      title: chapter.title,
      excerpt: truncateExcerpt(chapterSummary, 240)
    });
  }
  const sortedBeats = [...beats].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  for (const beat of sortedBeats) {
    if (beat.kind === "scene_unlock" && beat.sceneId) {
      const scene = worldScenesById.get(beat.sceneId);
      const excerpt = truncateExcerpt(scene?.publicText || scene?.public_text, 180);
      if (excerpt) {
        nodes.push({
          kind: "scene_public",
          at: beat.at,
          title: beat.sceneName || scene?.name,
          excerpt
        });
      }
    }
    if (beat.kind === "host_event" && beat.status === "executed") {
      nodes.push({
        kind: "host_revelation",
        at: beat.at,
        title: beat.title,
        excerpt: truncateExcerpt(beat.description, 180) || beat.label
      });
    }
    if (beat.kind === "clue_read" && beat.clueId) {
      const world = worldCluesById.get(beat.clueId);
      const excerpt = truncateExcerpt(world?.hostText || world?.host_text || world?.publicText || world?.public_text, 160);
      if (excerpt) {
        nodes.push({
          kind: "clue_truth",
          at: beat.at,
          title: beat.clueName || world?.name,
          excerpt,
          meta: { roleName: beat.roleName }
        });
      }
    }
    nodes.push({ kind: "runtime", at: beat.at, title: beat.label, beat });
  }
  nodes.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return ta - tb;
  });
  return nodes;
}

export function buildChapterMoments({ chapters, readingCompletions, clueDiscovery, investigations, roleSlotId }) {
  return (chapters.length ? chapters : [{ id: null, title: "本局", sequence: 1 }]).map((chapter) => {
    const reads = readingCompletions.filter(
      (row) => row.roleSlotId === roleSlotId
        && (String(row.chapterId) === String(chapter.id) || row.chapterSequence === chapter.sequence)
    );
    const clues = clueDiscovery.filter((row) => row.roleSlotId === roleSlotId);
    const inv = investigations.filter((row) => row.roleSlotId === roleSlotId);
    const moments = [];
    if (reads.length) moments.push(`完成 ${reads.length} 幕阅读：${reads.map((r) => r.sectionTitle).slice(0, 3).join("、")}${reads.length > 3 ? " 等" : ""}`);
    if (clues.length) moments.push(`获得线索 ${clues.map((c) => c.clueName).filter(Boolean).slice(0, 4).join("、")}`);
    if (inv.length) moments.push(`调查 ${inv.map((i) => i.pointName).slice(0, 3).join("、")}`);
    return {
      chapterId: chapter.id,
      sequence: chapter.sequence,
      title: chapter.title,
      moments
    };
  }).filter((row) => row.moments.length);
}

export function buildRoleNarrativeSummary(role) {
  if (!role.joined) return "未参与本局。";
  const parts = [];
  if (role.stats?.totalSections) {
    parts.push(`阅读 ${role.stats.completedSections}/${role.stats.totalSections}`);
  }
  if (role.stats?.ownedClues) {
    parts.push(`持有 ${role.stats.ownedClues} 条线索`);
  }
  if (role.stats?.investigations) {
    parts.push(`${role.stats.investigations} 次调查`);
  }
  if (role.stats?.notes) {
    parts.push(`${role.stats.notes} 条笔记`);
  }
  return parts.length ? `${role.roleName}：${parts.join("，")}。` : `${role.roleName}：已入席，暂无明显推进记录。`;
}

export function applyRoleRankings(performances) {
  const joined = performances.filter((row) => row.joined);
  const maxSections = joined.reduce((max, row) => Math.max(max, row.stats?.completedSections ?? 0), 0);
  const maxClues = joined.reduce((max, row) => Math.max(max, row.stats?.ownedClues ?? 0), 0);
  const maxInv = joined.reduce((max, row) => Math.max(max, row.stats?.investigations ?? 0), 0);
  const maxNotes = joined.reduce((max, row) => Math.max(max, row.stats?.notes ?? 0), 0);

  return performances.map((role) => {
    const badges = [];
    if (role.joined && maxSections > 0 && role.stats?.completedSections === maxSections) {
      badges.push("阅读进度领先");
    }
    if (role.joined && maxClues > 0 && role.stats?.ownedClues === maxClues) {
      badges.push("线索最多");
    }
    if (role.joined && maxInv > 0 && role.stats?.investigations === maxInv) {
      badges.push("调查最勤");
    }
    if (role.joined && maxNotes > 0 && role.stats?.notes === maxNotes) {
      badges.push("笔记最多");
    }
    return {
      ...role,
      badges,
      narrativeSummary: buildRoleNarrativeSummary(role)
    };
  });
}
