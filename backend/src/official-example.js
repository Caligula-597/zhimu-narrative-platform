/**
 * Official example script (creator-uploaded template) — env-driven, not fog seed.
 */
import { query } from "./db.js";

export function getOfficialExampleWorldId() {
  return process.env.OFFICIAL_EXAMPLE_WORLD_ID?.trim() || "";
}

export function isProtectedPlatformWorldId(worldId) {
  const official = getOfficialExampleWorldId();
  return Boolean(official && worldId === official);
}

export const OFFICIAL_EXAMPLE_EXPERIENCE_STEPS = [
  {
    id: "join",
    title: "开始体验",
    description: "从公开库加入官方示例剧本，系统会为你创建独立运行房。"
  },
  {
    id: "player",
    title: "进入玩家视角",
    description: "用邀请码选择角色，阅读私人分幕。"
  },
  {
    id: "read",
    title: "读完第一幕",
    description: "在玩家页确认读完，系统记录阅读进度。"
  },
  {
    id: "director",
    title: "主持台查看推进",
    description: "打开主持监控台，查看玩家进度与待确认事件。"
  },
  {
    id: "recap",
    title: "生成复盘",
    description: "跑完一局后生成结构化复盘，验证完整链路。"
  }
];

export async function loadOfficialExampleSnapshot() {
  const worldId = getOfficialExampleWorldId();
  const base = {
    configured: Boolean(worldId),
    available: false,
    worldId: worldId || null,
    name: null,
    summary: null,
    roleCount: 0,
    catalogPublic: false,
    unavailableReason: null,
    experienceSteps: OFFICIAL_EXAMPLE_EXPERIENCE_STEPS,
    joinApiPath: "/api/platform/official-example/join"
  };

  if (!worldId) {
    return {
      ...base,
      unavailableReason: "未配置 OFFICIAL_EXAMPLE_WORLD_ID"
    };
  }

  const result = await query(
    `SELECT w.id, w.name, w.summary, w.status, w.catalog_public, w.catalog_review_status,
            (SELECT COUNT(*)::int FROM role_slots rs WHERE rs.world_id = w.id) AS role_count
     FROM worlds w
     WHERE w.id = $1`,
    [worldId]
  );

  if (!result.rowCount) {
    return {
      ...base,
      unavailableReason: "配置的官方示例剧本不存在"
    };
  }

  const row = result.rows[0];
  const hasRoles = (row.role_count ?? 0) > 0;
  const catalogReady =
    Boolean(row.catalog_public) && row.status !== "archived" && hasRoles;

  let unavailableReason = null;
  if (row.status === "archived") unavailableReason = "官方示例剧本已归档";
  else if (!row.catalog_public) unavailableReason = "官方示例尚未上架公开库";
  else if (!hasRoles) unavailableReason = "官方示例尚未配置角色席位";

  return {
    ...base,
    available: catalogReady,
    worldId: row.id,
    name: row.name,
    summary: row.summary,
    roleCount: row.role_count ?? 0,
    catalogPublic: Boolean(row.catalog_public),
    catalogReviewStatus: row.catalog_review_status,
    unavailableReason: catalogReady ? null : unavailableReason
  };
}
