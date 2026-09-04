/**
 * Creator cockpit — stage defs and factual item observations (no design judgment).
 */

export function creatorCockpitAccessMode(role = "") {
  if (role === "owner" || role === "editor" || !role) return "creator";
  return role === "reviewer" ? "reviewer" : "runtime";
}

export const STAGE_DEFS = [
  {
    id: "concept",
    title: "灵魂的种子",
    short: "概念",
    subtitle: "故事总览、灵感、梗概、核心卖点、商业定位",
    items: [
      { id: "spark", title: "灵感卡", link: { canvas: "inspiration" } },
      { id: "logline", title: "一句话梗概", link: { canvas: "logline", view: "settings", label: "世界设置" } },
      { id: "selling", title: "核心卖点", link: { canvas: "selling" } },
      { id: "positioning", title: "商业定位", link: { canvas: "positioning", view: "settings", label: "世界设置" } }
    ]
  },
  {
    id: "architecture",
    title: "骨架的搭建",
    short: "架构",
    subtitle: "核心事实、人物关系、案件时间线、线索",
    items: [
      { id: "trick", title: "核心事实", link: { canvas: "trick", view: "truth", label: "谜底与关系" } },
      { id: "relations", title: "人物关系", link: { canvas: "relations", view: "truth", label: "谜底与关系" } },
      { id: "timeline", title: "章节结构", link: { canvas: "timeline", view: "studio", label: "编排图谱" } },
      { id: "evidence", title: "线索", link: { canvas: "trick", view: "clues", label: "线索管理" } }
    ]
  },
  {
    id: "characters",
    title: "血肉的填充",
    short: "人物",
    subtitle: "角色席位、私人分幕、发布节奏",
    items: [
      { id: "profiles", title: "角色与分幕", link: { canvas: "profiles", view: "writer", label: "角色私人剧本" } },
      { id: "arcs", title: "分幕与发布", link: { canvas: "profiles", view: "writer", label: "角色私人剧本" } },
      { id: "foreshadow", title: "谜底与伏笔", link: { canvas: "profiles", view: "truth", label: "谜底与关系" } }
    ]
  },
  {
    id: "flow",
    title: "游戏的规则",
    short: "流程",
    subtitle: "运行段落、线索矩阵、自动化规则、主持预演",
    items: [
      { id: "beats", title: "运行段落", link: { canvas: "beats", view: "structure", label: "运行段落工作台" } },
      { id: "clue-matrix", title: "线索分发", link: { canvas: "matrix", view: "clues", label: "线索管理" } },
      { id: "mechanics", title: "机制设计", link: { canvas: "sandbox", action: "cockpit-open-mechanism-workbench", label: "打开机制工作台" } },
      { id: "story-mechanics", title: "剧情机制骨架", link: { canvas: "sandbox", action: "cockpit-open-story-mechanism-workbench", label: "打开剧情机制工作台" } },
      { id: "dm-sandbox", title: "主持预演", link: { canvas: "sandbox", action: "open-host-console", label: "打开主持端" } }
    ]
  },
  {
    id: "manuscript",
    title: "肌肤的裁剪",
    short: "文稿",
    subtitle: "创作入口、物料、导入导出",
    items: [
      { id: "player-book", title: "内容生产", link: { canvas: "writing", view: "writer", label: "角色私人剧本" } },
      { id: "dm-manual", title: "主持手册", link: { canvas: "writing", view: "truth", label: "主持手册全文" } },
      { id: "import-hub", title: "来源与拆稿", link: { canvas: "writing", view: "importSource", label: "来源稿与模块" } },
      { id: "props", title: "线索与场景", link: { canvas: "cards", view: "studio", label: "编排图谱" } },
      { id: "package", title: "导入导出", link: { canvas: "package", action: "creator-export", label: "导出备份" } }
    ]
  },
  {
    id: "launch",
    title: "测试与发布",
    short: "测试",
    subtitle: "结构诊断、机器压力测试、真人运行房、系统检查、跑局数据",
    items: [
      { id: "diagnostics", title: "作品诊断", link: { canvas: "diagnostics", view: "diagnostics", label: "作品诊断中心" } },
      { id: "ai-playtest", title: "机器压力测试", link: { canvas: "ai-playtest", view: "playtest", label: "打开压力测试" } },
      { id: "test-room", title: "测试运行房", link: { canvas: "test", action: "world-rooms", label: "管理运行房" } },
      { id: "feedback", title: "跑局数据", link: { canvas: "feedback", view: "insights", label: "完整数据页" } },
      { id: "readiness", title: "系统检查", link: { canvas: "readiness", action: "creator-check", label: "刷新检查" } }
    ]
  }
];

export const CANVAS_MODES = {
  concept: ["inspiration", "logline", "selling", "positioning", "overview"],
  architecture: ["trick", "relations", "timeline"],
  characters: ["profiles", "arcs"],
  flow: ["beats", "matrix", "sandbox"],
  manuscript: ["writing", "cards", "package"],
  launch: ["diagnostics", "ai-playtest", "test", "feedback", "readiness"]
};

export const CANVAS_LABELS = {
  inspiration: "灵感",
  logline: "梗概",
  selling: "卖点",
  positioning: "定位",
  overview: "一览",
  trick: "核心事实",
  relations: "关系网",
  timeline: "章节",
  profiles: "角色",
  arcs: "分幕",
  beats: "Segment",
  matrix: "线索矩阵",
  sandbox: "主持预演",
  writing: "生产入口",
  cards: "物料",
  package: "交付包",
  diagnostics: "作品诊断",
  "ai-playtest": "机器压力测试",
  test: "测试房",
  feedback: "跑局数据",
  readiness: "系统检查"
};

/** Factual presence only — no quality thresholds. */
function itemPresence(id, ctx) {
  const { counts = {}, segments = [], truthClaims = [], relationships = [], studio, draft = {}, diagnostics, playtest } = ctx;
  const summary = String(studio?.world?.summary || draft.logline || "").trim();
  const sparks = draft.sparks || [];
  const sellingFilled = (draft.sellingPoints || []).filter(Boolean).length;
  const positioningFilled = [draft.target, draft.duration, draft.type].filter(Boolean).length;
  const publishedSections = (studio?.sections || []).filter((s) => s.publication_status && s.publication_status !== "draft").length;
  const checks = ctx.checks || [];

  switch (id) {
    case "spark":
      return sparks.length ? "present" : "empty";
    case "logline":
      return summary ? "present" : "empty";
    case "selling":
      return sellingFilled >= 3 ? "present" : sellingFilled ? "partial" : "empty";
    case "positioning":
      return positioningFilled >= 3 ? "present" : positioningFilled ? "partial" : "empty";
    case "trick":
      return truthClaims.length ? "present" : "empty";
    case "relations":
      return relationships.length ? "present" : "empty";
    case "timeline":
      return counts.chapters > 0 ? "present" : "empty";
    case "evidence":
      return counts.clues > 0 ? "present" : "empty";
    case "profiles":
      return counts.roles > 0 || counts.sections > 0 ? (counts.roles > 0 && counts.sections > 0 ? "present" : "partial") : "empty";
    case "arcs":
      return counts.sections > 0 ? (publishedSections > 0 ? "present" : "partial") : "empty";
    case "foreshadow":
      return truthClaims.length || relationships.length ? "present" : "empty";
    case "beats":
      return segments.length ? "present" : counts.chapters > 0 ? "partial" : "empty";
    case "clue-matrix":
      return counts.clues > 0 ? "present" : "empty";
    case "mechanics":
      return counts.enabledRules > 0 ? "present" : "empty";
    case "dm-sandbox":
      return counts.rooms > 0 ? "present" : "empty";
    case "player-book":
      return counts.sections > 0 ? "present" : "empty";
    case "dm-manual":
      return segments.some((s) => s.operations?.flow || s.operations?.hostTruth) ? "present" : segments.length ? "partial" : "empty";
    case "props":
      return counts.scenes > 0 || counts.clues > 0 ? "present" : "empty";
    case "package":
      return counts.sections > 0 || counts.chapters > 0 ? "present" : "empty";
    case "diagnostics":
      return diagnostics ? "present" : (counts.clues > 0 || truthClaims.length > 0 ? "partial" : "empty");
    case "ai-playtest":
      return playtest ? "present" : (counts.roles > 0 && counts.sections > 0 ? "partial" : "empty");
    case "test-room":
      return counts.rooms > 0 ? "present" : "empty";
    case "feedback":
      return counts.rooms > 0 ? "present" : "empty";
    case "readiness":
      return checks.length ? "present" : "empty";
    default:
      return "empty";
  }
}

function itemObservation(id, ctx) {
  const { counts = {}, segments = [], truthClaims = [], relationships = [], studio, draft = {}, checks = [], diagnostics, playtest } = ctx;
  const summary = String(studio?.world?.summary || draft.logline || "").trim();
  const sparks = draft.sparks || [];
  const sellingFilled = (draft.sellingPoints || []).filter(Boolean).length;
  const pub = (studio?.sections || []).filter((s) => s.publication_status && s.publication_status !== "draft").length;
  const segWithFlow = segments.filter((s) => s.operations?.flow || s.operations?.hostTruth).length;
  const err = checks.filter((c) => c.level === "error").length;
  const warn = checks.filter((c) => c.level === "warning").length;

  const map = {
    spark: sparks.length ? `${sparks.length} 张灵感卡` : "尚无灵感卡",
    logline: summary ? `${summary.length} 字 · 与世界简介同步` : "世界简介为空",
    selling: sellingFilled ? `${sellingFilled} / 3 个卖点槽已填写` : "卖点槽为空",
    positioning: [draft.target, draft.duration, draft.type].filter(Boolean).length
      ? `定位字段 ${[draft.target, draft.duration, draft.type].filter(Boolean).length} / 3 已填写`
      : "定位字段为空",
    trick: `${truthClaims.length} 条核心事实`,
    relations: `${relationships.length} 条关系 · ${counts.roles || 0} 个角色`,
    timeline: `${counts.chapters || 0} 章 · ${counts.scenes || 0} 场景`,
    evidence: `${counts.clues || 0} 条线索 · ${counts.investigationPoints || 0} 调查点`,
    profiles: `${counts.roles || 0} 角色 · ${counts.sections || 0} 分幕`,
    arcs: `${counts.sections || 0} 分幕 · ${pub} 非草稿发布态`,
    foreshadow: `${truthClaims.length} 断言 · ${relationships.length} 关系`,
    beats: `${segments.length} Segment · ${segWithFlow} 含 runbook 字段`,
    "clue-matrix": `${counts.clues || 0} 线索 · ${counts.roles || 0} 角色`,
    mechanics: `${counts.enabledRules || 0} 条启用规则`,
    "dm-sandbox": `${counts.rooms || 0} 个运行房`,
    "player-book": `${counts.sections || 0} 分幕 · ${counts.chapters || 0} 章`,
    "dm-manual": `${segments.length} Segment · ${segWithFlow} 含 flow/hostTruth`,
    props: `${counts.scenes || 0} 场景 · ${counts.clues || 0} 线索`,
    package: "内容包导入 / 导出",
    diagnostics: diagnostics
      ? `${diagnostics.scores?.overall ?? 0} 分 · ${diagnostics.summary?.danger ?? 0} 个高风险`
      : "尚未运行作品诊断",
    "ai-playtest": playtest
      ? `${playtest.report?.players?.length || 0} 个席位 · ${playtest.issueCount ?? playtest.report?.issues?.length ?? 0} 个问题`
      : "尚未运行机器压力测试",
    "test-room": `${counts.rooms || 0} 个运行房`,
    feedback: "跑局完成率与线索命中统计",
    readiness: checks.length ? `系统检查 ${checks.length} 条 · error ${err} · warning ${warn}` : "尚未运行系统检查"
  };
  return map[id] || "点击查看画布";
}

export function buildLiveStages(ctx) {
  return STAGE_DEFS.map((stage) => ({
    ...stage,
    items: stage.items.map((item) => ({
      ...item,
      status: itemPresence(item.id, ctx),
      hint: itemObservation(item.id, ctx)
    }))
  }));
}

export function completionPercent(stage) {
  const weights = { present: 1, partial: 0.55, empty: 0 };
  const score = stage.items.reduce((sum, item) => sum + (weights[item.status] || 0), 0);
  return Math.round((score / stage.items.length) * 100);
}

export const SPARK_TAGS = ["高概念", "社会派", "诡计", "情感", "机制", "题材", "其他"];

export const LOGLINE_TEMPLATE =
  "这是一个【类型】本，【人数】个【角色状态】在【核心场景】中，他们必须【核心目标】，但【最大反转/压力源】。主打【核心卖点】。";

const CHECK_TARGET_MAP = {
  roles: { stage: "characters", item: "profiles" },
  sections: { stage: "characters", item: "arcs", view: "writer" },
  chapters: { stage: "architecture", item: "timeline" },
  segments: { stage: "flow", item: "beats" },
  scenes: { stage: "manuscript", item: "props", view: "studio" },
  clues: { stage: "architecture", item: "evidence", view: "clues" },
  investigation_points: { stage: "manuscript", item: "props", view: "studio" },
  studio_graph: { stage: "architecture", item: "timeline", view: "studio" },
  rules: { stage: "flow", item: "mechanics", view: "rules" },
  rooms: { stage: "launch", item: "test-room", action: "world-rooms" }
};

export function resolveCheckTarget(target) {
  if (!target?.kind) return null;
  return CHECK_TARGET_MAP[target.kind] || null;
}

/** Neutral text stats for logline panel — no quality rules. */
export function loglineStats(text = "") {
  const t = String(text).trim();
  if (!t) return "尚未写入梗概";
  const lines = t.split(/\n+/).filter(Boolean).length;
  return `${t.length} 字${lines > 1 ? ` · ${lines} 行` : ""} · 写入世界简介`;
}

export function buildContentOverview(ctx) {
  const { counts = {}, studio, draft = {}, segments = [], truthClaims = [], relationships = [], bibleSummary } = ctx;
  const bc = bibleSummary?.counts || {};
  const summary = String(studio?.world?.summary || draft.logline || "").trim();
  return [
    ["世界简介", summary ? `${summary.length} 字` : "空"],
    ["灵感卡", `${bc.sparks ?? (draft.sparks || []).length} 张`],
    ["核心谜底", bc.coreTrick ? "已写入" : "未写入"],
    ["真相 / 关系", `${bc.truthClaims ?? truthClaims.length} / ${bc.relationships ?? relationships.length}`],
    ["案件时间线", `${bc.timelineEvents ?? 0} 条`],
    ["伏笔", `${bc.foreshadowBeats ?? 0} 条`],
    ["平行物料册", `${bc.materialBooklets ?? 0} 册`],
    ["角色档案", `${bc.roleArchivesFilled ?? 0} / ${bc.roleArchives ?? 0} 有内容`],
    ["角色 / 分幕", `${counts.roles || 0} / ${counts.sections || 0}`],
    ["章节 / 场景", `${counts.chapters || 0} / ${counts.scenes || 0}`],
    ["Segment / runbook", `${bc.segments ?? segments.length} / ${bc.segmentsWithFlow ?? 0}`],
    ["线索", `${counts.clues || 0} 条`],
    ["运行房", `${counts.rooms || 0} 个`]
  ];
}

export function newSparkId() {
  return `spark-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function statusText(status) {
  return ({ present: "有内容", partial: "部分", empty: "未写入" })[status] || "未写入";
}

export function findItemLink(stageId, itemId) {
  const stage = STAGE_DEFS.find((s) => s.id === stageId);
  return stage?.items.find((i) => i.id === itemId)?.link || null;
}

export function defaultCanvasForItem(stageId, itemId) {
  return findItemLink(stageId, itemId)?.canvas || CANVAS_MODES[stageId]?.[0] || "logline";
}

export function draftStorageKey(worldId, userId = "") {
  const owner = encodeURIComponent(String(userId || "__anonymous__"));
  const world = encodeURIComponent(String(worldId || "__none__"));
  return `zhimuCreatorCockpitDraft:user:${owner}:world:${world}`;
}

export function defaultDraft(studio) {
  const summary = studio?.world?.summary || "";
  const brief = studio?.world?.settings?.creatorBrief || {};
  return {
    activeStage: "concept",
    activeItem: "story",
    activeCanvas: "story",
    selectedSegmentId: null,
    logline: summary,
    spark: "",
    sparks: Array.isArray(brief.sparks) ? brief.sparks : [],
    sparkDraft: "",
    sparkTag: SPARK_TAGS[0],
    sellingPoints: Array.isArray(brief.sellingPoints) ? brief.sellingPoints : ["", "", ""],
    target: brief.target || "",
    duration: brief.duration || "",
    type: brief.type || "",
    magicNote: brief.magicNote || "此处展示作品数据与内容预览，不对剧情设计作评判。",
    copilotQuery: "",
    lastAnalysis: null,
    lastAiNote: ""
  };
}

export function mergeDraftFromSources(parsed, studio) {
  const base = defaultDraft(studio);
  return {
    ...base,
    ...parsed,
    logline: parsed.logline ?? base.logline,
    sellingPoints: Array.isArray(parsed.sellingPoints) ? parsed.sellingPoints : base.sellingPoints,
    sparks: Array.isArray(parsed.sparks) ? parsed.sparks : base.sparks,
    selectedSegmentId: parsed.selectedSegmentId ?? base.selectedSegmentId,
    copilotQuery: parsed.copilotQuery ?? base.copilotQuery,
    lastAnalysis: parsed.lastAnalysis ?? base.lastAnalysis,
    lastAiNote: parsed.lastAiNote ?? base.lastAiNote
  };
}

export function briefSettingsPatch(draft) {
  return {
    creatorBrief: {
      sellingPoints: draft.sellingPoints,
      target: draft.target,
      duration: draft.duration,
      type: draft.type,
      sparks: draft.sparks,
      magicNote: draft.magicNote
    }
  };
}
