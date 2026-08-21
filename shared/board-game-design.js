import { createDefaultBoardGameEngine, normalizeBoardGameEngine } from "./board-game-engine.js";

export const BOARD_GAME_DESIGN_VERSION = 4;

export const BOARD_GAME_COMPONENT_TYPES = Object.freeze([
  "board",
  "deck",
  "card",
  "token_pool",
  "track",
  "dice",
  "timer",
  "phase",
  "custom"
]);

export const BOARD_GAME_VARIABLE_SCOPES = Object.freeze(["global", "player", "component"]);
export const BOARD_GAME_CONDITION_OPERATORS = Object.freeze(["eq", "neq", "gt", "gte", "lt", "lte", "contains"]);
export const BOARD_GAME_EFFECT_OPERATIONS = Object.freeze(["set", "add", "subtract", "multiply", "min", "max", "toggle"]);

export const BOARD_GAME_MECHANISM_TEMPLATES = Object.freeze([
  { key: "resource_gain", label: "获得资源", trigger: "玩家动作", effect: "add", description: "满足条件后增加金币、行动点或其他资源。" },
  { key: "resource_cost", label: "支付资源", trigger: "玩家动作", effect: "subtract", description: "先判断资源是否足够，再扣除指定数值。" },
  { key: "draw_cards", label: "抽取卡牌", trigger: "玩家动作", effect: "add", description: "从指定牌堆抽取若干张牌。" },
  { key: "discard_cards", label: "弃置卡牌", trigger: "玩家动作", effect: "subtract", description: "弃置手牌或移出指定卡牌。" },
  { key: "move_piece", label: "移动棋子", trigger: "玩家动作", effect: "add", description: "让棋子在格位、区域或路线间移动。" },
  { key: "track_change", label: "推进数值轨", trigger: "状态变化", effect: "add", description: "推进分数、声望、威胁或其他公共轨道。" },
  { key: "dice_result", label: "判定骰点", trigger: "掷骰后", effect: "add", description: "依据骰点区间触发结果。" },
  { key: "conditional_bonus", label: "条件奖励", trigger: "条件满足", effect: "add", description: "满足组合条件后获得额外收益。" },
  { key: "reveal_card", label: "翻开卡牌", trigger: "玩家动作", effect: "set", description: "改变卡牌或区域的公开状态。" },
  { key: "phase_advance", label: "阶段推进", trigger: "回合结束", effect: "add", description: "在回合或阶段结束时推进流程。" },
  { key: "timer_tick", label: "倒计时", trigger: "回合结束", effect: "subtract", description: "每轮减少倒计时并在归零时触发事件。" },
  { key: "score_victory", label: "胜负判断", trigger: "状态变化", effect: "set", description: "达到目标分数或状态后标记胜利。" }
]);

const TYPE_LABELS = Object.freeze({
  board: "棋盘 / 区域",
  deck: "牌堆 / 卡组",
  card: "卡牌 / 卡面",
  token_pool: "棋子 / 资源池",
  track: "数值 / 进度轨",
  dice: "骰子 / 随机器",
  timer: "计时 / 倒计时",
  phase: "回合 / 阶段",
  custom: "自定义组件"
});

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maxLength = 400) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function number(value, fallback = 0, min = -1_000_000_000, max = 1_000_000_000) {
  const parsed = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
}

function integer(value, fallback, min, max) {
  return Math.round(number(value, fallback, min, max));
}

function identifier(value, fallback) {
  const normalized = text(value, 80).replace(/[^a-zA-Z0-9_-]/g, "-");
  return normalized || fallback;
}

function uniqueId(prefix, index = 0) {
  return `${prefix}-${Date.now().toString(36)}-${index + 1}`;
}

export function boardGameComponentTypeLabel(type) {
  return TYPE_LABELS[BOARD_GAME_COMPONENT_TYPES.includes(type) ? type : "custom"];
}

export function createBoardGameSeat(index = 0) {
  return {
    id: uniqueId("seat", index),
    name: `玩家席位 ${index + 1}`,
    sequence: index + 1
  };
}

export function normalizeBoardGameSeat(value, index = 0) {
  const source = record(value);
  return {
    id: identifier(source.id, `seat-${index + 1}`),
    name: text(source.name, 120) || `玩家席位 ${index + 1}`,
    sequence: integer(source.sequence, index + 1, 1, 99)
  };
}

export function createBoardGameComponent(type = "custom", index = 0) {
  const normalizedType = BOARD_GAME_COMPONENT_TYPES.includes(type) ? type : "custom";
  return {
    id: uniqueId("component", index),
    type: normalizedType,
    name: boardGameComponentTypeLabel(normalizedType),
    quantity: 1,
    description: "",
    playerAction: "",
    stateFields: [],
    assets: [],
    entries: [],
    notes: ""
  };
}

export function normalizeBoardGameStateField(value, index = 0) {
  const source = record(value);
  return {
    id: identifier(source.id, `field-${index + 1}`),
    label: text(source.label || source.key, 80) || `状态 ${index + 1}`,
    key: identifier(source.key || source.label, `state_${index + 1}`),
    initialValue: text(source.initialValue, 300)
  };
}

export function normalizeBoardGameAsset(value, index = 0) {
  const source = record(value);
  return {
    id: identifier(source.id, `asset-${index + 1}`),
    assetId: text(source.assetId || source.asset_id, 120),
    fileName: text(source.fileName || source.file_name, 240) || `素材 ${index + 1}`,
    kind: ["image", "document"].includes(source.kind) ? source.kind : "document",
    caption: text(source.caption, 1200)
  };
}

export function normalizeBoardGameEntry(value, index = 0) {
  const source = record(value);
  return {
    id: identifier(source.id, `entry-${index + 1}`),
    name: text(source.name || source.title, 160) || `条目 ${index + 1}`,
    description: text(source.description || source.text, 1600),
    quantity: integer(source.quantity, 1, 1, 9999)
  };
}

export function normalizeBoardGameComponent(value, index = 0) {
  const source = record(value);
  const type = BOARD_GAME_COMPONENT_TYPES.includes(source.type) ? source.type : "custom";
  return {
    id: identifier(source.id, `component-${index + 1}`),
    type,
    name: text(source.name, 120) || boardGameComponentTypeLabel(type),
    quantity: integer(source.quantity, 1, 1, 9999),
    description: text(source.description, 1600),
    playerAction: text(source.playerAction, 1600),
    stateFields: (Array.isArray(source.stateFields) ? source.stateFields : []).slice(0, 40).map(normalizeBoardGameStateField),
    assets: (Array.isArray(source.assets) ? source.assets : []).slice(0, 100).map(normalizeBoardGameAsset),
    entries: (Array.isArray(source.entries) ? source.entries : []).slice(0, 2000).map(normalizeBoardGameEntry),
    notes: text(source.notes, 2400)
  };
}

export function createBoardGameVariable(index = 0) {
  return {
    id: uniqueId("variable", index),
    label: `数值 ${index + 1}`,
    scope: "global",
    initialValue: 0,
    min: 0,
    max: 100
  };
}

export function normalizeBoardGameVariable(value, index = 0) {
  const source = record(value);
  const min = number(source.min, 0);
  const max = number(source.max, Math.max(100, min), min);
  return {
    id: identifier(source.id, `variable-${index + 1}`),
    label: text(source.label, 100) || `数值 ${index + 1}`,
    scope: BOARD_GAME_VARIABLE_SCOPES.includes(source.scope) ? source.scope : "global",
    initialValue: number(source.initialValue, 0, min, max),
    min,
    max
  };
}

export function normalizeBoardGameCondition(value, index = 0) {
  const source = record(value);
  return {
    id: identifier(source.id, `condition-${index + 1}`),
    sourceKey: identifier(source.sourceKey, ""),
    operator: BOARD_GAME_CONDITION_OPERATORS.includes(source.operator) ? source.operator : "gte",
    value: text(source.value, 300)
  };
}

export function normalizeBoardGameEffect(value, index = 0) {
  const source = record(value);
  return {
    id: identifier(source.id, `effect-${index + 1}`),
    targetKey: identifier(source.targetKey, ""),
    operation: BOARD_GAME_EFFECT_OPERATIONS.includes(source.operation) ? source.operation : "add",
    value: text(source.value, 300)
  };
}

export function createBoardGameMechanism(templateKey = "resource_gain", variables = [], index = 0) {
  const template = BOARD_GAME_MECHANISM_TEMPLATES.find((item) => item.key === templateKey) || BOARD_GAME_MECHANISM_TEMPLATES[0];
  const variableKey = variables[0]?.id || "";
  return {
    id: uniqueId("mechanism", index),
    templateKey: template.key,
    name: template.label,
    sourceComponentId: "",
    trigger: template.trigger,
    conditionMode: "all",
    conditions: variableKey ? [{ id: uniqueId("condition"), sourceKey: variableKey, operator: "gte", value: "0" }] : [],
    effects: variableKey ? [{ id: uniqueId("effect"), targetKey: variableKey, operation: template.effect, value: "1" }] : [],
    notes: template.description
  };
}

export function normalizeBoardGameMechanism(value, index = 0) {
  const source = record(value);
  const fallbackTemplate = BOARD_GAME_MECHANISM_TEMPLATES.find((item) => item.key === source.templateKey) || BOARD_GAME_MECHANISM_TEMPLATES[0];
  return {
    id: identifier(source.id, `mechanism-${index + 1}`),
    templateKey: fallbackTemplate.key,
    name: text(source.name, 160) || fallbackTemplate.label,
    sourceComponentId: identifier(source.sourceComponentId, ""),
    trigger: text(source.trigger, 160) || fallbackTemplate.trigger,
    conditionMode: source.conditionMode === "any" ? "any" : "all",
    conditions: (Array.isArray(source.conditions) ? source.conditions : []).slice(0, 40).map(normalizeBoardGameCondition),
    effects: (Array.isArray(source.effects) ? source.effects : []).slice(0, 40).map(normalizeBoardGameEffect),
    notes: text(source.notes, 2400)
  };
}

export function normalizeBoardGameRulebook(value = {}) {
  const source = record(value);
  return {
    objective: text(source.objective, 4000),
    setup: text(source.setup, 8000),
    turnStructure: text(source.turnStructure, 8000),
    playerActions: text(source.playerActions, 8000),
    endCondition: text(source.endCondition, 4000),
    tieBreak: text(source.tieBreak, 2400),
    notes: text(source.notes, 8000)
  };
}

export function createDefaultBoardGameDesign(title = "") {
  return {
    version: BOARD_GAME_DESIGN_VERSION,
    title: text(title, 120),
    designGoal: "",
    playerCount: { min: 2, max: 6 },
    playTimeMinutes: 60,
    seats: [],
    components: [],
    variables: [],
    mechanisms: [],
    engine: createDefaultBoardGameEngine(),
    rulebook: normalizeBoardGameRulebook(),
    updatedAt: null
  };
}

export function normalizeBoardGameDesign(value = {}, { title = "" } = {}) {
  const source = record(value);
  const players = record(source.playerCount);
  const minPlayers = integer(players.min, 2, 1, 99);
  return {
    version: BOARD_GAME_DESIGN_VERSION,
    title: text(source.title || title, 120),
    designGoal: text(source.designGoal, 2400),
    playerCount: {
      min: minPlayers,
      max: integer(players.max, Math.max(6, minPlayers), minPlayers, 99)
    },
    playTimeMinutes: integer(source.playTimeMinutes, 60, 1, 10080),
    seats: (Array.isArray(source.seats) ? source.seats : []).slice(0, 99).map(normalizeBoardGameSeat),
    components: (Array.isArray(source.components) ? source.components : []).slice(0, 300).map(normalizeBoardGameComponent),
    variables: (Array.isArray(source.variables) ? source.variables : []).slice(0, 300).map(normalizeBoardGameVariable),
    mechanisms: (Array.isArray(source.mechanisms) ? source.mechanisms : []).slice(0, 300).map(normalizeBoardGameMechanism),
    engine: normalizeBoardGameEngine(source.engine),
    rulebook: normalizeBoardGameRulebook(source.rulebook),
    updatedAt: text(source.updatedAt, 80) || null
  };
}

function comparable(value) {
  const numeric = Number(value);
  return String(value ?? "").trim() !== "" && Number.isFinite(numeric) ? numeric : String(value ?? "");
}

export function evaluateBoardGameCondition(condition, state) {
  const left = comparable(record(state)[condition.sourceKey]);
  const right = comparable(condition.value);
  switch (condition.operator) {
    case "eq": return left === right;
    case "neq": return left !== right;
    case "gt": return left > right;
    case "gte": return left >= right;
    case "lt": return left < right;
    case "lte": return left <= right;
    case "contains": return String(left).includes(String(right));
    default: return false;
  }
}

export function applyBoardGameEffect(effect, state, variables = []) {
  const current = record(state)[effect.targetKey];
  const operand = comparable(effect.value);
  let next;
  switch (effect.operation) {
    case "set": next = operand; break;
    case "add": next = number(current) + number(operand); break;
    case "subtract": next = number(current) - number(operand); break;
    case "multiply": next = number(current) * number(operand, 1); break;
    case "min": next = Math.min(number(current), number(operand)); break;
    case "max": next = Math.max(number(current), number(operand)); break;
    case "toggle": next = !(current === true || current === 1 || current === "1" || current === "true"); break;
    default: next = current;
  }
  const variable = variables.find((item) => item.id === effect.targetKey);
  if (variable && typeof next === "number") next = Math.max(variable.min, Math.min(variable.max, next));
  return next;
}

export function simulateBoardGameMechanism(mechanism, state = {}, variables = []) {
  const normalized = normalizeBoardGameMechanism(mechanism);
  const results = normalized.conditions.map((condition) => evaluateBoardGameCondition(condition, state));
  const passed = results.length === 0 || (normalized.conditionMode === "any" ? results.some(Boolean) : results.every(Boolean));
  const nextState = { ...record(state) };
  if (passed) normalized.effects.forEach((effect) => { nextState[effect.targetKey] = applyBoardGameEffect(effect, nextState, variables); });
  return { passed, conditionResults: results, state: nextState };
}

export function initialBoardGameState(variables = []) {
  return Object.fromEntries(variables.map((variable, index) => {
    const normalized = normalizeBoardGameVariable(variable, index);
    return [normalized.id, normalized.initialValue];
  }));
}

export function assessBoardGameReadiness(design) {
  const normalized = normalizeBoardGameDesign(design);
  const checks = [
    { key: "players", label: "至少 2 个玩家席位", passed: normalized.seats.length >= 2 },
    { key: "components", label: "至少 1 个桌面组件", passed: normalized.components.length >= 1 },
    { key: "objective", label: "写明目标与结束条件", passed: Boolean(normalized.rulebook.objective && normalized.rulebook.endCondition) },
    { key: "flow", label: "写明准备与回合流程", passed: Boolean(normalized.rulebook.setup && normalized.rulebook.turnStructure) },
    { key: "actions", label: "写明玩家可执行动作", passed: Boolean(normalized.rulebook.playerActions) },
    { key: "variables", label: "至少 1 个可计算数值", passed: normalized.variables.length >= 1 },
    { key: "mechanisms", label: "至少 1 条可执行机制", passed: normalized.mechanisms.some((item) => item.effects.length > 0) },
    { key: "map", label: "至少 1 个可操作地图区域", passed: normalized.engine.map.nodes.length >= 1 },
    { key: "runtime", label: "至少 1 个阶段和行动", passed: normalized.engine.phases.length >= 1 && normalized.engine.actions.length >= 1 }
  ];
  return {
    checks,
    passed: checks.filter((item) => item.passed).length,
    total: checks.length,
    ready: checks.every((item) => item.passed)
  };
}
