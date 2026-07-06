/**
 * Clue hit-rate aggregation — ownership, read, share metrics per clue
 * across all rooms of a world. Read-only, no business mutation.
 *
 * Data sources:
 *   - clues (world template definition)
 *   - clue_ownership (runtime ownership per room × role)
 *   - rooms (denominator)
 *
 * Card model aligned with creator-dashboard.js for consistent rendering.
 */
import { query } from "./db.js";

function clueCard(clue, ownership, totalRooms) {
  const ownedRooms = ownership?.ownedRooms || 0;
  const readRooms = ownership?.readRooms || 0;
  const sharedRooms = ownership?.sharedRooms || 0;
  const sharedWithRoles = ownership?.sharedWithRoles || 0;
  const hitRate = totalRooms ? Math.round((ownedRooms / totalRooms) * 100) : 0;
  const readRate = ownedRooms ? Math.round((readRooms / ownedRooms) * 100) : 0;
  return {
    clueId: clue.id,
    name: clue.name || "未命名线索",
    summary: clue.summary || clue.public_text?.slice(0, 80) || "",
    visibility: clue.visibility || "private",
    grantMode: clue.grant_mode || (clue.metadata?.grantMode) || "auto",
    totalRooms,
    ownedRooms,
    readRooms,
    sharedRooms,
    sharedWithRoles,
    hitRate,
    readRate,
    label: totalRooms
      ? `${ownedRooms} / ${totalRooms} 房间获得 · 命中 ${hitRate}%`
      : "暂无运行房数据",
    detail: ownedRooms
      ? `${readRooms} 已读 · ${sharedRooms} 公开 · ${sharedWithRoles} 私享`
      : "尚未被任何玩家获得"
  };
}

/**
 * Build per-clue hit-rate stats for a world.
 *
 * @param {object} args
 * @param {string} args.worldId
 * @param {string} args.actorId  - used by route guard, kept for symmetry
 * @param {string|null} [args.roomId] - optional filter to a single room
 */
export async function buildClueHitRate({ worldId, actorId, roomId = null }) {
  // 1. clues template
  const clues = await query(
    `SELECT id, name, summary, public_text, visibility, grant_mode, metadata
     FROM clues
     WHERE world_id = $1
     ORDER BY created_at`,
    [worldId]
  );

  // 2. ownership aggregated per clue
  //    - owned_rooms: distinct rooms with at least one ownership row
  //    - read_rooms: distinct rooms where any owner has read_at
  //    - shared_rooms: distinct rooms where shared_with_room metadata is true
  //    - shared_with_roles: count of ownership rows with shared_with_roles metadata
  const ownershipRows = await query(
    `SELECT
       co.clue_id,
       COUNT(DISTINCT co.room_id)::int AS owned_rooms,
       COUNT(DISTINCT CASE WHEN co.read_at IS NOT NULL THEN co.room_id END)::int AS read_rooms,
       COUNT(DISTINCT CASE WHEN co.metadata ? 'shared_with_room' AND (co.metadata->>'shared_with_room') = 'true' THEN co.room_id END)::int AS shared_rooms,
       COUNT(CASE WHEN co.metadata ? 'shared_with_roles' AND jsonb_array_length(co.metadata->'shared_with_roles') > 0 THEN 1 END)::int AS shared_with_roles
     FROM clue_ownership co
     JOIN clues c ON c.id = co.clue_id
     JOIN rooms r ON r.id = co.room_id AND r.world_id = $1
     ${roomId ? "WHERE co.room_id = $2" : ""}
     GROUP BY co.clue_id
     ORDER BY co.clue_id`,
    roomId ? [worldId, roomId] : [worldId]
  );

  // 3. room denominator
  const roomCount = await query(
    `SELECT COUNT(*)::int AS count FROM rooms WHERE world_id = $1`,
    [worldId]
  );

  const ownershipMap = new Map(ownershipRows.rows.map((r) => [r.clue_id, r]));
  const totalRooms = roomCount.rows[0]?.count || 0;

  const clueCards = clues.rows.map((clue) =>
    clueCard(clue, ownershipMap.get(clue.id) || {}, totalRooms)
  );

  const totalClues = clueCards.length;
  const totalHits = clueCards.reduce((sum, c) => sum + c.ownedRooms, 0);
  const totalReads = clueCards.reduce((sum, c) => sum + c.readRooms, 0);
  const totalShares = clueCards.reduce((sum, c) => sum + c.sharedRooms, 0);
  const averageHitRate = totalClues
    ? Math.round(clueCards.reduce((sum, c) => sum + c.hitRate, 0) / totalClues)
    : 0;

  // Risk-like insights: never-hit clues, low-read clues, over-shared clues
  const neverHit = clueCards.filter((c) => c.totalRooms > 0 && c.ownedRooms === 0);
  const lowRead = clueCards.filter((c) => c.ownedRooms > 0 && c.readRate < 50);
  const highShare = clueCards.filter((c) => c.sharedRooms > 0 && c.sharedRooms >= c.ownedRooms * 0.8 && c.ownedRooms > 0);

  return {
    worldId,
    scope: roomId ? "room" : "world",
    roomId: roomId || null,
    totalRooms,
    totalClues,
    totalHits,
    totalReads,
    totalShares,
    averageHitRate,
    clues: clueCards,
    insights: {
      neverHit: neverHit.map((c) => ({
        clueId: c.clueId,
        name: c.name,
        detail: "尚未被任何玩家获得，检查触发条件或主持发放流程。"
      })),
      lowRead: lowRead.map((c) => ({
        clueId: c.clueId,
        name: c.name,
        detail: `已获得 ${c.ownedRooms} 次但已读率仅 ${c.readRate}%，关注玩家是否注意到这条线索。`
      })),
      highShare: highShare.map((c) => ({
        clueId: c.clueId,
        name: c.name,
        detail: `在 ${c.sharedRooms} 个房间被公开分享，可能削弱私享博弈。`
      }))
    },
    summary: {
      label: averageHitRate >= 80
        ? "线索覆盖良好，多数已被玩家获得"
        : averageHitRate >= 40
          ? "线索命中参差，关注 neverHit 列表"
          : averageHitRate > 0
            ? "玩家刚开始获得线索"
            : "尚无玩家获得任何线索"
    }
  };
}
