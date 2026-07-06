/**
 * Segment completion aggregation — per-chapter / per-section reading progress
 * across all rooms of a world. Read-only, no business mutation.
 *
 * Data sources:
 *   - script_sections (definition, sequence, role_slot binding)
 *   - reading_progress (room × role × section completion)
 *   - chapters (public chapter flow)
 *   - rooms (denominator: how many rooms touched this world)
 *
 * Card model aligned with creator-dashboard.js so overview.js can render
 * a stable panel without re-shaping.
 */
import { query } from "./db.js";

function sectionCard(section, progress) {
  const totalRooms = progress.totalRooms || 0;
  const completedRooms = progress.completedRooms || 0;
  const startedRooms = progress.startedRooms || 0;
  const completionRate = totalRooms ? Math.round((completedRooms / totalRooms) * 100) : 0;
  return {
    sectionId: section.id,
    title: section.title || `第 ${section.sequence} 幕`,
    sequence: section.sequence,
    roleSlotId: section.role_slot_id,
    roleName: section.role_name || "—",
    totalRooms,
    startedRooms,
    completedRooms,
    completionRate,
    averageMinutes: progress.averageMinutes ?? null,
    label: totalRooms
      ? `${completedRooms} / ${totalRooms} 房间完成 · ${completionRate}%`
      : "暂无运行房数据"
  };
}

function chapterCard(chapter, sectionCards) {
  const total = sectionCards.length || 0;
  const completed = sectionCards.filter((s) => s.completionRate === 100).length;
  const avgRate = total
    ? Math.round(sectionCards.reduce((sum, s) => sum + s.completionRate, 0) / total)
    : 0;
  return {
    chapterId: chapter.id,
    title: chapter.title,
    sequence: chapter.sequence,
    matrixActKey: chapter.matrix_act_key || null,
    sectionCount: total,
    completedSections: completed,
    averageCompletion: avgRate,
    sections: sectionCards
  };
}

/**
 * Build per-segment completion stats for a world.
 *
 * @param {object} args
 * @param {string} args.worldId
 * @param {string} args.actorId  - used by route guard, kept for symmetry
 * @param {string|null} [args.roomId] - optional filter to a single room
 */
export async function buildSegmentCompletion({ worldId, actorId, roomId = null }) {
  // 1. chapters (public flow)
  const chapters = await query(
    `SELECT id, title, sequence, metadata
     FROM chapters
     WHERE world_id = $1
     ORDER BY sequence`,
    [worldId]
  );

  // 2. sections joined with role_slots for display name
  const sections = await query(
    `SELECT ss.id, ss.title, ss.sequence, ss.role_slot_id, rs.name AS role_name
     FROM script_sections ss
     JOIN role_slots rs ON rs.id = ss.role_slot_id
     WHERE rs.world_id = $1
     ORDER BY rs.sequence, ss.sequence`,
    [worldId]
  );

  // 3. reading_progress aggregated by section
  //    - one row per section: total rooms, started count, completed count, avg minutes
  const progressRows = await query(
    `SELECT
       ss.id AS section_id,
       COUNT(DISTINCT rp.room_id)::int AS total_rooms,
       COUNT(DISTINCT CASE WHEN rp.started_at IS NOT NULL THEN rp.room_id END)::int AS started_rooms,
       COUNT(DISTINCT CASE WHEN rp.completed_at IS NOT NULL THEN rp.room_id END)::int AS completed_rooms,
       AVG(EXTRACT(EPOCH FROM (COALESCE(rp.completed_at, now()) - rp.started_at)) / 60)::float AS average_minutes
     FROM script_sections ss
     JOIN role_slots rs ON rs.id = ss.role_slot_id
     LEFT JOIN reading_progress rp
       ON rp.script_section_id = ss.id
       ${roomId ? "AND rp.room_id = $2" : ""}
     LEFT JOIN rooms r ON r.id = rp.room_id AND r.world_id = $1
     WHERE rs.world_id = $1
       AND (${roomId ? "rp.room_id = $2" : "rp.room_id IS NOT NULL AND r.id IS NOT NULL"})
     GROUP BY ss.id
     ORDER BY ss.id`,
    roomId ? [worldId, roomId] : [worldId]
  );

  // 4. room denominator — how many rooms belong to this world (for empty-state clarity)
  const roomCount = await query(
    `SELECT COUNT(*)::int AS count FROM rooms WHERE world_id = $1`,
    [worldId]
  );

  const progressMap = new Map(progressRows.rows.map((r) => [r.section_id, r]));

  // script_sections currently has no chapter_id FK; group flat list by role for creator view.
  const orphanSections = [];
  for (const section of sections.rows) {
    const progress = progressMap.get(section.id) || { total_rooms: 0, started_rooms: 0, completed_rooms: 0, average_minutes: null };
    const card = sectionCard(section, {
      totalRooms: progress.total_rooms || 0,
      startedRooms: progress.started_rooms || 0,
      completedRooms: progress.completed_rooms || 0,
      averageMinutes: progress.average_minutes
    });
    orphanSections.push(card);
  }

  // Group sections by chapter via metadata.chapterId if present; otherwise show flat list under world.
  // Note: script_sections currently has no chapter_id FK, so we keep a flat list grouped by role.
  const byRole = new Map();
  for (const card of orphanSections) {
    const key = card.roleName || "—";
    if (!byRole.has(key)) byRole.set(key, []);
    byRole.get(key).push(card);
  }

  const roleGroups = [...byRole.entries()].map(([roleName, cards], index) => ({
    roleId: String(index + 1),
    roleName,
    sectionCount: cards.length,
    averageCompletion: cards.length
      ? Math.round(cards.reduce((sum, c) => sum + c.completionRate, 0) / cards.length)
      : 0,
    sections: cards.sort((a, b) => a.sequence - b.sequence)
  }));

  const chapterCards = chapters.rows.map((chapter) => {
    // Chapters in current schema hold publicEnvironment, not section bindings.
    // We surface chapter metadata for the creator to understand flow; section
    // progress is reported per-role below.
    return chapterCard(
      {
        id: chapter.id,
        title: chapter.title,
        sequence: chapter.sequence,
        matrix_act_key: chapter.metadata?.matrixActKey || null
      },
      []
    );
  });

  const totalSections = orphanSections.length;
  const totalCompleted = orphanSections.reduce((sum, s) => sum + s.completedRooms, 0);
  const totalStarted = orphanSections.reduce((sum, s) => sum + s.startedRooms, 0);
  const averageCompletion = totalSections
    ? Math.round(orphanSections.reduce((sum, s) => sum + s.completionRate, 0) / totalSections)
    : 0;

  return {
    worldId,
    scope: roomId ? "room" : "world",
    roomId: roomId || null,
    totalRooms: roomCount.rows[0]?.count || 0,
    totalSections,
    totalCompletedRoomSectionPairs: totalCompleted,
    totalStartedRoomSectionPairs: totalStarted,
    averageCompletion,
    chapters: chapterCards,
    roleGroups,
    summary: {
      label: averageCompletion >= 80
        ? "大部分分幕已被玩家完成"
        : averageCompletion >= 40
          ? "玩家进度参差，可重点关注卡关段"
          : averageCompletion > 0
            ? "玩家刚开始推进，建议跟踪首场完成率"
            : "尚无玩家阅读进度"
    }
  };
}
