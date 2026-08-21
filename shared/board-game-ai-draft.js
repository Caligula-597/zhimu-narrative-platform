import { normalizeBoardGameDesign } from "./board-game-design.js";
import { compileBoardGameEngine } from "./board-game-engine.js";

export const BOARD_GAME_AI_DRAFT_SCOPES = Object.freeze(["patch", "missing", "current", "full"]);
export const BOARD_GAME_AI_DRAFT_SECTIONS = Object.freeze(["components", "seats", "mechanisms", "engine", "rulebook"]);
const RULEBOOK_FIELDS = Object.freeze(["objective", "setup", "turnStructure", "playerActions", "endCondition", "tieBreak", "notes"]);
const UNSUPPORTED_REQUEST_PATTERNS = Object.freeze([
  { capabilityId: "action.bid", pattern: /拍卖|竞价|出价|auction|bidding/i, reason: "通用竞价比较与并列结算尚未进入 V1 运行时。" },
  { capabilityId: "action.draw", pattern: /抽牌|牌堆|手牌管理|deck|draw card/i, reason: "逐张卡牌与牌堆实例尚未进入 V1 运行时。" },
  { capabilityId: "info.private", pattern: /个人私密|隐藏手牌|秘密信息|private information/i, reason: "单屏试玩不能提供按设备隔离的个人私密信息。" },
  { capabilityId: "random.seeded", pattern: /随机|掷骰|骰子|洗牌|random|dice|shuffle/i, reason: "V1 不代替实体骰子或洗牌执行随机结果。" }
]);

const clone = (value) => structuredClone(value);
const text = (value) => String(value ?? "").trim();

export function detectedUnsupportedBoardGameRequirements(instructions) {
  return UNSUPPORTED_REQUEST_PATTERNS.filter((item) => item.pattern.test(String(instructions || ""))).map((item) => ({
    capabilityId: item.capabilityId,
    description: `作者要求包含「${item.capabilityId}」能力。`,
    reason: item.reason
  }));
}

function mergeMissing(current, candidate) {
  const next = clone(current);
  if (!text(next.designGoal)) next.designGoal = candidate.designGoal;
  if (!next.components.length) next.components = clone(candidate.components);
  if (!next.variables.length) next.variables = clone(candidate.variables);
  if (!next.mechanisms.length) next.mechanisms = clone(candidate.mechanisms);
  if (!next.engine.map.nodes.length && !next.engine.actions.length) next.engine = clone(candidate.engine);
  RULEBOOK_FIELDS.forEach((field) => { if (!text(next.rulebook[field])) next.rulebook[field] = candidate.rulebook[field]; });
  return next;
}

function mergeSection(current, candidate, section) {
  const next = clone(current);
  if (section === "seats") next.playerCount = clone(candidate.playerCount);
  else if (section === "mechanisms") { next.variables = clone(candidate.variables); next.mechanisms = clone(candidate.mechanisms); }
  else if (section === "engine") next.engine = clone(candidate.engine);
  else if (section === "rulebook") next.rulebook = clone(candidate.rulebook);
  else next.components = clone(candidate.components);
  return next;
}

export function applyBoardGameAiCandidate(currentValue, candidateValue, options = {}) {
  const current = normalizeBoardGameDesign(currentValue);
  const candidate = normalizeBoardGameDesign(candidateValue, { title: current.title });
  const scope = BOARD_GAME_AI_DRAFT_SCOPES.includes(options.scope) ? options.scope : "missing";
  const section = BOARD_GAME_AI_DRAFT_SECTIONS.includes(options.currentSection) ? options.currentSection : "components";
  let next = scope === "missing" ? mergeMissing(current, candidate) : scope === "current" ? mergeSection(current, candidate, section) : clone(candidate);
  next.title = current.title || candidate.title;
  next.updatedAt = current.updatedAt;
  return normalizeBoardGameDesign(next, { title: next.title });
}

function duplicateIds(items = []) {
  const seen = new Set(); const duplicates = new Set();
  items.forEach((item) => { if (seen.has(item.id)) duplicates.add(item.id); seen.add(item.id); });
  return [...duplicates];
}
const issue = (level, code, message, path = "") => ({ level, code, message, path });

export function validateBoardGameDesignIntegrity(value) {
  const design = normalizeBoardGameDesign(value);
  const issues = [];
  const componentIds = new Set(design.components.map((item) => item.id));
  const variableIds = new Set(design.variables.map((item) => item.id));
  [["COMPONENT", design.components], ["VARIABLE", design.variables], ["MECHANISM", design.mechanisms]].forEach(([name, items]) => duplicateIds(items).forEach((id) => issues.push(issue("error", `${name}_ID_DUPLICATE`, `ID「${id}」重复。`, name.toLowerCase()))));
  design.mechanisms.forEach((mechanism, index) => {
    if (mechanism.sourceComponentId && !componentIds.has(mechanism.sourceComponentId)) issues.push(issue("error", "MECHANISM_COMPONENT_MISSING", `规则「${mechanism.name}」引用了不存在的组件。`, `mechanisms.${index}`));
    mechanism.conditions.forEach((condition) => { if (!variableIds.has(condition.sourceKey)) issues.push(issue("error", "CONDITION_VARIABLE_MISSING", `规则「${mechanism.name}」存在未绑定数值的条件。`, `mechanisms.${index}`)); });
    mechanism.effects.forEach((effect) => { if (!variableIds.has(effect.targetKey)) issues.push(issue("error", "EFFECT_VARIABLE_MISSING", `规则「${mechanism.name}」存在未绑定数值的效果。`, `mechanisms.${index}`)); });
  });
  return [...issues, ...compileBoardGameEngine(design, design.playerCount.min).issues].slice(0, 100);
}

const countEntries = (design) => design.components.reduce((sum, item) => sum + item.entries.length, 0);
const metric = (key, label, before, after) => ({ key, label, before, after, delta: after - before, changed: before !== after });
const same = (before, after) => JSON.stringify(before) === JSON.stringify(after);

export function diffBoardGameDesign(beforeValue, afterValue) {
  const before = normalizeBoardGameDesign(beforeValue); const after = normalizeBoardGameDesign(afterValue);
  const metrics = [
    metric("components", "组件", before.components.length, after.components.length),
    metric("entries", "卡牌条目", countEntries(before), countEntries(after)),
    metric("variables", "数值", before.variables.length, after.variables.length),
    metric("mechanisms", "条件效果", before.mechanisms.length, after.mechanisms.length),
    metric("regions", "地图区域", before.engine.map.nodes.length, after.engine.map.nodes.length),
    metric("routes", "地图路线", before.engine.map.edges.length, after.engine.map.edges.length),
    metric("runtimeActions", "试玩行动", before.engine.actions.length, after.engine.actions.length),
    metric("rulebook", "说明书字段", RULEBOOK_FIELDS.filter((field) => text(before.rulebook[field])).length, RULEBOOK_FIELDS.filter((field) => text(after.rulebook[field])).length)
  ];
  const changedFields = [];
  if (before.designGoal !== after.designGoal) changedFields.push("设计目标");
  [["人数范围", before.playerCount, after.playerCount], ["组件与素材", before.components, after.components], ["可计算数值", before.variables, after.variables], ["条件与效果", before.mechanisms, after.mechanisms], ["试玩引擎", before.engine, after.engine], ["游戏说明书", before.rulebook, after.rulebook]].forEach(([label, left, right]) => { if (!same(left, right)) changedFields.push(label); });
  return { changed: changedFields.length > 0, metrics, changedFields };
}

export function createBoardGameAiDraftPreview(currentValue, candidateValue, options = {}) {
  const draft = applyBoardGameAiCandidate(currentValue, candidateValue, options);
  const issues = validateBoardGameDesignIntegrity(draft);
  const engineReport = compileBoardGameEngine(draft, draft.playerCount.min);
  return { draft, diff: diffBoardGameDesign(currentValue, draft), issues, engineReport, blocking: issues.some((item) => item.level === "error") };
}
