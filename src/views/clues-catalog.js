export const VISIBILITY_LABELS = {
  role: "私密",
  public: "房间公开",
  host: "主持可见"
};

export const CLUE_TYPE_LABELS = {
  text: "文字", document: "文书", image: "图片", physical: "实物",
  testimony: "证词", location: "地点", cipher: "密码", timeline: "时间线",
  relationship: "关系", evidence: "证据", secret: "秘密", audio: "音频", file: "文件"
};

export const CLUE_IMPORTANCE_LABELS = {
  normal: "普通线索", key: "关键线索", prerequisite: "前置钥匙",
  truth_piece: "真相碎片", finale_key: "终局关键", optional: "支线补充",
  red_herring: "烟雾弹"
};

export const CLUE_KIND_LABELS = {
  general: "一般线索", deep: "深入线索", verify: "验证线索",
  misdirect: "误导线索", emotion: "情感线索", mechanic: "机制线索"
};

export const CLUE_TYPE_OPTIONS = Object.entries(CLUE_TYPE_LABELS)
  .map(([id, name]) => ({ id, name }));
export const CLUE_KIND_OPTIONS = Object.entries(CLUE_KIND_LABELS)
  .map(([id, name]) => ({ id, name }));
export const CLUE_IMPORTANCE_OPTIONS = Object.entries(CLUE_IMPORTANCE_LABELS)
  .map(([id, name]) => ({ id, name }));

export function grantModeLabel(mode) {
  return { auto: "自动发放", host_confirm: "主持确认", explore: "探索获得" }[mode] || "";
}

export function relationLabel(type) {
  return { mainline: "主线", parallel: "并列", extension: "延伸" }[type] || "关联";
}

export function clueMetaLabel(clue) {
  const meta = clue?.metadata || {};
  return {
    type: CLUE_TYPE_LABELS[meta.clueType] || CLUE_TYPE_LABELS.text,
    importance: CLUE_IMPORTANCE_LABELS[meta.importance] || CLUE_IMPORTANCE_LABELS.normal,
    kind: CLUE_KIND_LABELS[clue?.clue_kind || clue?.clueKind || "general"] || CLUE_KIND_LABELS.general
  };
}
