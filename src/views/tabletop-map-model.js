import { normalizeTabletopSystem } from "../../shared/tabletop-system.js";
import { normalizeLocationDiscoveryCopy } from "../../shared/location-discovery.js";

export const TABLETOP_MAP_SCHEMA_VERSION = 6;

export const VARIABLE_COLORS = Object.freeze([
  "#3d8b6d",
  "#d89b38",
  "#d65f52",
  "#5f78b8",
  "#8b65a5",
  "#4f8f9d",
  "#9a7348",
  "#5f7751"
]);

export const CONDITION_OPERATORS = Object.freeze([">=", "<=", ">", "<", "==", "!="]);

export const DEFAULT_VARIABLES = Object.freeze([
  { id: "evidence", label: "证据", color: VARIABLE_COLORS[0], min: 0, max: 100, value: 62 },
  { id: "threat", label: "威胁", color: VARIABLE_COLORS[1], min: 0, max: 100, value: 48 },
  { id: "bond", label: "羁绊", color: VARIABLE_COLORS[2], min: 0, max: 100, value: 71 }
]);

// Kept for older imports while schema v2 uses creator-defined variables.
export const MAP_VALUE_META = Object.freeze(Object.fromEntries(
  DEFAULT_VARIABLES.map((variable) => [variable.id, { label: variable.label, color: variable.color }])
));

const DEFAULT_LOCATIONS = [
  {
    id: "clock-archive",
    name: "钟楼档案室",
    type: "室内场景",
    description: "市政钟楼的顶层档案室，存放着旧城历史与机关文件。",
    x: 0.54,
    y: 0.27,
    z: 3,
    checks: [{
      id: "search-archive",
      label: "检索封存档案",
      instruction: "说明如何定位被改写的卷宗，并进行一次调查判定。",
      target: 12,
      bonus: 0,
      rollMode: "normal",
      successText: "你找到一处可验证的改写痕迹。",
      failureText: "翻找惊动了钟楼守卫，但仍可换一种方式继续。",
      successEffects: { evidence: 12, threat: 0, bond: 0 },
      failureEffects: { evidence: 0, threat: 8, bond: 0 }
    }],
    effects: { evidence: 18, threat: 4, bond: 0 }
  },
  {
    id: "council-square",
    name: "议会广场",
    type: "公共场景",
    description: "公开质询与阵营表态的主要舞台，容易引发群体事件。",
    x: 0.78,
    y: 0.48,
    z: 1,
    effects: { evidence: 4, threat: 12, bond: 8 }
  },
  {
    id: "mist-pier",
    name: "雾影码头",
    type: "危险场景",
    description: "潮水与雾气掩盖了走私者的撤离路线。",
    x: 0.66,
    y: 0.76,
    z: 0,
    encounterNpcIds: ["dock-guard"],
    checks: [{
      id: "cross-fog-pier",
      label: "穿过浓雾封锁",
      instruction: "描述队伍如何穿过码头封锁，并进行一次行动判定。",
      target: 14,
      bonus: 0,
      rollMode: "normal",
      successText: "队伍抢在守卫合围前抵达撤离点。",
      failureText: "队伍仍能抵达，但会暴露位置或付出额外代价。",
      successEffects: { evidence: 4, threat: -8, bond: 4 },
      failureEffects: { evidence: 0, threat: 12, bond: -4 }
    }],
    effects: { evidence: 8, threat: 18, bond: -6 }
  },
  {
    id: "old-alley",
    name: "旧城区巷道",
    type: "探索场景",
    description: "密集的旧屋与支路适合追踪、伏击和秘密交换。",
    x: 0.31,
    y: 0.66,
    z: 1,
    effects: { evidence: 10, threat: 8, bond: 4 }
  },
  {
    id: "waterworks",
    name: "废弃水渠",
    type: "机关场景",
    description: "通往城墙下方的旧水道，隐藏着一次高风险捷径。",
    x: 0.18,
    y: 0.45,
    z: 0,
    encounterNpcIds: ["fog-priest"],
    effects: { evidence: 6, threat: 15, bond: -4 }
  },
  {
    id: "hidden-garden",
    name: "隐秘花园",
    type: "休整场景",
    description: "角色可以交换秘密、修复关系，也可能错过推进时机。",
    x: 0.29,
    y: 0.27,
    z: 2,
    effects: { evidence: 0, threat: -8, bond: 16 }
  }
];

const DEFAULT_ROUTES = [
  ["clock-archive", "council-square"],
  ["clock-archive", "hidden-garden"],
  ["clock-archive", "old-alley"],
  ["council-square", "mist-pier"],
  ["council-square", "old-alley"],
  ["mist-pier", "old-alley"],
  ["old-alley", "waterworks"]
];

const LEGACY_DEFAULT_ENDINGS = [
  {
    id: "dawn-truth",
    name: "破晓真相",
    summary: "真相完整公开，众人赶在局势失控前完成收束。",
    tone: "resolve",
    requirements: [
      { key: "evidence", operator: ">=", value: 70 },
      { key: "threat", operator: "<=", value: 40 }
    ]
  },
  {
    id: "wounded-exit",
    name: "带伤离场",
    summary: "真相仍有缺口，但角色之间的信任足以带人离开。",
    tone: "cost",
    requirements: [
      { key: "evidence", operator: ">=", value: 50 },
      { key: "bond", operator: ">=", value: 60 }
    ]
  },
  {
    id: "fog-devours",
    name: "迷雾吞城",
    summary: "威胁突破控制线，局势以失守或牺牲告终。",
    tone: "danger",
    requirements: [
      { key: "threat", operator: ">=", value: 70 },
      { key: "bond", operator: "<=", value: 45 }
    ]
  }
];

function clamp(value, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value, fallback = "", max = 500) {
  const text = String(value ?? fallback).trim();
  return (text || fallback).slice(0, max);
}

function cleanId(value, fallback = "item") {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueId(candidate, prefix, usedIds) {
  const base = cleanId(candidate, `${prefix}-${usedIds.size + 1}`);
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function normalizeVariables(rawVariables, legacyValues) {
  const source = Array.isArray(rawVariables) && rawVariables.length
    ? rawVariables.slice(0, 8)
    : DEFAULT_VARIABLES.map((variable) => ({
      ...variable,
      value: legacyValues?.[variable.id] ?? variable.value
    }));
  const usedIds = new Set();
  return source.map((raw = {}, index) => {
    const fallback = DEFAULT_VARIABLES[index] || {
      id: `variable-${index + 1}`,
      label: `变量 ${index + 1}`,
      color: VARIABLE_COLORS[index % VARIABLE_COLORS.length],
      min: 0,
      max: 100,
      value: 50
    };
    const id = uniqueId(raw.id, "variable", usedIds);
    const min = clamp(Math.round(finiteNumber(raw.min, fallback.min)), -9999, 9998);
    const max = clamp(Math.round(finiteNumber(raw.max, fallback.max)), min + 1, 9999);
    const legacyValue = legacyValues?.[id];
    return {
      id,
      label: cleanText(raw.label ?? raw.name, fallback.label, 24),
      color: /^#[0-9a-f]{6}$/i.test(String(raw.color || ""))
        ? String(raw.color)
        : VARIABLE_COLORS[index % VARIABLE_COLORS.length],
      min,
      max,
      value: Math.round(clamp(raw.value ?? legacyValue ?? fallback.value, min, max))
    };
  });
}

function normalizeCondition(raw = {}, variables = [], index = 0) {
  const fallbackVariable = variables[0] || DEFAULT_VARIABLES[0];
  const variableId = variables.some((variable) => variable.id === (raw.variableId || raw.key))
    ? (raw.variableId || raw.key)
    : fallbackVariable.id;
  const variable = variables.find((item) => item.id === variableId) || fallbackVariable;
  return {
    id: cleanId(raw.id, `condition-${index + 1}`),
    variableId,
    operator: CONDITION_OPERATORS.includes(raw.operator) ? raw.operator : ">=",
    value: Math.round(clamp(raw.value, variable.min, variable.max))
  };
}

function normalizeEnding(raw = {}, variables = [], index = 0) {
  const rawConditions = Array.isArray(raw.conditions)
    ? raw.conditions
    : Array.isArray(raw.requirements)
      ? raw.requirements
      : [];
  return {
    id: cleanId(raw.id, `ending-${index + 1}`),
    name: cleanText(raw.name, `结局 ${index + 1}`, 60),
    summary: cleanText(raw.summary, "描述这个结局发生时，故事最终呈现的状态。", 300),
    tone: ["resolve", "cost", "danger", "neutral"].includes(raw.tone) ? raw.tone : "neutral",
    priority: Math.round(clamp(raw.priority ?? 0, -99, 99)),
    logic: raw.logic === "any" ? "any" : "all",
    conditions: rawConditions.slice(0, 8).map((condition, conditionIndex) => normalizeCondition(condition, variables, conditionIndex))
  };
}

function normalizeEffects(rawEffects, variables, fallbackEffects = {}) {
  const effects = rawEffects || {};
  return Object.fromEntries(variables.map((variable) => {
    const span = Math.max(1, variable.max - variable.min);
    return [
      variable.id,
      Math.round(clamp(effects[variable.id] ?? fallbackEffects?.[variable.id] ?? 0, -span, span))
    ];
  }));
}

function normalizeLocationChecks(rawChecks, variables = [], defaultTarget = 12) {
  const usedIds = new Set();
  return (Array.isArray(rawChecks) ? rawChecks : []).slice(0, 6).map((raw = {}, index) => ({
    id: uniqueId(raw.id, "check", usedIds),
    label: cleanText(raw.label, `地点判定 ${index + 1}`, 80),
    instruction: cleanText(raw.instruction, "描述行动方式后进行判定。", 240),
    target: Math.round(clamp(raw.target ?? defaultTarget, -9999, 9999)),
    bonus: Math.round(clamp(raw.bonus ?? 0, -999, 999)),
    rollMode: ["normal", "advantage", "disadvantage"].includes(raw.rollMode) ? raw.rollMode : "normal",
    successText: cleanText(raw.successText, "判定成功，获得预期进展。", 240),
    failureText: cleanText(raw.failureText, "判定失败，但故事仍可带着代价继续。", 240),
    successEffects: normalizeEffects(raw.successEffects, variables),
    failureEffects: normalizeEffects(raw.failureEffects, variables)
  }));
}

function normalizeLocation(raw = {}, index = 0, variables = [], npcIds = new Set(), defaultTarget = 12) {
  const fallback = DEFAULT_LOCATIONS[index] || DEFAULT_LOCATIONS[0];
  const encounterSource = Array.isArray(raw.encounterNpcIds)
    ? raw.encounterNpcIds
    : fallback.encounterNpcIds || [];
  return {
    id: cleanId(raw.id, fallback.id || `location-${index + 1}`),
    name: cleanText(raw.name, fallback.name || `新地点 ${index + 1}`, 80),
    type: cleanText(raw.type, fallback.type || "探索场景", 40),
    description: cleanText(raw.description, fallback.description || "", 360),
    hostNotes: cleanText(raw.hostNotes, "", 360),
    segmentKey: cleanText(raw.segmentKey, "", 120),
    discovery: normalizeLocationDiscoveryCopy(raw.discovery),
    x: clamp(raw.x ?? fallback.x, 0.04, 0.96),
    y: clamp(raw.y ?? fallback.y, 0.05, 0.95),
    z: Math.round(clamp(raw.z ?? fallback.z, 0, 8)),
    encounterNpcIds: [...new Set(encounterSource.map(String).filter((id) => npcIds.has(id)))].slice(0, 12),
    checks: normalizeLocationChecks(raw.checks, variables, defaultTarget),
    effects: normalizeEffects(raw.effects, variables, fallback.effects)
  };
}

function normalizeRoutes(raw, locationIds) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : DEFAULT_ROUTES)
    .map((route) => Array.isArray(route) ? route.slice(0, 2).map(String) : [])
    .filter(([from, to]) => {
      if (!from || !to || from === to || !locationIds.has(from) || !locationIds.has(to)) return false;
      const key = [from, to].sort().join(":");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeCanvas(rawCanvas = {}) {
  const mode = ["template", "custom", "blank"].includes(rawCanvas.mode) ? rawCanvas.mode : "template";
  const dataUrl = /^data:image\/(?:png|jpeg|webp);base64,/i.test(String(rawCanvas.dataUrl || ""))
    ? String(rawCanvas.dataUrl).slice(0, 4_500_000)
    : "";
  return {
    mode: mode === "custom" && !dataUrl ? "template" : mode,
    dataUrl,
    fileName: cleanText(rawCanvas.fileName, "", 120),
    gridType: ["square", "hex", "none"].includes(rawCanvas.gridType) ? rawCanvas.gridType : "square",
    gridDensity: Math.round(clamp(rawCanvas.gridDensity ?? 8, 4, 20)),
    width: Math.round(clamp(rawCanvas.width ?? 1600, 640, 2400)),
    height: Math.round(clamp(rawCanvas.height ?? 1067, 480, 1800))
  };
}

export function createDefaultMapDesign(options = {}) {
  const createdAt = new Date().toISOString();
  const variables = clone(DEFAULT_VARIABLES);
  const system = normalizeTabletopSystem(options.system);
  const npcIds = new Set(system.npcs.map((npc) => npc.id));
  return {
    schemaVersion: TABLETOP_MAP_SCHEMA_VERSION,
    title: "雾港旧城",
    updatedAt: createdAt,
    savedAt: "",
    canvas: normalizeCanvas(),
    system,
    variables,
    locations: DEFAULT_LOCATIONS.map((location, index) => normalizeLocation(
      location,
      index,
      variables,
      npcIds,
      system.dice.defaultTarget
    )),
    routes: clone(DEFAULT_ROUTES),
    // Creators define endings themselves; the system only provides the rule builder.
    endings: []
  };
}

export function normalizeMapDesign(raw = {}, options = {}) {
  const fallback = createDefaultMapDesign(options);
  const variables = normalizeVariables(raw.variables, raw.values);
  const system = normalizeTabletopSystem(raw.system || options.system);
  const npcIds = new Set(system.npcs.map((npc) => npc.id));
  const sourceLocations = Array.isArray(raw.locations) && raw.locations.length
    ? raw.locations.slice(0, 24)
    : fallback.locations;
  const locations = sourceLocations.map((location, index) => normalizeLocation(
    location,
    index,
    variables,
    npcIds,
    system.dice.defaultTarget
  ));
  const locationIds = new Set(locations.map((location) => location.id));
  const isLegacyDesign = Number(raw.schemaVersion || 1) < TABLETOP_MAP_SCHEMA_VERSION;
  const sourceEndings = Array.isArray(raw.endings)
    ? raw.endings.slice(0, 12)
    : isLegacyDesign && raw.values
      ? LEGACY_DEFAULT_ENDINGS
      : fallback.endings;
  return {
    schemaVersion: TABLETOP_MAP_SCHEMA_VERSION,
    title: cleanText(raw.title, fallback.title, 80),
    updatedAt: cleanText(raw.updatedAt, fallback.updatedAt, 40),
    savedAt: cleanText(raw.savedAt, "", 40),
    canvas: normalizeCanvas(raw.canvas),
    system,
    variables,
    locations,
    routes: normalizeRoutes(raw.routes, locationIds),
    endings: sourceEndings.map((ending, index) => normalizeEnding(ending, variables, index))
  };
}

function variableLookup(variables) {
  return new Map((variables || []).map((variable) => [variable.id, variable]));
}

export function evaluateCondition(variables, condition) {
  const variable = variableLookup(variables).get(condition.variableId) || DEFAULT_VARIABLES[0];
  const current = clamp(variable.value, variable.min, variable.max);
  const threshold = clamp(condition.value, variable.min, variable.max);
  const span = Math.max(1, variable.max - variable.min);
  let matched = false;
  let progress = 0;
  if (condition.operator === ">=" || condition.operator === ">") {
    matched = condition.operator === ">" ? current > threshold : current >= threshold;
    progress = matched ? 1 : clamp((current - variable.min) / Math.max(1, threshold - variable.min), 0, 1);
  } else if (condition.operator === "<=" || condition.operator === "<") {
    matched = condition.operator === "<" ? current < threshold : current <= threshold;
    progress = matched ? 1 : clamp((variable.max - current) / Math.max(1, variable.max - threshold), 0, 1);
  } else if (condition.operator === "==") {
    matched = current === threshold;
    progress = matched ? 1 : clamp(1 - Math.abs(current - threshold) / span, 0, 1);
  } else {
    matched = current !== threshold;
    progress = matched ? 1 : 0;
  }
  return {
    current,
    threshold,
    matched,
    progress,
    gap: matched ? 0 : Math.abs(current - threshold),
    variable
  };
}

// Compatibility helper for callers that still provide the schema v1 values object.
export function evaluateRequirement(values, requirement) {
  const variable = DEFAULT_VARIABLES.find((item) => item.id === requirement.key) || DEFAULT_VARIABLES[0];
  return evaluateCondition(
    [{ ...variable, value: values?.[requirement.key] ?? variable.value }],
    { variableId: requirement.key, operator: requirement.operator, value: requirement.value }
  );
}

export function evaluateEndings(design) {
  const normalized = normalizeMapDesign(design);
  const results = normalized.endings.map((ending, index) => {
    const conditions = ending.conditions.map((condition) => ({
      ...condition,
      ...evaluateCondition(normalized.variables, condition)
    }));
    const progressValues = conditions.map((condition) => condition.progress);
    const readiness = conditions.length
      ? ending.logic === "any"
        ? Math.max(...progressValues)
        : progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length
      : 0;
    const eligible = conditions.length > 0 && (ending.logic === "any"
      ? conditions.some((condition) => condition.matched)
      : conditions.every((condition) => condition.matched));
    return {
      ...ending,
      index,
      eligible,
      readiness: Math.round(readiness * 100),
      conditions
    };
  });
  const eligible = results.filter((result) => result.eligible);
  const likely = eligible.length
    ? [...eligible].sort((a, b) => b.priority - a.priority || b.readiness - a.readiness || a.index - b.index)[0]
    : [...results].sort((a, b) => b.readiness - a.readiness || b.priority - a.priority || a.index - b.index)[0] || null;
  return {
    values: Object.fromEntries(normalized.variables.map((variable) => [variable.id, variable.value])),
    variables: normalized.variables,
    results,
    likely
  };
}

export function describeCondition(condition, variables = DEFAULT_VARIABLES) {
  const variable = variables.find((item) => item.id === condition.variableId) || DEFAULT_VARIABLES[0];
  return `${variable.label} ${condition.operator} ${Math.round(condition.value)}`;
}

export function describeRequirement(requirement) {
  return describeCondition({
    variableId: requirement.variableId || requirement.key,
    operator: requirement.operator,
    value: requirement.value
  });
}

export function touchMapDesign(design, patch = {}) {
  return normalizeMapDesign({
    ...design,
    ...patch,
    updatedAt: new Date().toISOString()
  });
}
