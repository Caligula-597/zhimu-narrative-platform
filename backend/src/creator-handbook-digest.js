/**
 * Linked host-handbook digest — chains filled bible / studio content into a
 * host-readable summary (not just counts).
 */
import { query } from "./db.js";
import { loadBibleSummary } from "./creator-bible.js";

function run(client) {
  return client?.query ? client.query.bind(client) : query;
}

function filled(value) {
  return Boolean(String(value ?? "").trim());
}

/**
 * Build a narrative chain of filled creator sections for GM handbook review.
 */
export async function loadHandbookDigest(worldId, client = null) {
  const db = run(client);
  const summary = await loadBibleSummary(worldId, client);
  const [
    core,
    claims,
    relationships,
    timeline,
    foreshadow,
    materials,
    scenes,
    clues,
    points,
    edges,
    worldRow
  ] = await Promise.all([
    db(`SELECT summary, method, motive, victim, host_notes, killer_role_slot_id FROM world_core_tricks WHERE world_id = $1`, [worldId]),
    db(`SELECT id, title, claim FROM world_truth_claims WHERE world_id = $1 ORDER BY created_at LIMIT 40`, [worldId]),
    db(
      `SELECT r.label, a.name AS from_name, b.name AS to_name
       FROM world_role_relationships r
       JOIN role_slots a ON a.id = r.from_role_slot_id
       JOIN role_slots b ON b.id = r.to_role_slot_id
       WHERE r.world_id = $1
       ORDER BY r.created_at
       LIMIT 40`,
      [worldId]
    ),
    db(`SELECT time_label, event_summary FROM world_timeline_events WHERE world_id = $1 ORDER BY sequence, created_at LIMIT 40`, [worldId]),
    db(`SELECT title, plant_summary, payoff_summary FROM world_foreshadow_beats WHERE world_id = $1 ORDER BY sequence, created_at LIMIT 40`, [worldId]),
    db(`SELECT title, summary FROM world_material_booklets WHERE world_id = $1 ORDER BY created_at LIMIT 20`, [worldId]),
    db(`SELECT id, name, host_text FROM scenes WHERE world_id = $1 ORDER BY created_at LIMIT 80`, [worldId]),
    db(
      `SELECT id, name, host_text, metadata
       FROM clues WHERE world_id = $1 ORDER BY created_at LIMIT 80`,
      [worldId]
    ),
    db(
      `SELECT p.id, p.name, p.scene_id, p.clue_id, p.description, p.metadata, s.name AS scene_name, c.name AS clue_name
       FROM investigation_points p
       LEFT JOIN scenes s ON s.id = p.scene_id
       LEFT JOIN clues c ON c.id = p.clue_id
       WHERE p.world_id = $1
       ORDER BY p.sequence, p.created_at
       LIMIT 80`,
      [worldId]
    ),
    db(
      `SELECT from_type, to_type, label
       FROM story_graph_edges
       WHERE world_id = $1 AND from_type = 'scene' AND to_type = 'clue'
       LIMIT 80`,
      [worldId]
    ),
    db(`SELECT name, settings FROM worlds WHERE id = $1`, [worldId])
  ]);

  const settings = worldRow.rows[0]?.settings || {};
  const hostHandbook = settings.hostHandbook || {};
  const endings = Array.isArray(hostHandbook.endings) ? hostHandbook.endings : [];
  const miniGames = Array.isArray(settings.miniGameTemplates) ? settings.miniGameTemplates : [];

  const chain = [];
  const push = (section, status, title, detail, links = []) => {
    chain.push({ section, status, title, detail, links });
  };

  const coreRow = core.rows[0];
  push(
    "coreTrick",
    coreRow && (filled(coreRow.summary) || filled(coreRow.method)) ? "filled" : "empty",
    "核心谜底",
    coreRow?.summary || "尚未填写核心谜底概要。",
    [{ kind: "tab", id: "core-trick", label: "打开核心谜底" }]
  );

  push(
    "claims",
    claims.rows.length ? "filled" : "empty",
    "核心事实",
    claims.rows.length
      ? claims.rows.slice(0, 5).map((row) => row.title).join("；")
      : "尚无核心事实台账。",
    [{ kind: "tab", id: "claims", label: "打开核心事实" }]
  );

  push(
    "relations",
    relationships.rows.length ? "filled" : "empty",
    "人物关系",
    relationships.rows.length
      ? relationships.rows
          .slice(0, 6)
          .map((row) => `${row.from_name}→${row.to_name}（${row.label || "关系"}）`)
          .join("；")
      : "尚未建立角色关系。",
    [{ kind: "tab", id: "relations", label: "打开角色关系" }]
  );

  push(
    "timeline",
    timeline.rows.length ? "filled" : "empty",
    "案件时间线",
    timeline.rows.length
      ? timeline.rows.slice(0, 5).map((row) => `${row.time_label || "—"} ${row.event_summary || ""}`.trim()).join("；")
      : "尚无时间线事件。",
    [{ kind: "tab", id: "timeline", label: "打开时间线" }]
  );

  push(
    "foreshadow",
    foreshadow.rows.length ? "filled" : "empty",
    "伏笔",
    foreshadow.rows.length ? foreshadow.rows.slice(0, 5).map((row) => row.title).join("；") : "尚无伏笔。",
    [{ kind: "tab", id: "foreshadow", label: "打开伏笔" }]
  );

  push(
    "materials",
    materials.rows.length ? "filled" : "empty",
    "平行物料册",
    materials.rows.length ? materials.rows.slice(0, 5).map((row) => row.title).join("；") : "尚无物料册。",
    [{ kind: "tab", id: "materials", label: "打开物料册" }]
  );

  const paired = points.rows.filter((row) => row.scene_id && row.clue_id);
  const triggerFilled = clues.rows.filter((row) => filled(row.metadata?.triggerCondition)).length;
  push(
    "sceneClueLinks",
    paired.length || edges.rows.length ? "filled" : scenes.rows.length || clues.rows.length ? "partial" : "empty",
    "场景 ↔ 线索对应",
    paired.length
      ? `已建立 ${paired.length} 个调查点挂靠（场景内线索）；图谱连线 ${edges.rows.length} 条。`
      : edges.rows.length
        ? `图谱场景→线索连线 ${edges.rows.length} 条；建议补调查点触发。`
        : `场景 ${scenes.rows.length} / 线索 ${clues.rows.length}，尚未配对。`,
    [
      { kind: "view", id: "studio", label: "打开剧情编排" },
      { kind: "view", id: "clues", label: "打开线索管理" }
    ]
  );

  push(
    "triggers",
    triggerFilled ? "filled" : clues.rows.length ? "partial" : "empty",
    "线索触发条件",
    triggerFilled
      ? `${triggerFilled}/${clues.rows.length} 条线索已写触发条件。`
      : clues.rows.length
        ? "线索尚未填写触发条件（搜证/令牌/公开等）。"
        : "尚无线索。",
    [{ kind: "view", id: "clues", label: "补触发条件" }]
  );

  push(
    "endings",
    endings.length ? "filled" : "empty",
    "结局导向",
    endings.length
      ? endings.map((item) => item.title || item.key).join("；")
      : "尚未填写结局导向与不同结局正文。",
    [{ kind: "tab", id: "endings", label: "打开结局导向" }]
  );

  push(
    "miniGames",
    miniGames.length ? "filled" : "empty",
    "场内小游戏",
    miniGames.length
      ? miniGames.map((item) => `${item.title || item.id}（${item.pluginKey || item.gameType || "lock"}）`).join("；")
      : "尚未配置数字锁 / 顺序还原 / 歌猜口令模板。",
    [{ kind: "view", id: "miniGames", label: "打开小游戏设计" }]
  );

  const filledCount = chain.filter((item) => item.status === "filled").length;
  const narrative = chain
    .filter((item) => item.status !== "empty")
    .map((item, index) => `${index + 1}. 【${item.title}】${item.detail}`)
    .join("\n");

  return {
    worldName: worldRow.rows[0]?.name || "",
    summary,
    counts: summary.counts,
    endings,
    flowNotes: hostHandbook.flowNotes || [],
    pairPreview: paired.slice(0, 12).map((row) => ({
      sceneName: row.scene_name,
      clueName: row.clue_name,
      pointName: row.name,
      trigger: row.metadata?.triggerCondition || ""
    })),
    chain,
    narrative,
    completeness: {
      filled: filledCount,
      total: chain.length,
      ratio: chain.length ? filledCount / chain.length : 0
    }
  };
}
