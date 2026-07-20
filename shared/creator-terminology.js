export const CREATION_TYPES = Object.freeze(["murder_mystery", "tabletop_rpg", "interactive_story"]);

export const CREATOR_TERMINOLOGY = Object.freeze({
  murder_mystery: Object.freeze({
    role: "角色本",
    roleShort: "角色",
    act: "公共幕",
    scene: "场景",
    clue: "线索",
    secret: "秘密",
    host: "主持人",
    work: "剧本"
  }),
  tabletop_rpg: Object.freeze({
    role: "调查员 / PC",
    roleShort: "PC",
    act: "章节",
    scene: "场景",
    clue: "HO",
    secret: "KP 信息",
    host: "KP",
    work: "模组"
  }),
  interactive_story: Object.freeze({
    role: "角色",
    roleShort: "角色",
    act: "章节",
    scene: "场景",
    clue: "信息卡",
    secret: "隐藏信息",
    host: "导演",
    work: "互动故事"
  })
});

export function normalizeCreationType(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return CREATION_TYPES.includes(normalized) ? normalized : "murder_mystery";
}

export function creatorTerms(value) {
  return CREATOR_TERMINOLOGY[normalizeCreationType(value)];
}
