export const PLAY_STRUCTURE_PROFILES = Object.freeze({
  mystery: Object.freeze({
    key: "mystery",
    label: "推理案件",
    description: "以可还原事实、嫌疑与证据链为主要推进力。",
    requiresCulprit: true,
    requiresPlayableDecision: false
  }),
  faction: Object.freeze({
    key: "faction",
    label: "阵营博弈",
    description: "以角色利益、资源流动、结盟与背叛为主要推进力。",
    requiresCulprit: false,
    requiresPlayableDecision: true
  }),
  mechanism: Object.freeze({
    key: "mechanism",
    label: "机制叙事",
    description: "以多轮可操作机制及其累积后果为主要推进力。",
    requiresCulprit: false,
    requiresPlayableDecision: true
  }),
  hybrid: Object.freeze({
    key: "hybrid",
    label: "混合结构",
    description: "事实还原与阵营、资源或机制共同决定结果。",
    requiresCulprit: false,
    requiresPlayableDecision: true
  })
});

export const PLAY_STRUCTURE_KEYS = Object.freeze(Object.keys(PLAY_STRUCTURE_PROFILES));

export function normalizePlayStructure(value) {
  const key = String(value || "").trim();
  return PLAY_STRUCTURE_KEYS.includes(key) ? key : "mystery";
}

export function playStructureProfile(value) {
  return PLAY_STRUCTURE_PROFILES[normalizePlayStructure(value)];
}
