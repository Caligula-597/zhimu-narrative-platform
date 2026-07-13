import { buildChapterMoments } from "./recap-narrative.js";

export function buildRolePerformances({
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
