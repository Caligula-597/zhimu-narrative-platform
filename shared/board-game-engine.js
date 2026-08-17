export const BOARD_GAME_ENGINE_VERSION = 1;

export const BOARD_GAME_MAP_KINDS = Object.freeze(["area_graph", "hex", "square"]);
export const BOARD_GAME_PHASE_MODES = Object.freeze(["sequential", "simultaneous", "reveal"]);
export const BOARD_GAME_ACTION_KINDS = Object.freeze([
  "move",
  "gain",
  "pay",
  "control",
  "score",
  "mechanism",
  "bid",
  "draw",
  "play",
  "reveal",
  "pass"
]);
export const BOARD_GAME_TARGET_KINDS = Object.freeze([
  "none",
  "any_region",
  "adjacent_region",
  "own_region",
  "opponent_region"
]);

export const BOARD_GAME_ENGINE_CAPABILITIES = Object.freeze([
  { id: "map.area_graph", label: "区域与路线地图", status: "supported", note: "区域、坐标、路线与通行费用均由数据生成。" },
  { id: "map.hex", label: "六角格地图", status: "partial", note: "可以保存六角格定义，但 V1 试玩仍按区域图呈现。" },
  { id: "map.square", label: "方格地图", status: "partial", note: "可以保存方格定义，但 V1 试玩仍按区域图呈现。" },
  { id: "phase.sequential", label: "顺序行动", status: "supported", note: "按席位顺序执行并推进阶段。" },
  { id: "phase.simultaneous", label: "同时选择", status: "supported", note: "逐席位提交后统一公开并按声明顺序结算。" },
  { id: "phase.reveal", label: "同时选择后公开", status: "supported", note: "提交期间隐藏选择，全部提交后统一结算。" },
  { id: "action.move", label: "移动", status: "supported", note: "支持相邻区域和指定区域移动。" },
  { id: "action.gain", label: "获得资源", status: "supported", note: "按变量作用域增加资源。" },
  { id: "action.pay", label: "支付资源", status: "supported", note: "先检查资源，再执行扣除。" },
  { id: "action.control", label: "控制区域", status: "supported", note: "写入区域控制者。" },
  { id: "action.score", label: "计分", status: "supported", note: "更新席位分数或绑定变量。" },
  { id: "action.mechanism", label: "执行条件效果", status: "supported", note: "执行编辑器中的条件与效果规则。" },
  { id: "action.pass", label: "跳过行动", status: "supported", note: "记录跳过并继续流程。" },
  { id: "action.bid", label: "密封竞价与比较", status: "partial", note: "V1 可记录出价与支付，但尚未实现通用并列比较器。" },
  { id: "action.draw", label: "抽牌", status: "partial", note: "V1 可修改手牌数值，尚未运行完整牌堆对象。" },
  { id: "action.play", label: "打出卡牌", status: "partial", note: "V1 可连接规则效果，尚未运行逐张卡牌实例。" },
  { id: "action.reveal", label: "公开对象", status: "partial", note: "V1 可改变公开状态，尚未运行完整信息权限层。" },
  { id: "info.public", label: "公开信息", status: "supported", note: "所有试玩状态均可公开呈现。" },
  { id: "info.private", label: "个人私密信息", status: "partial", note: "数据可按席位保存，当前单屏试玩不提供独立设备隔离。" },
  { id: "info.team", label: "团队私密信息", status: "partial", note: "数据可标注团队范围，当前单屏试玩不提供独立设备隔离。" },
  { id: "random.seeded", label: "可复现随机", status: "unsupported", note: "V1 不代替实体骰子或洗牌执行随机结果。" }
]);

const CAPABILITY_BY_ID = new Map(BOARD_GAME_ENGINE_CAPABILITIES.map((item) => [item.id, item]));

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maxLength = 800) {
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

function clone(value) {
  return structuredClone(value);
}

function duplicateIds(items = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates];
}

function issue(level, code, message, path = "") {
  return { level, code, message, path };
}

function normalizeMapNode(value, index = 0) {
  const source = record(value);
  return {
    id: identifier(source.id, `region-${index + 1}`),
    label: text(source.label || source.name, 120) || `区域 ${index + 1}`,
    x: number(source.x, 15 + (index % 4) * 23, 4, 96),
    y: number(source.y, 20 + Math.floor(index / 4) * 40, 6, 94),
    terrain: identifier(source.terrain, "plain"),
    capacity: integer(source.capacity, 99, 1, 999),
    scoreValue: number(source.scoreValue, 0, -9999, 9999),
    initialOwner: Number.isInteger(Number(source.initialOwner)) ? integer(source.initialOwner, -1, -1, 98) : -1,
    description: text(source.description, 600)
  };
}

function normalizeMapEdge(value, index = 0) {
  const source = record(value);
  return {
    id: identifier(source.id, `route-${index + 1}`),
    from: identifier(source.from, ""),
    to: identifier(source.to, ""),
    cost: number(source.cost, 1, 0, 9999),
    blocked: Boolean(source.blocked),
    bidirectional: source.bidirectional !== false,
    label: text(source.label, 100)
  };
}

function normalizePhase(value, index = 0) {
  const source = record(value);
  return {
    id: identifier(source.id, `phase-${index + 1}`),
    label: text(source.label || source.name, 120) || `阶段 ${index + 1}`,
    mode: BOARD_GAME_PHASE_MODES.includes(source.mode) ? source.mode : "sequential",
    actionIds: (Array.isArray(source.actionIds) ? source.actionIds : []).slice(0, 100).map((item) => identifier(item, "")).filter(Boolean),
    description: text(source.description, 800)
  };
}

function normalizeAction(value, index = 0) {
  const source = record(value);
  const kind = BOARD_GAME_ACTION_KINDS.includes(source.kind) ? source.kind : "mechanism";
  return {
    id: identifier(source.id, `action-${index + 1}`),
    label: text(source.label || source.name, 120) || `行动 ${index + 1}`,
    kind,
    phaseId: identifier(source.phaseId, ""),
    target: BOARD_GAME_TARGET_KINDS.includes(source.target) ? source.target : "none",
    resourceKey: identifier(source.resourceKey, ""),
    cost: number(source.cost, 0, 0, 999999),
    amount: number(source.amount, kind === "pay" ? 1 : 0, -999999, 999999),
    mechanismId: identifier(source.mechanismId, ""),
    description: text(source.description, 1200)
  };
}

export function createDefaultBoardGameEngine() {
  return {
    version: BOARD_GAME_ENGINE_VERSION,
    maxRounds: 6,
    map: { kind: "area_graph", nodes: [], edges: [] },
    phases: [],
    actions: [],
    setup: { unitsPerSeat: 1, startingNodeIds: [] },
    endCondition: { type: "rounds", variableKey: "", operator: "gte", value: 6 },
    information: "public"
  };
}

export function normalizeBoardGameEngine(value = {}) {
  const source = record(value);
  const map = record(source.map);
  const setup = record(source.setup);
  const endCondition = record(source.endCondition);
  const maxRounds = integer(source.maxRounds, 6, 1, 999);
  return {
    version: BOARD_GAME_ENGINE_VERSION,
    maxRounds,
    map: {
      kind: BOARD_GAME_MAP_KINDS.includes(map.kind) ? map.kind : "area_graph",
      nodes: (Array.isArray(map.nodes) ? map.nodes : []).slice(0, 500).map(normalizeMapNode),
      edges: (Array.isArray(map.edges) ? map.edges : []).slice(0, 2000).map(normalizeMapEdge)
    },
    phases: (Array.isArray(source.phases) ? source.phases : []).slice(0, 100).map(normalizePhase),
    actions: (Array.isArray(source.actions) ? source.actions : []).slice(0, 500).map(normalizeAction),
    setup: {
      unitsPerSeat: integer(setup.unitsPerSeat, 1, 0, 30),
      startingNodeIds: (Array.isArray(setup.startingNodeIds) ? setup.startingNodeIds : []).slice(0, 99).map((item) => identifier(item, "")).filter(Boolean)
    },
    endCondition: {
      type: endCondition.type === "variable_threshold" ? "variable_threshold" : "rounds",
      variableKey: identifier(endCondition.variableKey, ""),
      operator: ["eq", "gt", "gte", "lt", "lte"].includes(endCondition.operator) ? endCondition.operator : "gte",
      value: number(endCondition.value, maxRounds)
    },
    information: ["public", "private", "team"].includes(source.information) ? source.information : "public"
  };
}

export function boardGameCapability(id) {
  return CAPABILITY_BY_ID.get(id) || { id, label: id, status: "unsupported", note: "当前引擎没有登记这项能力。" };
}

export function assessBoardGameEngineCapabilities(value) {
  const engine = normalizeBoardGameEngine(value?.engine || value);
  const requested = new Set([
    `map.${engine.map.kind}`,
    `info.${engine.information}`,
    ...engine.phases.map((phase) => `phase.${phase.mode}`),
    ...engine.actions.map((action) => `action.${action.kind}`)
  ]);
  const checks = [...requested].map(boardGameCapability);
  return {
    checks,
    supported: checks.filter((item) => item.status === "supported").length,
    partial: checks.filter((item) => item.status === "partial").length,
    unsupported: checks.filter((item) => item.status === "unsupported").length,
    runnable: checks.every((item) => item.status === "supported")
  };
}

export function compileBoardGameEngine(designValue, roleCount = 0) {
  const design = record(designValue);
  const engine = normalizeBoardGameEngine(design.engine);
  const issues = [];
  const nodeIds = new Set(engine.map.nodes.map((item) => item.id));
  const phaseIds = new Set(engine.phases.map((item) => item.id));
  const actionIds = new Set(engine.actions.map((item) => item.id));
  const mechanismIds = new Set((Array.isArray(design.mechanisms) ? design.mechanisms : []).map((item) => item.id));
  const variableIds = new Set((Array.isArray(design.variables) ? design.variables : []).map((item) => item.id));

  for (const [collection, items] of [["区域", engine.map.nodes], ["路线", engine.map.edges], ["阶段", engine.phases], ["行动", engine.actions]]) {
    for (const id of duplicateIds(items)) issues.push(issue("error", "ENGINE_ID_DUPLICATE", `${collection} ID「${id}」重复。`, "engine"));
  }
  if (!engine.map.nodes.length) issues.push(issue("error", "ENGINE_MAP_EMPTY", "试玩引擎没有区域数据。", "engine.map.nodes"));
  if (!engine.phases.length) issues.push(issue("error", "ENGINE_PHASES_EMPTY", "试玩引擎没有阶段数据。", "engine.phases"));
  if (!engine.actions.length) issues.push(issue("error", "ENGINE_ACTIONS_EMPTY", "试玩引擎没有行动数据。", "engine.actions"));
  engine.map.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) issues.push(issue("error", "ENGINE_ROUTE_NODE_MISSING", `路线「${edge.id}」引用了不存在的区域。`, `engine.map.edges.${index}`));
    if (edge.from === edge.to) issues.push(issue("error", "ENGINE_ROUTE_SELF", `路线「${edge.id}」不能连接同一区域。`, `engine.map.edges.${index}`));
  });
  engine.setup.startingNodeIds.forEach((nodeId, index) => {
    if (!nodeIds.has(nodeId)) issues.push(issue("error", "ENGINE_START_NODE_MISSING", `起始区域「${nodeId}」不存在。`, `engine.setup.startingNodeIds.${index}`));
  });
  engine.phases.forEach((phase, phaseIndex) => {
    if (!phase.actionIds.length) issues.push(issue("error", "ENGINE_PHASE_ACTIONS_EMPTY", `阶段「${phase.label}」没有可执行行动。`, `engine.phases.${phaseIndex}.actionIds`));
    phase.actionIds.forEach((actionId) => {
      if (!actionIds.has(actionId)) issues.push(issue("error", "ENGINE_PHASE_ACTION_MISSING", `阶段「${phase.label}」引用了不存在的行动「${actionId}」。`, `engine.phases.${phaseIndex}.actionIds`));
    });
  });
  engine.actions.forEach((action, index) => {
    if (!phaseIds.has(action.phaseId)) issues.push(issue("error", "ENGINE_ACTION_PHASE_MISSING", `行动「${action.label}」没有有效阶段。`, `engine.actions.${index}.phaseId`));
    if (action.mechanismId && !mechanismIds.has(action.mechanismId)) issues.push(issue("error", "ENGINE_ACTION_MECHANISM_MISSING", `行动「${action.label}」引用了不存在的条件效果。`, `engine.actions.${index}.mechanismId`));
    if ((action.resourceKey || action.cost > 0 || ["gain", "pay"].includes(action.kind)) && !variableIds.has(action.resourceKey)) {
      issues.push(issue("error", "ENGINE_ACTION_VARIABLE_MISSING", `行动「${action.label}」没有绑定有效资源数值。`, `engine.actions.${index}.resourceKey`));
    }
  });
  if (engine.endCondition.type === "variable_threshold" && !variableIds.has(engine.endCondition.variableKey)) {
    issues.push(issue("error", "ENGINE_END_VARIABLE_MISSING", "试玩结束条件引用了不存在的数值。", "engine.endCondition.variableKey"));
  }
  if (roleCount > 0 && engine.setup.startingNodeIds.length > 0 && engine.setup.startingNodeIds.length < Math.min(roleCount, 2)) {
    issues.push(issue("warning", "ENGINE_STARTS_REUSED", "起始区域少于席位数，多个席位会共用起点。", "engine.setup.startingNodeIds"));
  }
  const capabilities = assessBoardGameEngineCapabilities(engine);
  capabilities.checks.filter((item) => item.status !== "supported").forEach((item) => {
    issues.push(issue("error", `CAPABILITY_${item.status.toUpperCase()}`, `${item.label}：${item.note}`, `capabilities.${item.id}`));
  });
  const tests = [
    { id: "map-references", label: "区域与路线引用完整", passed: !issues.some((item) => ["ENGINE_ROUTE_NODE_MISSING", "ENGINE_ROUTE_SELF", "ENGINE_START_NODE_MISSING"].includes(item.code)) },
    { id: "phase-references", label: "阶段与行动引用完整", passed: !issues.some((item) => ["ENGINE_PHASE_ACTIONS_EMPTY", "ENGINE_PHASE_ACTION_MISSING", "ENGINE_ACTION_PHASE_MISSING"].includes(item.code)) },
    { id: "rule-references", label: "行动与数值规则引用完整", passed: !issues.some((item) => ["ENGINE_ACTION_MECHANISM_MISSING", "ENGINE_ACTION_VARIABLE_MISSING", "ENGINE_END_VARIABLE_MISSING"].includes(item.code)) },
    { id: "runtime-capabilities", label: "所需能力可在当前试玩运行", passed: capabilities.runnable }
  ];
  return { engine, issues, tests, capabilities, blocking: issues.some((item) => item.level === "error") };
}

function variableState(design, seatCount) {
  const values = {};
  const playerValues = Array.from({ length: seatCount }, () => ({}));
  for (const variable of Array.isArray(design.variables) ? design.variables : []) {
    if (variable.scope === "player") playerValues.forEach((state) => { state[variable.id] = variable.initialValue; });
    else values[variable.id] = variable.initialValue;
  }
  return { values, playerValues };
}

export function boardGameEngineSignature(designValue) {
  const design = record(designValue);
  return JSON.stringify({ engine: normalizeBoardGameEngine(design.engine), variables: design.variables || [], mechanisms: design.mechanisms || [] });
}

export function createBoardGameRuntimeState(designValue, seatCountValue = 0) {
  const design = record(designValue);
  const engine = normalizeBoardGameEngine(design.engine);
  const seatCount = integer(seatCountValue || record(design.playerCount).min, 2, 1, 99);
  const variableValues = variableState(design, seatCount);
  const starts = engine.setup.startingNodeIds.length ? engine.setup.startingNodeIds : engine.map.nodes.map((node) => node.id);
  const units = [];
  for (let seatIndex = 0; seatIndex < seatCount; seatIndex += 1) {
    for (let unitIndex = 0; unitIndex < engine.setup.unitsPerSeat; unitIndex += 1) {
      const nodeId = starts.length ? starts[(seatIndex + unitIndex) % starts.length] : "";
      units.push({ id: `unit-${seatIndex + 1}-${unitIndex + 1}`, seatIndex, nodeId });
    }
  }
  const owners = Object.fromEntries(engine.map.nodes.map((node) => [node.id, node.initialOwner >= 0 && node.initialOwner < seatCount ? node.initialOwner : null]));
  return {
    signature: boardGameEngineSignature(design),
    round: 1,
    phaseIndex: 0,
    activeSeatIndex: 0,
    seatCount,
    values: variableValues.values,
    playerValues: variableValues.playerValues,
    scores: Array.from({ length: seatCount }, () => 0),
    units,
    owners,
    submissions: {},
    resolved: false,
    ended: false,
    sequence: 1,
    lastMove: null,
    log: [{ id: "engine-log-1", tone: "system", text: "试玩状态已由引擎数据建立，等待明确操作。" }]
  };
}

function addLog(state, textValue, tone = "system") {
  state.sequence = integer(state.sequence, 0, 0, 1_000_000) + 1;
  state.log.unshift({ id: `engine-log-${state.sequence}`, tone, text: text(textValue, 1200) });
  state.log = state.log.slice(0, 30);
}

function currentPhase(engine, state) {
  return engine.phases[state.phaseIndex] || engine.phases[0] || null;
}

function actionFor(engine, actionId) {
  return engine.actions.find((item) => item.id === actionId) || null;
}

function scopedState(design, state, seatIndex) {
  const combined = { ...state.values, ...(state.playerValues[seatIndex] || {}) };
  return {
    combined,
    write(next) {
      for (const variable of Array.isArray(design.variables) ? design.variables : []) {
        if (!(variable.id in next)) continue;
        if (variable.scope === "player") state.playerValues[seatIndex][variable.id] = next[variable.id];
        else state.values[variable.id] = next[variable.id];
      }
    }
  };
}

function comparable(value) {
  const numeric = Number(value);
  return String(value ?? "").trim() !== "" && Number.isFinite(numeric) ? numeric : String(value ?? "");
}

function evaluateCondition(condition, values) {
  const left = comparable(values[condition.sourceKey]);
  const right = comparable(condition.value);
  if (condition.operator === "eq") return left === right;
  if (condition.operator === "neq") return left !== right;
  if (condition.operator === "gt") return left > right;
  if (condition.operator === "gte") return left >= right;
  if (condition.operator === "lt") return left < right;
  if (condition.operator === "lte") return left <= right;
  if (condition.operator === "contains") return String(left).includes(String(right));
  return false;
}

function boundedVariableValue(variable, value) {
  if (!variable || typeof value !== "number") return value;
  return Math.max(number(variable.min, -1_000_000_000), Math.min(number(variable.max, 1_000_000_000), value));
}

function applyEffect(effect, values, design) {
  const current = values[effect.targetKey];
  const operand = comparable(effect.value);
  let next = current;
  if (effect.operation === "set") next = operand;
  else if (effect.operation === "add") next = number(current) + number(operand);
  else if (effect.operation === "subtract") next = number(current) - number(operand);
  else if (effect.operation === "multiply") next = number(current) * number(operand, 1);
  else if (effect.operation === "min") next = Math.min(number(current), number(operand));
  else if (effect.operation === "max") next = Math.max(number(current), number(operand));
  else if (effect.operation === "toggle") next = !Boolean(current);
  return boundedVariableValue((design.variables || []).find((item) => item.id === effect.targetKey), next);
}

function executeMechanism(design, state, seatIndex, mechanismId) {
  const mechanism = (design.mechanisms || []).find((item) => item.id === mechanismId);
  if (!mechanism) return { ok: true, detail: "未绑定额外条件效果" };
  const scoped = scopedState(design, state, seatIndex);
  const results = (mechanism.conditions || []).map((condition) => evaluateCondition(condition, scoped.combined));
  const passed = results.length === 0 || (mechanism.conditionMode === "any" ? results.some(Boolean) : results.every(Boolean));
  if (!passed) return { ok: false, code: "MECHANISM_CONDITION_BLOCKED", message: `「${mechanism.name}」的执行条件未成立。` };
  const next = { ...scoped.combined };
  for (const effect of mechanism.effects || []) next[effect.targetKey] = applyEffect(effect, next, design);
  scoped.write(next);
  return { ok: true, detail: `已执行「${mechanism.name}」` };
}

function variableValue(design, state, seatIndex, key) {
  const variable = (design.variables || []).find((item) => item.id === key);
  return variable?.scope === "player" ? state.playerValues[seatIndex]?.[key] : state.values[key];
}

function setVariableValue(design, state, seatIndex, key, value) {
  const variable = (design.variables || []).find((item) => item.id === key);
  const next = boundedVariableValue(variable, value);
  if (variable?.scope === "player") state.playerValues[seatIndex][key] = next;
  else state.values[key] = next;
}

function unitForSeat(state, seatIndex) {
  return state.units.find((unit) => unit.seatIndex === seatIndex) || null;
}

export function legalBoardGameTargets(designValue, stateValue, actionId, seatIndexValue = null) {
  const design = record(designValue);
  const engine = normalizeBoardGameEngine(design.engine);
  const state = record(stateValue);
  const action = actionFor(engine, actionId);
  const seatIndex = seatIndexValue === null ? integer(state.activeSeatIndex, 0, 0, 98) : integer(seatIndexValue, 0, 0, 98);
  if (!action) return [];
  if (action.target === "none") return [""];
  if (action.target === "any_region") return engine.map.nodes.map((node) => node.id);
  if (action.target === "own_region") return engine.map.nodes.filter((node) => state.owners?.[node.id] === seatIndex).map((node) => node.id);
  if (action.target === "opponent_region") return engine.map.nodes.filter((node) => Number.isInteger(state.owners?.[node.id]) && state.owners[node.id] !== seatIndex).map((node) => node.id);
  const origin = unitForSeat(state, seatIndex)?.nodeId;
  if (!origin) return [];
  const targets = new Set();
  for (const edge of engine.map.edges) {
    if (edge.blocked) continue;
    if (edge.from === origin) targets.add(edge.to);
    if (edge.bidirectional && edge.to === origin) targets.add(edge.from);
  }
  return [...targets];
}

function validateAction(design, engine, state, action, targetId, seatIndex) {
  const phase = currentPhase(engine, state);
  if (!phase || !phase.actionIds.includes(action.id) || action.phaseId !== phase.id) return { ok: false, code: "ACTION_NOT_IN_PHASE", message: "该行动不属于当前阶段。" };
  if (seatIndex !== state.activeSeatIndex) return { ok: false, code: "SEAT_NOT_ACTIVE", message: "当前不是该席位的提交顺序。" };
  if (state.resolved || state.ended) return { ok: false, code: "PHASE_RESOLVED", message: "当前阶段已经结算。" };
  const legalTargets = legalBoardGameTargets(design, state, action.id, seatIndex);
  if (action.target !== "none" && !legalTargets.includes(targetId)) return { ok: false, code: "TARGET_ILLEGAL", message: "所选区域不是该行动的合法目标。" };
  if (action.cost > 0 && number(variableValue(design, state, seatIndex, action.resourceKey), 0) < action.cost) return { ok: false, code: "RESOURCE_NOT_ENOUGH", message: "资源不足，不能执行该行动。" };
  if (action.kind === "pay" && number(variableValue(design, state, seatIndex, action.resourceKey), 0) < Math.abs(action.amount || 1)) return { ok: false, code: "RESOURCE_NOT_ENOUGH", message: "资源不足，不能支付该数值。" };
  return { ok: true };
}

function applySingleAction(design, engine, state, submission) {
  const action = actionFor(engine, submission.actionId);
  const seatIndex = submission.seatIndex;
  const beforeResource = action.resourceKey ? number(variableValue(design, state, seatIndex, action.resourceKey), 0) : 0;
  if (action.cost > 0) setVariableValue(design, state, seatIndex, action.resourceKey, beforeResource - action.cost);
  const details = [];
  if (action.kind === "move") {
    const unit = unitForSeat(state, seatIndex);
    if (unit) {
      const from = unit.nodeId;
      unit.nodeId = submission.targetId;
      state.lastMove = { unitId: unit.id, from, to: submission.targetId };
      details.push(`单位 ${from} → ${submission.targetId}`);
    }
  } else if (action.kind === "control") {
    state.owners[submission.targetId] = seatIndex;
    details.push(`控制 ${submission.targetId}`);
  } else if (action.kind === "gain") {
    const current = number(variableValue(design, state, seatIndex, action.resourceKey), 0);
    setVariableValue(design, state, seatIndex, action.resourceKey, current + action.amount);
    details.push(`${action.resourceKey} +${action.amount}`);
  } else if (action.kind === "pay") {
    const current = number(variableValue(design, state, seatIndex, action.resourceKey), 0);
    setVariableValue(design, state, seatIndex, action.resourceKey, current - Math.abs(action.amount || 1));
    details.push(`${action.resourceKey} -${Math.abs(action.amount || 1)}`);
  } else if (action.kind === "score") {
    state.scores[seatIndex] += action.amount;
    if (action.resourceKey) {
      const current = number(variableValue(design, state, seatIndex, action.resourceKey), 0);
      setVariableValue(design, state, seatIndex, action.resourceKey, current + action.amount);
    }
    details.push(`分数 ${action.amount >= 0 ? "+" : ""}${action.amount}`);
  } else if (["bid", "draw", "play", "reveal"].includes(action.kind)) {
    return { ok: false, code: "CAPABILITY_PARTIAL", message: `「${action.label}」仅保存了结构，当前试玩尚不能正确执行。` };
  }
  if (action.mechanismId || action.kind === "mechanism") {
    const mechanism = executeMechanism(design, state, seatIndex, action.mechanismId);
    if (!mechanism.ok) return mechanism;
    details.push(mechanism.detail);
  }
  return { ok: true, detail: details.filter(Boolean).join("；") || "状态未发生数值变化" };
}

export function executeBoardGameAction(designValue, stateValue, input = {}) {
  const design = record(designValue);
  const engine = normalizeBoardGameEngine(design.engine);
  const state = clone(stateValue);
  const seatIndex = integer(input.seatIndex ?? state.activeSeatIndex, 0, 0, Math.max(0, state.seatCount - 1));
  const action = actionFor(engine, input.actionId);
  if (!action) return { ok: false, code: "ACTION_MISSING", message: "行动不存在。", state: stateValue };
  const validation = validateAction(design, engine, state, action, text(input.targetId, 80), seatIndex);
  if (!validation.ok) return { ...validation, state: stateValue };
  const phase = currentPhase(engine, state);
  const submission = { seatIndex, actionId: action.id, targetId: text(input.targetId, 80) };
  if (phase.mode === "sequential") {
    const result = applySingleAction(design, engine, state, submission);
    if (!result.ok) return { ...result, state: stateValue };
    state.resolved = true;
    addLog(state, `席位 ${seatIndex + 1} 执行「${action.label}」：${result.detail}。`, "resolution");
    return { ok: true, state, message: result.detail, phaseResolved: true };
  }
  state.submissions[String(seatIndex)] = submission;
  const remaining = Array.from({ length: state.seatCount }, (_, index) => index).filter((index) => !state.submissions[String(index)]);
  if (remaining.length) {
    state.activeSeatIndex = remaining[0];
    addLog(state, phase.mode === "reveal"
      ? `席位 ${seatIndex + 1} 已提交一个盖放选择，等待其余席位提交。`
      : `席位 ${seatIndex + 1} 已提交「${action.label}」，等待其余席位提交。`, "action");
    return { ok: true, state, message: "选择已提交，尚未结算。", phaseResolved: false };
  }
  const resolutions = [];
  for (const pending of Object.values(state.submissions).sort((a, b) => a.seatIndex - b.seatIndex)) {
    const result = applySingleAction(design, engine, state, pending);
    if (!result.ok) return { ...result, state: stateValue };
    resolutions.push(`席位 ${pending.seatIndex + 1}：${result.detail}`);
  }
  state.resolved = true;
  state.activeSeatIndex = 0;
  addLog(state, `${phase.mode === "reveal" ? "选择已统一公开" : "同时选择已统一结算"}：${resolutions.join("；")}。`, "resolution");
  return { ok: true, state, message: resolutions.join("；"), phaseResolved: true };
}

function compare(left, operator, right) {
  if (operator === "eq") return left === right;
  if (operator === "gt") return left > right;
  if (operator === "gte") return left >= right;
  if (operator === "lt") return left < right;
  if (operator === "lte") return left <= right;
  return false;
}

function checkEnded(design, engine, state) {
  if (engine.endCondition.type === "rounds") return state.round > engine.maxRounds;
  return compare(number(state.values[engine.endCondition.variableKey], 0), engine.endCondition.operator, engine.endCondition.value);
}

export function advanceBoardGameRuntime(designValue, stateValue) {
  const design = record(designValue);
  const engine = normalizeBoardGameEngine(design.engine);
  if (!stateValue?.resolved || stateValue?.ended) return { ok: false, code: "PHASE_NOT_RESOLVED", message: "当前行动尚未结算。", state: stateValue };
  const state = clone(stateValue);
  const phase = currentPhase(engine, state);
  if (phase?.mode === "sequential" && state.activeSeatIndex < state.seatCount - 1) {
    state.activeSeatIndex += 1;
  } else {
    state.activeSeatIndex = 0;
    if (state.phaseIndex < engine.phases.length - 1) state.phaseIndex += 1;
    else {
      state.phaseIndex = 0;
      state.round += 1;
    }
  }
  state.submissions = {};
  state.resolved = false;
  state.lastMove = null;
  state.ended = checkEnded(design, engine, state);
  addLog(state, state.ended ? "已达到引擎声明的结束条件。" : `进入第 ${state.round} 轮「${currentPhase(engine, state)?.label || "阶段"}」，当前为席位 ${state.activeSeatIndex + 1}。`, "system");
  return { ok: true, state, ended: state.ended };
}

export function normalizeBoardGameRuntimeState(stateValue, designValue, seatCount = 0) {
  const signature = boardGameEngineSignature(designValue);
  if (!stateValue || stateValue.signature !== signature || stateValue.seatCount !== integer(seatCount || record(designValue).playerCount?.min, 2, 1, 99)) {
    return createBoardGameRuntimeState(designValue, seatCount);
  }
  return stateValue;
}
