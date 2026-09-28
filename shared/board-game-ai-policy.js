import { advanceBoardGameRuntime, executeBoardGameAction, legalBoardGameTargets } from "./board-game-engine.js";

const clone = (value) => structuredClone(value);

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const integer = (value, fallback = 0, min = -Infinity, max = Infinity) => Math.max(min, Math.min(max, Math.trunc(number(value, fallback))));

const PROFILES = Object.freeze([
  { id: "balanced", label: "均衡规划者", weights: { immediate: 1, future: 1, pressure: 1, risk: 1 } },
  { id: "builder", label: "长期建设者", weights: { immediate: 0.82, future: 1.35, pressure: 0.86, risk: 0.92 } },
  { id: "blocker", label: "机会阻断者", weights: { immediate: 1.04, future: 0.94, pressure: 1.34, risk: 0.9 } },
  { id: "risk-manager", label: "风险管理者", weights: { immediate: 0.98, future: 0.9, pressure: 0.94, risk: 1.42 } },
  { id: "opportunist", label: "末段机会主义者", weights: { immediate: 1.24, future: 0.78, pressure: 1.12, risk: 1.06 } }
]);

function engineOf(design) {
  return design?.engine || {};
}

function profileOf(profile, seatIndex = 0) {
  if (typeof profile === "string") return PROFILES.find((item) => item.id === profile) || PROFILES[seatIndex % PROFILES.length];
  return PROFILES[seatIndex % PROFILES.length];
}

function variableValue(design, state, seatIndex, key) {
  const variable = (design.variables || []).find((item) => item.id === key);
  return variable?.scope === "player" ? number(state.playerValues?.[seatIndex]?.[key]) : number(state.values?.[key]);
}

function actionLabel(action) {
  return `${action?.id || ""} ${action?.label || ""} ${action?.description || ""}`.toLowerCase();
}

function currentPhase(design, state) {
  return engineOf(design).phases?.[state.phaseIndex] || engineOf(design).phases?.[0] || null;
}

function activeActions(design, state) {
  const phase = currentPhase(design, state);
  return (phase?.actionIds || []).map((id) => engineOf(design).actions?.find((action) => action.id === id)).filter(Boolean);
}

function routeValue(design, state, route, seatIndex) {
  if (!route) return -Infinity;
  const owners = state.routeOwners || {};
  const nodes = engineOf(design).map?.nodes || [];
  const nodeScore = (id) => number(nodes.find((node) => node.id === id)?.scoreValue);
  const sharedEndpoint = nodes.filter((node) => {
    const connected = (engineOf(design).map?.edges || []).filter((edge) => edge.from === node.id || edge.to === node.id).length;
    return connected >= 3;
  }).some((node) => node.id === route.from || node.id === route.to);
  const contested = (engineOf(design).map?.edges || []).filter((edge) => edge.from === route.from || edge.to === route.from || edge.from === route.to || edge.to === route.to).some((edge) => Number.isInteger(owners[edge.id]) && owners[edge.id] !== seatIndex);
  return number(route.cost, 1) * 8 + nodeScore(route.from) + nodeScore(route.to) + (sharedEndpoint ? 6 : 0) + (contested ? 5 : 0);
}

function cardValue(design, state, seatIndex, card, profile) {
  if (!card) return -Infinity;
  const remainingRounds = Math.max(1, number(engineOf(design).maxRounds, 1) - number(state.round) + 1);
  const weights = profile.weights;
  let value = 1;
  const factors = [];
  for (const effect of card.effects || []) {
    const amount = Math.max(-20, Math.min(20, number(effect.value)));
    const key = String(effect.targetKey || "").toLowerCase();
    let weight = 2;
    if (key === "score" || /声望|分数|score/.test(key)) weight = 8 * weights.immediate;
    else if (/energy|science|trade|military|material|influence|coins|rail|supply|wood|iron|hand/.test(key)) weight = 2.6 * weights.future;
    if (profile.id === "blocker" && /military|influence|route|control|阻断|防卫/.test(`${key} ${card.tags || ""} ${card.name || ""}`)) weight *= 1.25;
    if (profile.id === "risk-manager" && /supply|stability|shield|保护/.test(`${key} ${card.tags || ""} ${card.name || ""}`)) weight *= 1.25;
    value += amount * weight;
    if (amount > 0 && (key === "score" || key === "coins" || key === "energy")) factors.push(`卡牌提供${key}即时/未来收益`);
  }
  if (number(card.age) > 0) value += Math.min(8, number(card.age) * remainingRounds * 0.12);
  if (card.tags?.length) value += Math.min(3, card.tags.length * 0.5);
  const handSize = state.hands?.[seatIndex]?.length || 0;
  if (handSize <= 2) value += 2;
  return { value, factors: factors.slice(0, 3) };
}

function globalSituation(design, state, seatIndex) {
  const scores = Array.from({ length: state.seatCount || 0 }, (_, index) => variableValue(design, state, index, "score"));
  const ownScore = scores[seatIndex] || 0;
  const leaderScore = Math.max(ownScore, ...scores, 0);
  const remainingRounds = Math.max(0, number(engineOf(design).maxRounds, 1) - number(state.round) + 1);
  const opponents = scores.filter((_, index) => index !== seatIndex);
  const opponentLead = Math.max(0, leaderScore - ownScore);
  const publicRoutes = Object.keys(state.routeOwners || {}).length;
  const availableRoutes = (engineOf(design).map?.edges || []).filter((edge) => !Number.isInteger(state.routeOwners?.[edge.id])).length;
  const ownRisk = number(state.riskProgress?.[seatIndex]);
  return {
    ownScore,
    leaderScore,
    opponentLead,
    remainingRounds,
    scores,
    opponentMean: opponents.length ? opponents.reduce((sum, value) => sum + value, 0) / opponents.length : 0,
    publicRoutes,
    availableRoutes,
    ownRisk,
    endgame: remainingRounds <= Math.max(1, Math.ceil(number(engineOf(design).maxRounds, 1) * 0.25)),
    resourcePressure: ["supply", "material", "energy", "coins", "rail", "wood", "iron", "influence"].filter((key) => (design.variables || []).some((variable) => variable.id === key) && variableValue(design, state, seatIndex, key) <= 1)
  };
}

function targetValue(design, state, action, targetId, seatIndex, profile) {
  if (!targetId || action.target === "none") return 0;
  if (action.kind === "claim_route") return routeValue(design, state, engineOf(design).map?.edges?.find((edge) => edge.id === targetId), seatIndex);
  const node = engineOf(design).map?.nodes?.find((item) => item.id === targetId);
  if (!node) return 0;
  const owner = state.owners?.[targetId];
  const occupied = state.units?.some((unit) => unit.nodeId === targetId && unit.seatIndex !== seatIndex);
  let value = number(node.scoreValue) * 5;
  if (action.kind === "control") value += owner === null || owner === undefined ? 9 : owner === seatIndex ? -3 : 12;
  if (action.kind === "place") value += occupied ? -12 : 8;
  if (action.kind === "move") value += occupied ? (profile.id === "blocker" ? 4 : -2) : 0;
  return value;
}

function affordability(design, state, action, seatIndex, cardId) {
  if (action.cost > 0 && variableValue(design, state, seatIndex, action.resourceKey) < action.cost) return false;
  if (["draw", "play"].includes(action.kind) && variableValue(design, state, seatIndex, action.resourceKey) < Math.abs(action.amount || 1)) return false;
  if (action.kind === "contribute" && variableValue(design, state, seatIndex, action.resourceKey) < Math.max(1, Math.abs(action.amount || 1))) return false;
  if (action.kind === "play" && !(state.hands?.[seatIndex] || []).some((card) => card.id === cardId)) return false;
  if (action.kind === "draft" && action.draftMode === "hand" && !(state.hands?.[seatIndex] || []).some((card) => card.id === cardId)) return false;
  if (action.kind === "draft" && action.draftMode !== "hand" && !(state.market || []).some((card) => card.id === cardId)) return false;
  return true;
}

function mechanismFeasible(design, state, action, seatIndex) {
  if (!action?.mechanismId) return true;
  const mechanism = (design.mechanisms || []).find((item) => item.id === action.mechanismId);
  if (!mechanism || !mechanism.conditions?.length) return true;
  const values = { ...(state.values || {}), ...(state.playerValues?.[seatIndex] || {}) };
  const checks = mechanism.conditions.map((condition) => {
    const left = number(values[condition.sourceKey]);
    const right = number(condition.value);
    if (condition.operator === "eq") return left === right;
    if (condition.operator === "neq") return left !== right;
    if (condition.operator === "gt") return left > right;
    if (condition.operator === "gte") return left >= right;
    if (condition.operator === "lt") return left < right;
    if (condition.operator === "lte") return left <= right;
    return false;
  });
  return mechanism.conditionMode === "any" ? checks.some(Boolean) : checks.every(Boolean);
}

function actionBaseValue(design, state, action, seatIndex, situation, profile) {
  const label = actionLabel(action);
  const resource = variableValue(design, state, seatIndex, action.resourceKey);
  const amount = number(action.amount, 1);
  const weights = profile.weights;
  const profileBias = (kind, value = 0) => profile.id === "builder" && ["gain", "draw", "play"].includes(kind) ? value + 18 : profile.id === "blocker" && ["control", "claim_route", "move"].includes(kind) ? value + 18 : profile.id === "risk-manager" && ["stop", "pass"].includes(kind) ? value + 18 : profile.id === "risk-manager" && kind === "roll" ? value - 12 : profile.id === "opportunist" && ["score", "mechanism", "play", "roll"].includes(kind) ? value + 18 : profile.id === "opportunist" && kind === "pass" ? value - 10 : value;
  if (action.kind === "score") return profileBias(action.kind, (70 + amount * 10) * weights.immediate);
  if (action.kind === "gain") return profileBias(action.kind, (35 + amount * 5 + (situation.resourcePressure.length ? 12 : 0)) * weights.future);
  if (action.kind === "pay") return resource >= Math.abs(amount) ? 22 : -100;
  if (action.kind === "draw") return profileBias(action.kind, (resource < 2 ? 74 : 22) * weights.future);
  if (action.kind === "play") return profileBias(action.kind, resource > 0 ? 62 * weights.immediate : -100);
  if (action.kind === "draft") return 56 * weights.future + (situation.endgame ? 18 : 0);
  if (action.kind === "mechanism") {
    if (/trade|贸易/.test(label)) return profileBias(action.kind, (variableValue(design, state, seatIndex, "material") >= 1 ? 76 : -100) * weights.future);
    if (/research|研究/.test(label)) return profileBias(action.kind, (variableValue(design, state, seatIndex, "energy") <= 1 ? 72 : 36) * weights.future);
    if (/build|修复|beacon|灯塔/.test(label)) return profileBias(action.kind, (situation.endgame ? 104 : 92) * weights.immediate);
    return profileBias(action.kind, 34 * weights.future);
  }
  if (action.kind === "claim_route") return profileBias(action.kind, (48 + (situation.endgame ? 15 : 0)) * weights.pressure);
  if (action.kind === "control") return profileBias(action.kind, (40 + (situation.opponentLead > 0 ? 8 : 0)) * weights.pressure);
  if (action.kind === "place") return profileBias(action.kind, 42 * weights.future);
  if (action.kind === "move") return profileBias(action.kind, 28 * weights.pressure);
  if (action.kind === "roll") {
    const danger = situation.ownRisk / Math.max(1, number(action.bustThreshold, 18));
    return profileBias(action.kind, (72 - danger * 70) * weights.risk + (situation.endgame ? 16 : 0));
  }
  if (action.kind === "stop") {
    const danger = situation.ownRisk / Math.max(1, number(action.bustThreshold, 18));
    return profileBias(action.kind, (situation.ownRisk > 0 ? 45 + danger * 55 : 4) * weights.risk);
  }
  if (action.kind === "bid") return (34 + (situation.opponentLead > 0 ? 12 : 0)) * weights.pressure;
  if (action.kind === "vote") return (30 + (situation.endgame ? 12 : 0)) * weights.pressure;
  if (action.kind === "pass") return profileBias(action.kind, situation.resourcePressure.length ? 18 : -8);
  if (/build|修复|研究|research|order|交付|trade|贸易|secure|稳固|salvage|打捞/.test(label)) return (44 + (situation.opponentLead > 0 ? 7 : 0)) * weights.future;
  return 18;
}

function cardOptions(state, action, seatIndex) {
  if (action.kind === "draft") return action.draftMode === "hand" ? (state.hands?.[seatIndex] || []) : (state.market || []);
  if (action.kind === "play") return state.hands?.[seatIndex] || [];
  return [null];
}

function compareTie(left, right, seatIndex, round) {
  const leftKey = `${left.actionId}|${left.targetId}|${left.cardId}|${seatIndex}|${round}`;
  const rightKey = `${right.actionId}|${right.targetId}|${right.cardId}|${seatIndex}|${round}`;
  return leftKey.localeCompare(rightKey);
}

function searchStateValue(design, state, seatIndex) {
  const scores = Array.from({ length: state.seatCount || 0 }, (_, index) => Math.max(number(state.scores?.[index]), variableValue(design, state, index, "score")));
  const ownScore = scores[seatIndex] || 0;
  const opponentBest = Math.max(0, ...scores.filter((_, index) => index !== seatIndex));
  const ownResources = ["supply", "material", "energy", "coins", "rail", "wood", "iron", "influence"].reduce((sum, key) => sum + variableValue(design, state, seatIndex, key), 0);
  const publicValues = Object.entries(state.values || {}).reduce((sum, [key, value]) => /stability|beacon|control|progress|research|cure/i.test(key) ? sum + number(value) : sum, 0);
  const risk = number(state.riskProgress?.[seatIndex]);
  return ownScore * 10 + (ownScore - opponentBest) * 2 + ownResources * 0.35 + publicValues * 0.4 - risk * 0.55;
}

function rolloutBoardGameFuture(design, initialState, rootSeatIndex, depth, options = {}) {
  let state = clone(initialState);
  const before = searchStateValue(design, state, rootSeatIndex);
  let nodes = 0;
  const trace = [];
  for (let step = 0; step < depth && !state.ended; step += 1) {
    const actor = integer(state.activeSeatIndex, rootSeatIndex, 0, Math.max(0, (state.seatCount || 1) - 1));
    const phase = currentPhase(design, state);
    if (phase?.mode !== "sequential") break;
    const decision = chooseBoardGameAiDecision(design, state, actor, {
      profile: options.opponentProfiles?.[actor] || profileOf(undefined, actor).id,
      searchDepth: 0,
      maxSearchCandidates: 0
    });
    if (!decision.ok) break;
    const result = executeBoardGameAction(design, state, {
      seatIndex: actor,
      actionId: decision.actionId,
      targetId: decision.targetId,
      cardId: decision.cardId,
      bidAmount: decision.bidAmount
    });
    nodes += 1;
    if (!result.ok) break;
    trace.push({ seatIndex: actor, actionId: decision.actionId, targetId: decision.targetId });
    state = result.state;
    if (!result.phaseResolved) break;
    const advanced = advanceBoardGameRuntime(design, state);
    if (!advanced.ok) break;
    state = advanced.state;
  }
  return { value: searchStateValue(design, state, rootSeatIndex) - before, nodes, trace };
}

function applySearchToCandidates(design, privateState, candidates, seatIndex, options = {}) {
  const depth = Math.max(0, Math.min(5, integer(options.searchDepth, 0, 0, 5)));
  if (!depth || currentPhase(design, privateState)?.mode !== "sequential") return { nodes: 0 };
  const baseline = searchStateValue(design, privateState, seatIndex);
  const limit = Math.max(1, Math.min(candidates.length, integer(options.maxSearchCandidates, 12, 1, 32)));
  let nodes = 0;
  for (const candidate of candidates.slice(0, limit)) {
    const result = executeBoardGameAction(design, privateState, {
      seatIndex,
      actionId: candidate.actionId,
      targetId: candidate.targetId,
      cardId: candidate.cardId,
      bidAmount: candidate.bidAmount || 0
    });
    if (!result.ok || !result.phaseResolved) {
      candidate.searchValue = null;
      continue;
    }
    const advanced = advanceBoardGameRuntime(design, result.state);
    if (!advanced.ok) {
      candidate.searchValue = null;
      continue;
    }
    const rollout = rolloutBoardGameFuture(design, advanced.state, seatIndex, depth - 1, options);
    nodes += rollout.nodes + 1;
    const futureDelta = searchStateValue(design, advanced.state, seatIndex) - baseline + rollout.value;
    candidate.searchValue = Number(futureDelta.toFixed(3));
    candidate.searchDepth = depth;
    candidate.searchTrace = rollout.trace.slice(0, 4);
    candidate.score += futureDelta * number(options.searchWeight, 0.45);
    candidate.globalFactors = [...new Set([...(candidate.globalFactors || []), `多回合搜索 ${depth} 层`])];
  }
  return { nodes };
}

export function projectBoardGameAiState(stateValue, seatIndex) {
  const state = clone(stateValue || {});
  state.hands = (state.hands || []).map((hand, index) => index === seatIndex ? clone(hand) : []);
  state.aiView = { seatIndex, hiddenHands: Math.max(0, (state.seatCount || 0) - 1) };
  return state;
}

export function chooseBoardGameAiDecision(design, stateValue, seatIndex = 0, options = {}) {
  const privateState = clone(stateValue || {});
  const state = projectBoardGameAiState(stateValue, seatIndex);
  const profile = profileOf(options.profile, seatIndex);
  const excludedCardIds = new Set(options.excludeCardIds || []);
  const situation = globalSituation(design, state, seatIndex);
  const actions = activeActions(design, state);
  const candidates = [];
  for (const action of actions) {
    const targets = action.target === "none" ? [""] : legalBoardGameTargets(design, state, action.id, seatIndex);
    const cards = cardOptions(state, action, seatIndex);
    for (const targetId of targets) {
      for (const card of cards) {
        const cardId = card?.id || "";
        if (cardId && excludedCardIds.has(cardId)) continue;
        if (!affordability(design, state, action, seatIndex, cardId)) continue;
        if (!mechanismFeasible(design, state, action, seatIndex)) continue;
        const base = actionBaseValue(design, state, action, seatIndex, situation, profile);
        const target = targetValue(design, state, action, targetId, seatIndex, profile);
        const cardResult = card ? cardValue(design, state, seatIndex, card, profile) : { value: 0, factors: [] };
        const endgameBonus = situation.endgame && ["score", "claim_route", "control", "draft", "play"].includes(action.kind) ? 9 : 0;
        const comebackBonus = situation.opponentLead >= 4 && ["score", "claim_route", "control", "play"].includes(action.kind) ? 8 * profile.weights.pressure : 0;
        const resourceBonus = situation.resourcePressure.length && ["gain", "draw", "draft"].includes(action.kind) ? 7 : 0;
        const score = base + target + cardResult.value + endgameBonus + comebackBonus + resourceBonus;
        const globalFactors = [];
        if (situation.opponentLead > 0) globalFactors.push(`落后${situation.opponentLead}分，优先追赶`);
        if (situation.endgame) globalFactors.push(`剩余${situation.remainingRounds}轮，进入终局压缩`);
        if (situation.resourcePressure.length) globalFactors.push(`低资源：${situation.resourcePressure.join("、")}`);
        if (situation.availableRoutes <= 3 && action.kind === "claim_route") globalFactors.push("公共路线即将枯竭");
        if (situation.ownRisk > 0 && ["roll", "stop"].includes(action.kind)) globalFactors.push(`当前风险${situation.ownRisk}，比较继续与兑现`);
        candidates.push({ actionId: action.id, targetId, cardId, bidAmount: 0, score, localScore: base + target + cardResult.value, globalScore: endgameBonus + comebackBonus + resourceBonus, globalFactors: [...new Set([...globalFactors, ...cardResult.factors])], optionCount: 0 });
      }
    }
  }
  candidates.forEach((candidate) => { candidate.optionCount = candidates.length; });
  candidates.sort((left, right) => right.score - left.score || compareTie(left, right, seatIndex, state.round));
  const search = applySearchToCandidates(design, privateState, candidates, seatIndex, options);
  candidates.sort((left, right) => right.score - left.score || compareTie(left, right, seatIndex, state.round));
  const selected = candidates[0] || null;
  if (!selected) return { ok: false, reason: "没有可执行的合法候选", profile: profile.id, situation, candidateCount: 0 };
  const action = engineOf(design).actions?.find((item) => item.id === selected.actionId);
  if (action?.kind === "bid") {
    const budget = variableValue(design, state, seatIndex, action.resourceKey);
    selected.bidAmount = Math.min(budget, Math.max(0, Math.round(budget * (profile.id === "opportunist" ? 0.62 : profile.id === "risk-manager" ? 0.36 : 0.5))));
  }
  selected.profile = profile.id;
  selected.profileLabel = profile.label;
  selected.reason = selected.globalFactors.length ? selected.globalFactors.slice(0, 3).join("；") : "按当前行动价值和可执行性选择";
  selected.situation = situation;
  selected.candidateCount = candidates.length;
  selected.searchNodes = search.nodes;
  return { ok: true, ...selected };
}

export function boardGameAiProfiles() {
  return PROFILES.map((profile) => clone(profile));
}
