import {
  buildChapterSynopsis,
  buildPlotSpineForChapter,
  buildRevelationTrack,
  buildTruthConclusion,
  pickRecapExcerpt
} from "./recap-narrative.js";

function eventChapterKey(event) {
  if (event.chapterId) return String(event.chapterId);
  if (event.chapterSequence != null) return `seq:${event.chapterSequence}`;
  return null;
}

function chapterKey(chapter) {
  return chapter?.id ? String(chapter.id) : chapter?.sequence != null ? `seq:${chapter.sequence}` : null;
}

export function buildStoryNarrative({
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
