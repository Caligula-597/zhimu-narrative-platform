/**
 * Canonical narrative product profile shared by Creator, Host, Player and backend.
 *
 * `worldMode` is a legacy onboarding hint. New code should persist and consume
 * `settings.narrativeProfile`, while keeping `worldMode` in sync until every
 * legacy caller has migrated.
 */

export const NARRATIVE_PROFILE_VERSION = 1;
export const CREATION_TYPES = Object.freeze(["murder_mystery", "tabletop_rpg", "board_game", "interactive_story"]);
export const RUN_FORMATS = Object.freeze(["single_session", "campaign"]);
export const ROLE_MODES = Object.freeze(["fixed", "player_created", "mixed"]);
export const RULESET_MODES = Object.freeze(["none", "system_neutral", "custom"]);
export const LEGACY_WORLD_MODES = Object.freeze(["scripted", "campaign", "hybrid"]);

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
  board_game: Object.freeze({
    role: "玩家席位",
    roleShort: "玩家",
    act: "阶段",
    scene: "区域",
    clue: "卡牌 / 信息",
    secret: "隐藏信息",
    host: "设计者 / 裁判",
    work: "桌游"
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

export const NARRATIVE_MODE_PROFILES = Object.freeze({
  murder_mystery: Object.freeze({
    key: "murder_mystery",
    label: "剧本杀",
    description: "固定或半固定角色、分幕阅读、搜证、指认与结局复盘。",
    defaultRunFormat: "single_session",
    defaultRoleMode: "fixed",
    defaultRulesetMode: "none",
    terminology: CREATOR_TERMINOLOGY.murder_mystery
  }),
  tabletop_rpg: Object.freeze({
    key: "tabletop_rpg",
    label: "桌面角色扮演",
    description: "角色卡、场景行动、判定与可持续多场次战役。",
    defaultRunFormat: "campaign",
    defaultRoleMode: "mixed",
    defaultRulesetMode: "system_neutral",
    terminology: CREATOR_TERMINOLOGY.tabletop_rpg
  }),
  board_game: Object.freeze({
    key: "board_game",
    label: "桌游",
    description: "自由组合棋盘、牌堆、标记、轨道、阶段与自定义组件。",
    defaultRunFormat: "single_session",
    defaultRoleMode: "player_created",
    defaultRulesetMode: "custom",
    terminology: CREATOR_TERMINOLOGY.board_game
  }),
  interactive_story: Object.freeze({
    key: "interactive_story",
    label: "互动叙事",
    description: "章节、角色视角、场景选择与导演控制的互动故事。",
    defaultRunFormat: "single_session",
    defaultRoleMode: "fixed",
    defaultRulesetMode: "none",
    terminology: CREATOR_TERMINOLOGY.interactive_story
  })
});

const LEGACY_DEFAULTS = Object.freeze({
  scripted: Object.freeze({
    creationType: "murder_mystery",
    runFormat: "single_session",
    roleMode: "fixed"
  }),
  campaign: Object.freeze({
    creationType: "tabletop_rpg",
    runFormat: "campaign",
    roleMode: "mixed"
  }),
  hybrid: Object.freeze({
    creationType: "murder_mystery",
    runFormat: "campaign",
    roleMode: "fixed"
  })
});

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function enumValue(value, allowed, fallback) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function optionalText(value, maxLength = 120) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function normalizeCreationType(value) {
  return enumValue(value, CREATION_TYPES, "murder_mystery");
}

export function normalizeNarrativeProfile(value = {}, options = {}) {
  const source = record(value);
  const legacyMode = enumValue(
    source.worldMode ?? options.legacyWorldMode,
    LEGACY_WORLD_MODES,
    ""
  );
  const legacyDefaults = LEGACY_DEFAULTS[legacyMode] || {};
  const fallbackCreationType = options.fallbackCreationType || legacyDefaults.creationType || "murder_mystery";
  const creationType = enumValue(source.creationType, CREATION_TYPES, normalizeCreationType(fallbackCreationType));
  const modeDefaults = NARRATIVE_MODE_PROFILES[creationType];
  const runFormat = enumValue(
    source.runFormat,
    RUN_FORMATS,
    legacyDefaults.runFormat || modeDefaults.defaultRunFormat
  );
  const roleMode = enumValue(
    source.roleMode,
    ROLE_MODES,
    legacyDefaults.roleMode || modeDefaults.defaultRoleMode
  );
  const rulesetSource = record(source.ruleset);
  const rulesetMode = enumValue(
    rulesetSource.mode,
    RULESET_MODES,
    modeDefaults.defaultRulesetMode
  );

  return {
    version: NARRATIVE_PROFILE_VERSION,
    creationType,
    runFormat,
    roleMode,
    ruleset: {
      mode: rulesetMode,
      key: optionalText(rulesetSource.key, 80),
      diceNotation: optionalText(rulesetSource.diceNotation, 80)
    }
  };
}

export function narrativeProfileFromSettings(settings = {}) {
  const source = record(settings);
  return normalizeNarrativeProfile(source.narrativeProfile, {
    legacyWorldMode: source.worldMode,
    fallbackCreationType: source.creationType
  });
}

export function legacyWorldModeForNarrativeProfile(value = {}) {
  const profile = normalizeNarrativeProfile(value);
  if (profile.creationType === "tabletop_rpg") return "campaign";
  if (profile.creationType === "board_game") return "campaign";
  if (profile.runFormat === "campaign") return "hybrid";
  return "scripted";
}

export function normalizeNarrativeSettings(settings = {}) {
  const source = record(settings);
  const narrativeProfile = narrativeProfileFromSettings(source);
  return {
    ...source,
    creationType: narrativeProfile.creationType,
    worldMode: legacyWorldModeForNarrativeProfile(narrativeProfile),
    narrativeProfile
  };
}

export function normalizeNarrativeSettingsPatch(settings = {}) {
  const source = record(settings);
  const hasNarrativeField = ["narrativeProfile", "creationType", "worldMode"]
    .some((key) => Object.hasOwn(source, key));
  return hasNarrativeField ? normalizeNarrativeSettings(source) : { ...source };
}

export function narrativeModeDefinition(value) {
  return NARRATIVE_MODE_PROFILES[normalizeCreationType(value)];
}

export function creatorTerms(value) {
  return CREATOR_TERMINOLOGY[normalizeCreationType(value)];
}
