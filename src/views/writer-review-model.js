export const REVIEW_ROLES = new Set(["owner", "editor", "reviewer"]);
export const EDITOR_ROLES = new Set(["owner", "editor"]);
export const MAX_REVIEW_BODY_LENGTH = 10_000;
export const MAX_REVIEW_TITLE_LENGTH = 300;
export const MAX_SUGGESTED_PATCH_PROPERTIES = 100;
export const MAX_SUGGESTED_PATCH_BYTES = 32 * 1024;

export const STATUS_LABELS = { open: "待处理", resolved: "已解决", dismissed: "已驳回" };
export const SEVERITY_LABELS = { note: "备注", minor: "轻微", major: "重要", blocking: "阻塞" };
export const KIND_LABELS = { comment: "批注", suggestion: "修改建议", change_request: "必须修改" };
export const TARGET_TYPE_LABELS = {
  world: "整个剧本",
  manuscript: "完整母稿",
  role: "角色",
  chapter: "章节",
  script_section: "私人分幕",
  scene: "场景",
  clue: "线索",
  rule: "自动化规则",
  truth_claim: "真相声明",
  segment: "运行段落"
};
export const IMPACT_LABELS = {
  roles: "角色",
  chapters: "章节",
  sections: "私人分幕",
  scenes: "场景",
  clues: "线索",
  rules: "规则",
  relationships: "角色关系",
  archives: "角色档案",
  segments: "运行段落",
  segment_refs: "段落引用",
  investigation_points: "调查点",
  executions: "执行记录",
  references: "引用"
};
export const DOMAIN_LABELS = {
  roles: "角色",
  chapters: "公共章节",
  sections: "私人分幕",
  scenes: "场景",
  clues: "线索",
  rules: "自动化规则",
  investigationPoints: "调查点",
  edges: "剧情连线",
  truthClaims: "真相声明",
  segments: "运行段落"
};

export function canReviewWorld(world) {
  return REVIEW_ROLES.has(world?.membership_role);
}

export function canResolveReviews(world) {
  return EDITOR_ROLES.has(world?.membership_role);
}

export function targetKey(type, id = "") {
  return `${type}:${id || ""}`;
}

export function splitTargetKey(value = "") {
  const separator = String(value).indexOf(":");
  if (separator < 0) return [String(value), ""];
  return [String(value).slice(0, separator), String(value).slice(separator + 1)];
}

export function creatorReviewTargetGroups(studio = {}, { truthClaims = [], segments = [] } = {}) {
  return [
    { type: "world", label: "剧本级", rows: [{ id: "", label: "整个剧本" }] },
    { type: "manuscript", label: "母稿", rows: [{ id: "", label: "完整剧情母稿" }] },
    { type: "role", label: "角色", rows: (studio.roles || []).map((item) => ({ id: item.id, label: item.name })) },
    { type: "chapter", label: "公共章节", rows: (studio.chapters || []).map((item) => ({ id: item.id, label: item.title })) },
    { type: "script_section", label: "私人分幕", rows: (studio.sections || []).map((item) => ({ id: item.id, label: item.title })) },
    { type: "scene", label: "场景", rows: (studio.scenes || []).map((item) => ({ id: item.id, label: item.name })) },
    { type: "clue", label: "线索", rows: (studio.clues || []).map((item) => ({ id: item.id, label: item.name })) },
    { type: "rule", label: "自动化规则", rows: (studio.rules || []).map((item) => ({ id: item.id, label: item.name })) },
    { type: "truth_claim", label: "真相声明", rows: truthClaims.map((item) => ({ id: item.id, label: item.title || item.claim_key })) },
    { type: "segment", label: "运行段落", rows: segments.map((item) => ({ id: item.id, label: item.title || item.segment_key })) }
  ];
}

export function flattenTargetGroups(groups = []) {
  return groups.flatMap((group) => group.rows.map((row) => {
    const prefix = ["world", "manuscript"].includes(group.type)
      ? ""
      : `${TARGET_TYPE_LABELS[group.type] || group.label} · `;
    return {
      type: group.type,
      id: row.id || "",
      label: `${prefix}${row.label}`
    };
  }));
}

export function reviewImpactText(impact) {
  const entries = Object.entries(impact?.counts || {}).filter(([, value]) => Number(value) > 0);
  if (!entries.length) return "未发现直接结构引用";
  return entries
    .map(([key, value]) => `${IMPACT_LABELS[key] || key} ${Number(value)}`)
    .join(" · ");
}

export function recomputeReviewDirty(session) {
  session.dirty = Boolean(
    session.draft.title.trim()
    || session.draft.body.trim()
    || session.draft.suggestedPatch.trim()
    || Object.values(session.replyDrafts).some((value) => String(value || "").trim())
  );
}

export function suggestedPatchFromRaw(raw) {
  if (!raw) return {};
  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error("结构化修改建议必须是有效 JSON 对象");
  }
  if (!result || Array.isArray(result) || typeof result !== "object") {
    throw new Error("结构化修改建议必须是 JSON 对象");
  }
  if (Object.keys(result).length > MAX_SUGGESTED_PATCH_PROPERTIES) {
    throw new Error(`结构化修改建议不能超过 ${MAX_SUGGESTED_PATCH_PROPERTIES} 个字段`);
  }
  const serialized = JSON.stringify(result);
  const bytes = typeof TextEncoder === "function" ? new TextEncoder().encode(serialized).byteLength : serialized.length * 2;
  if (bytes > MAX_SUGGESTED_PATCH_BYTES) throw new Error("结构化修改建议不能超过 32 KiB");
  return result;
}
