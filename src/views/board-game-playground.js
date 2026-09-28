import "./board-game-playground.css";
import { escapeHtml } from "../utils/format.js";
import {
  boardGameCapability,
  compileBoardGameEngine,
  createBoardGameRuntimeState,
  legalBoardGameTargets,
  normalizeBoardGameRuntimeState
} from "../../shared/board-game-engine.js";
import {
  applyBoardGameOnlineCommand,
  createBoardGameOnlineCommand
} from "../../shared/board-game-online-runtime.js";
import { chooseBoardGameAiDecision } from "../../shared/board-game-ai-policy.js";
import {
  dominionPrivateState,
  dominionPublicState,
  legalDominionCommands,
  runDominionReferenceTurn
} from "../../shared/dominion-study-replica.js";

const ACTION_LABELS = Object.freeze({
  move: "移动", gain: "获得", pay: "支付", control: "控制", score: "计分",
  mechanism: "规则", bid: "竞价", vote: "表决", draw: "抽牌", play: "出牌", draft: "轮抽",
  claim_route: "占领路线", roll: "继续掷骰", stop: "安全停手", reveal: "公开", pass: "跳过", discard: "弃置", trash: "移除", place_tile: "放置地块", trade: "交易", trade_offer: "发起交易", trade_confirm: "确认交易", trade_cancel: "撤回交易", market_buy: "购买市场卡", combat: "战斗"
});

const DOMINION_ACTION_IDS = new Set([
  "cellar", "chapel", "moat", "harbinger", "merchant", "village", "workshop", "bureaucrat", "militia", "moneylender",
  "poacher", "remodel", "smithy", "throne-room", "bandit", "council-room", "festival", "laboratory", "library", "market",
  "mine", "sentry", "vassal", "witch", "artisan"
]);

function icon(type) {
  const icons = {
    move: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5M10 5 5 12l5 7"></path></svg>',
    gain: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"></path></svg>',
    pay: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M8 12h8"></path></svg>',
    control: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"></path></svg>',
    score: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"></path></svg>',
    mechanism: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4"></path></svg>',
    pass: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M6 12h12M6 17h12"></path></svg>',
    reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8V4m0 0h4M5 4l3 3a7 7 0 1 1-1.4 8.1"></path></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 7 7-7 7m8-14v14"></path></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"></path></svg>'
  };
  return icons[type] || icons.mechanism;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function phaseFor(design, state) {
  return design.engine.phases[state.phaseIndex] || design.engine.phases[0] || null;
}

function activeActions(design, state) {
  if (state?.pendingResponseWindow) {
    return (state.pendingResponseWindow.actionIds || [])
      .map((id) => design.engine.actions.find((action) => action.id === id))
      .filter(Boolean);
  }
  const phase = phaseFor(design, state);
  return phase ? phase.actionIds.map((id) => design.engine.actions.find((action) => action.id === id)).filter(Boolean) : [];
}

function pushUiLog(state, value, tone = "action") {
  state.sequence = number(state.sequence) + 1;
  state.log.unshift({ id: `ui-log-${state.sequence}`, tone, text: value });
  state.log = state.log.slice(0, 30);
}

export function createBoardGamePlaygroundState(design, seatCount = 0) {
  return {
    ...createBoardGameRuntimeState(design, seatCount),
    selectedActionId: "",
    selectedTargetId: "",
    selectedCardId: "",
    selectedBidAmount: 0,
    uiStage: "command",
    lastError: ""
  };
}

export function normalizeBoardGamePlaygroundState(stateValue, design, seatCount = 0) {
  const state = normalizeBoardGameRuntimeState(stateValue, design, seatCount);
  state.selectedActionId ||= "";
  state.selectedTargetId ||= "";
  state.selectedCardId ||= "";
  state.selectedBidAmount = Math.max(0, number(state.selectedBidAmount));
  state.uiStage ||= state.resolved ? "resolved" : "command";
  state.lastError ||= "";
  return state;
}

export function chooseBoardGamePlaygroundCommand(state, design, actionId) {
  const action = activeActions(design, state).find((item) => item.id === actionId);
  if (!action || state.resolved || state.ended) return false;
  state.selectedActionId = action.id;
  state.selectedTargetId = "";
  state.selectedCardId = "";
  if (action.kind !== "bid") state.selectedBidAmount = 0;
  state.lastError = "";
  state.uiStage = action.target === "none" ? "confirm" : "target";
  pushUiLog(state, state.pendingResponseWindow
    ? `席位 ${state.activeSeatIndex + 1} 正在提交反应「${action.label}」。`
    : phaseFor(design, state)?.mode === "reveal"
    ? `席位 ${state.activeSeatIndex + 1} 正在编辑一个盖放选择，尚未提交。`
    : `席位 ${state.activeSeatIndex + 1} 选择了行动「${action.label}」，尚未执行。`);
  return true;
}

export function chooseBoardGamePlaygroundCard(state, design, cardId) {
  if (!state?.selectedActionId || !cardId || state.resolved || state.ended) return false;
  const selectedAction = design?.engine?.actions?.find((action) => action.id === state.selectedActionId);
  const cards = selectedAction?.kind === "draft"
    ? selectedAction.draftMode === "hand"
      ? (Array.isArray(state.hands?.[state.activeSeatIndex]) ? state.hands[state.activeSeatIndex] : [])
      : (Array.isArray(state.market) ? state.market : [])
    : (Array.isArray(state.hands?.[state.activeSeatIndex]) ? state.hands[state.activeSeatIndex] : []);
  if (!cards.some((card) => card.id === cardId)) return false;
  state.selectedCardId = cardId;
  state.lastError = "";
  state.uiStage = "confirm";
  pushUiLog(state, selectedAction?.kind === "draft"
    ? selectedAction.draftMode === "hand" ? "已选择手牌，等待全桌统一公开并传递剩余手牌。" : "已选择公共市场模块，等待统一公开。"
    : "已选择一张手牌，等待确认出牌。");
  return true;
}

export function chooseBoardGamePlaygroundTarget(state, design, targetId) {
  const legal = legalBoardGameTargets(design, state, state.selectedActionId, state.activeSeatIndex);
  if (!state.selectedActionId || !legal.includes(targetId)) return false;
  state.selectedTargetId = targetId;
  state.lastError = "";
  state.uiStage = "confirm";
  const target = design.engine.map.nodes.find((node) => node.id === targetId);
  const route = design.engine.map.edges.find((edge) => edge.id === targetId);
  pushUiLog(state, phaseFor(design, state)?.mode === "reveal"
    ? "盖放选择的目标已设置，等待确认提交。"
    : `目标已设为「${target?.label || route?.label || targetId}」，等待确认。`);
  return true;
}

export function setBoardGamePlaygroundBid(state, value) {
  if (!state) return false;
  state.selectedBidAmount = Math.max(0, Math.floor(number(value)));
  return true;
}

export function confirmBoardGamePlaygroundAction(state, design) {
  if (!state.selectedActionId) return false;
  const result = executeOnlineBoardGameAction(design, state, {
    actionId: state.selectedActionId,
    targetId: state.selectedTargetId,
    seatIndex: state.activeSeatIndex,
    bidAmount: state.selectedBidAmount,
    cardId: state.selectedCardId
  });
  if (!result.ok) {
    state.lastError = result.message || "行动不能执行。";
    return false;
  }
  Object.assign(state, result.state, {
    selectedActionId: "",
    selectedTargetId: "",
    selectedCardId: "",
    selectedBidAmount: 0,
    uiStage: result.phaseResolved ? "resolved" : "command",
    lastError: ""
  });
  return true;
}

function executeOnlineBoardGameAction(design, state, input) {
  const nextSequence = number(state.online?.lastClientSequence, 0) + 1;
  const command = createBoardGameOnlineCommand(design, {
    ...input,
    clientSequence: nextSequence,
    issuedAt: Date.now()
  });
  return applyBoardGameOnlineCommand(design, state, command, {
    serverNow: Date.now(),
    deadline: state.online?.deadline || null
  });
}

export function advanceBoardGamePlaygroundRound(state, design) {
  const result = executeOnlineBoardGameAction(design, state, {
    commandType: "advance",
    seatIndex: state.activeSeatIndex
  });
  if (!result.ok) {
    state.lastError = result.message || "当前不能推进。";
    return false;
  }
  Object.assign(state, result.state, {
    selectedActionId: "",
    selectedTargetId: "",
    uiStage: result.ended ? "ended" : "command",
    lastError: ""
  });
  return true;
}

export function resetBoardGamePlayground(design, seatCount = 0) {
  return createBoardGamePlaygroundState(design, seatCount);
}

function aiValue(design, state, seatIndex, key) {
  const variable = design.variables.find((item) => item.id === key);
  return number(variable ? resourceValue(state, seatIndex, variable) : 0);
}

function aiSituation(design, state, seatIndex) {
  const opponents = Array.from({ length: state.seatCount }, (_, index) => index).filter((index) => index !== seatIndex);
  const ownScore = aiValue(design, state, seatIndex, "score");
  const opponentScores = opponents.map((index) => aiValue(design, state, index, "score"));
  const opponentReadyToBuild = opponents.filter((index) => (
    aiValue(design, state, index, "material") >= 2 && aiValue(design, state, index, "energy") >= 1
  )).length;
  const leaderScore = Math.max(ownScore, ...opponentScores, 0);
  const opponentUnits = state.units.filter((unit) => unit.seatIndex !== seatIndex);
  return {
    ownScore,
    leaderScore,
    isBehind: leaderScore - ownScore >= 4,
    opponentReadyToBuild,
    opponentUnits,
    lowStability: number(state.values.stability) <= 3,
    beaconRush: number(state.values.beacons) >= 5
  };
}

function aiTargetScore(design, state, seatIndex, targetId, action) {
  const node = design.engine.map.nodes.find((item) => item.id === targetId);
  if (!node) return -Infinity;
  const owner = state.owners?.[targetId];
  const occupiedByOpponent = state.units.some((unit) => unit.nodeId === targetId && unit.seatIndex !== seatIndex);
  const base = number(node.scoreValue);
  if (/secure|稳固/u.test(`${action?.id || ""} ${action?.label || ""}`)) {
    return base * 8 + (owner === null || owner === undefined ? 12 : owner === seatIndex ? -4 : 8) + (occupiedByOpponent ? 4 : 0);
  }
  if (/sail|航行/u.test(`${action?.id || ""} ${action?.label || ""}`)) {
    return base * 8 + (occupiedByOpponent ? -3 : 0) + (owner === seatIndex ? 2 : 0);
  }
  return base * 8 + (node.terrain === "lighthouse" ? 5 : 0);
}

function aiChoice(design, state) {
  const actions = activeActions(design, state);
  const seatIndex = state.activeSeatIndex;
  const situation = aiSituation(design, state, seatIndex);
  const score = (action) => {
    const label = `${action.id} ${action.label}`;
    const material = aiValue(design, state, seatIndex, "material");
    const energy = aiValue(design, state, seatIndex, "energy");
    const supply = aiValue(design, state, seatIndex, "supply");
    const influence = aiValue(design, state, seatIndex, "influence");
    if (/build-beacon|修复灯塔/u.test(label)) {
      if (material < 2 || energy < 1) return -50;
      return 100 + (situation.lowStability ? 20 : 0) + (situation.opponentReadyToBuild ? 10 : 0) + (situation.isBehind ? 6 : 0);
    }
    if (/research|研究/u.test(label)) {
      if (energy < 1) return 90 + (material >= 2 ? 10 : 0);
      return situation.opponentReadyToBuild > 0 && situation.isBehind ? 62 : 42;
    }
    if (/salvage|打捞/u.test(label)) return material < 2 ? 88 : situation.beaconRush ? 68 : 58;
    if (/trade|贸易/u.test(label)) {
      if (material < 1) return -50;
      return supply <= 1 ? 84 : (situation.isBehind ? 62 : 46);
    }
    if (/sail|航行/u.test(label)) {
      if (supply < 1) return -50;
      const legal = legalBoardGameTargets(design, state, action.id, seatIndex);
      const bestTarget = Math.max(...legal.map((targetId) => aiTargetScore(design, state, seatIndex, targetId, action)), 0);
      return 48 + bestTarget / 10 + (situation.isBehind ? 4 : 0);
    }
    if (/secure|稳固/u.test(label)) {
      if (influence < 1) return -50;
      const legal = legalBoardGameTargets(design, state, action.id, seatIndex);
      const bestTarget = Math.max(...legal.map((targetId) => aiTargetScore(design, state, seatIndex, targetId, action)), 0);
      return 45 + bestTarget / 10 + (situation.isBehind ? 8 : 0);
    }
    if (action.kind === "vote") {
      const civicProfile = [14, -12, 10, -15][seatIndex % 4] || 0;
      const stabilityPressure = number(state.values.stability) <= 4 ? 18 : 0;
      return action.amount > 0 ? 55 + civicProfile + stabilityPressure : 55 - civicProfile;
    }
    if (action.kind === "place") {
      if (/订单|交付|order|fulfill/i.test(label) && aiValue(design, state, seatIndex, "iron") < 2) return -50;
      if (/熔炉|锻造|forge|iron/i.test(label) && aiValue(design, state, seatIndex, "wood") < 1) return -100;
      if (/木工|伐木|wood|timber/i.test(label)) return aiValue(design, state, seatIndex, "wood") < 3 ? 84 : 44;
      if (/熔炉|锻造|forge|iron/i.test(label)) return 76;
      if (/订单|交付|order|fulfill/i.test(label) && aiValue(design, state, seatIndex, "iron") >= 2) return 96;
      if (/订单|交付|order|fulfill/i.test(label)) return -100;
      return 52;
    }
    if (action.kind === "draw") return aiValue(design, state, seatIndex, "hand") >= 3 ? 18 : 82;
    if (action.kind === "play") return aiValue(design, state, seatIndex, "hand") < 1 ? -50 : 90 + aiValue(design, state, seatIndex, "hand");
    if (action.kind === "draft") {
      const cards = action.draftMode === "hand"
        ? (Array.isArray(state.hands?.[seatIndex]) ? state.hands[seatIndex] : [])
        : (Array.isArray(state.market) ? state.market : []);
      if (!cards.length) return -50;
      return 86 + cards.reduce((best, card) => Math.max(best, number(card.effects?.find((effect) => effect.targetKey === "score")?.value)), 0);
    }
    if (action.kind === "claim_route") {
      const legal = legalBoardGameTargets(design, state, action.id, seatIndex);
      return legal.length ? 88 + Math.max(...legal.map((routeId) => number(design.engine.map.edges.find((edge) => edge.id === routeId)?.cost))) * 4 : -50;
    }
    if (action.kind === "roll") {
      const risk = number(state.riskProgress?.[seatIndex]);
      return risk >= 12 ? 30 : 82;
    }
    if (action.kind === "stop") {
      const risk = number(state.riskProgress?.[seatIndex]);
      return risk > 0 ? (risk >= 12 ? 96 : 62) : 8;
    }
    if (action.kind === "bid") {
      const coins = aiValue(design, state, seatIndex, action.resourceKey);
      if (!coins) return -50;
      return 72 + (situation.isBehind ? 14 : 0) + Math.max(0, 5 - number(state.values.lot));
    }
    if (action.kind === "pass") return 1;
    return 20;
  };
  const viable = actions.filter((action) => action.target === "none" || legalBoardGameTargets(design, state, action.id, seatIndex).length > 0);
  return viable.slice().sort((left, right) => score(right) - score(left))[0] || null;
}

function aiBidAmount(design, state, action) {
  const coins = aiValue(design, state, state.activeSeatIndex, action.resourceKey);
  const situation = aiSituation(design, state, state.activeSeatIndex);
  const seatProfile = [0.55, 0.43, 0.50, 0.36][state.activeSeatIndex % 4] || 0.45;
  const comeback = situation.isBehind ? 0.14 : 0;
  const tempo = (state.round + state.activeSeatIndex) % 3 === 0 ? 0.05 : 0;
  return Math.min(coins, Math.max(0, Math.round(coins * (seatProfile + comeback + tempo))));
}

function aiTarget(design, state, action) {
  if (!action || action.target === "none") return "";
  const legal = legalBoardGameTargets(design, state, action.id, state.activeSeatIndex);
  if (!legal.length) return "";
  return legal.slice().sort((left, right) => {
    return aiTargetScore(design, state, state.activeSeatIndex, right, action) - aiTargetScore(design, state, state.activeSeatIndex, left, action);
  })[0] || legal[0];
}

/** Execute exactly one AI seat step, including a resolved-phase advance. */
export function runBoardGameAiStep(state, design) {
  if (state.ended) return { ok: false, ended: true, advanced: false };
  if (state.resolved) {
    const advanced = advanceBoardGamePlaygroundRound(state, design);
    return { ok: advanced, ended: state.ended, advanced: true };
  }
  const responseActions = state.pendingResponseWindow ? activeActions(design, state) : [];
  const decision = state.pendingResponseWindow
    ? (() => {
      const action = responseActions.find((candidate) => candidate.kind === "pass")
        || responseActions.find((candidate) => candidate.target === "none" || legalBoardGameTargets(design, state, candidate.id, state.activeSeatIndex).length)
        || responseActions[0];
      const targetId = aiTarget(design, state, action);
      const hand = Array.isArray(state.hands?.[state.activeSeatIndex]) ? state.hands[state.activeSeatIndex] : [];
      return action ? { ok: true, actionId: action.id, targetId, cardId: action.kind === "play" ? hand[0]?.id || "" : "", bidAmount: 0, reason: "反应窗口内按 AI 默认策略及时响应" } : { ok: false, reason: "没有可用反应" };
    })()
    : chooseBoardGameAiDecision(design, state, state.activeSeatIndex, { searchDepth: 2, maxSearchCandidates: 10 });
  const action = design.engine.actions.find((item) => item.id === decision.actionId);
  if (!decision.ok || !action) return { ok: false, ended: false, advanced: false, decision };
  const seatIndex = state.activeSeatIndex;
  const targetId = decision.targetId;
  const cardId = decision.cardId;
  state.selectedActionId = action.id;
  state.selectedTargetId = targetId;
  state.selectedCardId = cardId;
  state.selectedBidAmount = decision.bidAmount || 0;
  state.uiStage = action.target === "none" || targetId ? "confirm" : "target";
  const result = executeOnlineBoardGameAction(design, state, { actionId: action.id, targetId, seatIndex: state.activeSeatIndex, bidAmount: state.selectedBidAmount, cardId });
  if (!result.ok) {
    state.lastError = result.message || "AI 行动不能执行。";
    return { ok: false, ended: false, advanced: false };
  }
  Object.assign(state, result.state, {
    selectedActionId: "",
    selectedTargetId: "",
    selectedCardId: "",
    selectedBidAmount: 0,
    uiStage: result.phaseResolved ? "resolved" : "command",
    lastError: ""
  });
  pushUiLog(state, `AI 席位 ${seatIndex + 1} 执行「${action.label}」${targetId ? ` → ${design.engine.map.nodes.find((node) => node.id === targetId)?.label || targetId}` : ""}（${decision.reason}）。`, "ai");
  return { ok: true, ended: state.ended, advanced: false, decision };
}

function resourceValue(state, seatIndex, variable) {
  return variable.scope === "player" ? state.playerValues[seatIndex]?.[variable.id] : state.values[variable.id];
}

function actionCards(design, state, options = {}) {
  return activeActions(design, state).map((action) => {
    const selected = state.selectedActionId === action.id;
    const variable = design.variables.find((item) => item.id === action.resourceKey);
    const value = variable ? resourceValue(state, state.activeSeatIndex, variable) : null;
    const affordable = !action.cost || number(value) >= action.cost;
    return `<button type="button" class="board-play-card ${selected ? "selected" : ""}" data-action="board-play-command" data-board-play-command-id="${escapeHtml(action.id)}" aria-pressed="${selected}" ${state.resolved || state.ended || options.aiRunning || !affordable ? "disabled" : ""}>
      <span class="board-play-card-cost">${action.cost || "·"}</span><span class="board-play-card-icon">${icon(action.kind)}</span><strong>${escapeHtml(action.label)}</strong><small>${escapeHtml(action.description || ACTION_LABELS[action.kind] || action.kind)}</small><em>${escapeHtml(ACTION_LABELS[action.kind] || action.kind)}</em>
    </button>`;
  }).join("");
}

function mapEdges(design, state) {
  const nodes = new Map(design.engine.map.nodes.map((node) => [node.id, node]));
  return `<svg class="board-play-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${design.engine.map.edges.map((edge) => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) return "";
    const owner = state.routeOwners?.[edge.id];
    return `<line class="${edge.blocked ? "blocked" : ""} ${Number.isInteger(owner) ? `owned seat-${owner % 8}` : ""}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line>`;
  }).join("")}</svg>`;
}

function mapNodes(design, state) {
  const action = design.engine.actions.find((item) => item.id === state.selectedActionId);
  const legal = new Set(action ? legalBoardGameTargets(design, state, action.id, state.activeSeatIndex) : []);
  return design.engine.map.nodes.map((node) => {
    const selectable = Boolean(action && action.target !== "none" && legal.has(node.id) && !state.resolved);
    const owner = state.owners[node.id];
    const units = state.units.filter((unit) => unit.nodeId === node.id).length;
    return `<button type="button" class="board-play-node terrain-${escapeHtml(node.terrain)} ${state.selectedTargetId === node.id ? "selected" : ""} ${selectable ? "legal" : ""} ${Number.isInteger(owner) ? `owned seat-${owner % 8}` : ""}" style="--node-x:${node.x}%;--node-y:${node.y}%" data-action="board-play-target" data-board-play-target-id="${escapeHtml(node.id)}" ${selectable ? "" : "disabled"} title="${escapeHtml(node.description || node.label)}">
      <span class="board-play-node-mark"></span><strong>${escapeHtml(node.label)}</strong><small>${escapeHtml(node.terrain)} · ${node.scoreValue ? `${node.scoreValue}分` : "0分"}${units ? ` · ${units}单位` : ""}</small>
    </button>`;
  }).join("");
}

function mapRouteControls(design, state) {
  const action = design.engine.actions.find((item) => item.id === state.selectedActionId);
  if (!action || action.target !== "any_route" || state.resolved) return "";
  const nodes = new Map(design.engine.map.nodes.map((node) => [node.id, node]));
  const legal = new Set(legalBoardGameTargets(design, state, action.id, state.activeSeatIndex));
  return design.engine.map.edges.map((edge) => {
    if (!legal.has(edge.id)) return "";
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) return "";
    const x = (number(from.x) + number(to.x)) / 2;
    const y = (number(from.y) + number(to.y)) / 2;
    return `<button type="button" class="board-play-route-target" style="--route-x:${x}%;--route-y:${y}%" data-action="board-play-target" data-board-play-target-id="${escapeHtml(edge.id)}" title="${escapeHtml(edge.label || edge.id)} · ${edge.cost || 1} 资源">${edge.cost || 1}</button>`;
  }).join("");
}

function mapTokens(design, state, roles) {
  const nodes = new Map(design.engine.map.nodes.map((node) => [node.id, node]));
  const offsetsByNode = new Map();
  for (const unit of state.units) {
    const nodeOffsets = offsetsByNode.get(unit.nodeId) || new Map();
    nodeOffsets.set(unit.seatIndex, 0);
    offsetsByNode.set(unit.nodeId, nodeOffsets);
  }
  for (const nodeOffsets of offsetsByNode.values()) {
    let offset = 0;
    for (const seatIndex of [...nodeOffsets.keys()].sort((left, right) => left - right)) {
      nodeOffsets.set(seatIndex, offset);
      offset += 1;
    }
  }
  return state.units.map((unit) => {
    const node = nodes.get(unit.nodeId);
    if (!node) return "";
    const sameNodeIndex = offsetsByNode.get(unit.nodeId)?.get(unit.seatIndex) || 0;
    const roleName = roles[unit.seatIndex]?.name || `席位 ${unit.seatIndex + 1}`;
    return `<span class="board-play-unit seat-${unit.seatIndex % 8} ${state.lastMove?.unitId === unit.id ? "arrive" : ""}" style="--unit-x:${node.x}%;--unit-y:${node.y}%;--unit-offset:${sameNodeIndex}" aria-label="${escapeHtml(roleName)}单位"><b>${unit.seatIndex + 1}</b></span>`;
  }).join("");
}

function seatTracks(design, state, roles) {
  const scoreVariable = design.variables.find((variable) => /score|分数|积分|胜利/i.test(`${variable.id} ${variable.label}`));
  const max = Math.max(1, number(scoreVariable?.max, 30));
  return Array.from({ length: state.seatCount }, (_, seatIndex) => {
    const variableScore = scoreVariable ? number(resourceValue(state, seatIndex, scoreVariable)) : 0;
    const score = variableScore + number(state.scores[seatIndex]);
    const progress = Math.max(0, Math.min(100, score / max * 100));
    return `<article class="board-play-seat seat-${seatIndex % 8} ${state.activeSeatIndex === seatIndex ? "active" : ""}"><span>${seatIndex + 1}</span><div><strong>${escapeHtml(roles[seatIndex]?.name || `席位 ${seatIndex + 1}`)}</strong><i><b style="width:${progress}%"></b></i><small>${escapeHtml(claimedCardSummary(state, seatIndex))}</small></div><em>${score}</em></article>`;
  }).join("");
}

function resources(design, state) {
  const summary = design.variables.map((variable) => `<span><small>${escapeHtml(variable.label)}</small><strong>${escapeHtml(String(resourceValue(state, state.activeSeatIndex, variable) ?? variable.initialValue))}</strong></span>`).join("");
  const risk = number(state.riskProgress?.[state.activeSeatIndex]);
  const dice = Array.isArray(state.dice) && state.dice.length ? state.dice.join("、") : "—";
  return `${summary}${state.riskProgress ? `<span class="board-play-runtime-signal"><small>当前风险</small><strong>${risk} · ${dice}</strong></span>` : ""}`;
}

function publicTableCard(design, state) {
  const phase = phaseFor(design, state);
  if (state.currentPhaseCard?.name) return state.currentPhaseCard;
  const bidAction = activeActions(design, state).find((action) => action.kind === "bid" && action.deckId);
  if (bidAction?.deckId && Array.isArray(state.decks?.[bidAction.deckId])) return state.decks[bidAction.deckId].at(-1) || null;
  if (phase?.deckId && Array.isArray(state.decks?.[phase.deckId])) return state.decks[phase.deckId].at(-1) || null;
  return null;
}

function publicTableDeckId(design, state) {
  const phase = phaseFor(design, state);
  if (phase?.deckId) return phase.deckId;
  return activeActions(design, state).find((action) => action.kind === "bid" && action.deckId)?.deckId || "";
}

function publicCardPanel(design, state) {
  const card = publicTableCard(design, state);
  const deckId = publicTableDeckId(design, state);
  const remaining = deckId && Array.isArray(state.decks?.[deckId]) ? state.decks[deckId].length : null;
  const market = Array.isArray(state.market) ? state.market : [];
  if (!card && remaining === null && !market.length) return "";
  const marketMarkup = market.length ? `<div class="board-play-market"><small>公共市场 · ${market.length} 张可选</small><div>${market.map((item) => `<article><strong>${escapeHtml(item.name || item.id)}</strong><span>${escapeHtml(item.description || "无额外效果")}</span></article>`).join("")}</div></div>` : "";
  const cardMarkup = card || remaining !== null ? `<div class="board-play-public-card-main"><div class="board-play-public-card-art">${icon("mechanism")}</div><div><small>公开牌面${remaining === null ? "" : ` · 牌堆剩余 ${remaining}`}</small><strong>${escapeHtml(card?.name || "等待翻开")}</strong><p>${escapeHtml(card?.description || "当前阶段没有新的公开牌面，牌堆内容仍由引擎保留。")}</p></div></div>` : "";
  return `<section class="board-play-public-card">${cardMarkup}${marketMarkup}</section>`;
}

function claimedCardSummary(state, seatIndex) {
  const cards = Array.isArray(state.claimedCards?.[seatIndex]) ? state.claimedCards[seatIndex] : [];
  if (!cards.length) return "尚无收藏";
  const names = cards.slice(-2).map((card) => card.name || card.id).join("、");
  return cards.length > 2 ? `${names} · 共 ${cards.length} 张` : names;
}

function responsePanel(state) {
  const responses = Array.isArray(state.responseEvents) ? state.responseEvents.slice(0, 8) : [];
  if (!responses.length) return `<section class="board-play-responses"><div><h3>效果响应</h3><span>等待牌面或机制结算</span></div><p>每次卡牌、机制和轮次效果都会在这里记录来源、作用对象与前后值。</p></section>`;
  return `<section class="board-play-responses"><div><h3>效果响应</h3><span>${responses.length} 条最近变化</span></div><ul>${responses.map((entry) => `<li class="${entry.status === "queued" ? "queued" : entry.applied ? "applied" : "skipped"}"><i></i><div><strong>${escapeHtml(entry.sourceLabel || entry.sourceType || "效果")}</strong><span>${escapeHtml(entry.detail || `${entry.targetKey} ${entry.operation}`)}</span></div><em>${entry.targetSeatIndex === null ? "公共" : `席位 ${Number(entry.targetSeatIndex) + 1}`}</em></li>`).join("")}</ul></section>`;
}

function actionRail(design, state, options = {}) {
  const action = design.engine.actions.find((item) => item.id === state.selectedActionId);
  const target = design.engine.map.nodes.find((item) => item.id === state.selectedTargetId)
    || design.engine.map.edges.find((item) => item.id === state.selectedTargetId);
  const ready = Boolean(action && (action.target === "none" || target) && state.uiStage === "confirm");
  const hand = Array.isArray(state.hands?.[state.activeSeatIndex]) ? state.hands[state.activeSeatIndex] : [];
  const pickerCards = action?.kind === "draft"
    ? action.draftMode === "hand"
      ? hand
      : (Array.isArray(state.market) ? state.market : [])
    : action?.kind === "play" ? hand : [];
  const handPicker = pickerCards.length
    ? `<section class="board-play-hand-picker"><small>${action?.kind === "draft" ? (action.draftMode === "hand" ? `选择手牌 · 向${state.draftDirection === "left" ? "左" : "右"}传递` : "选择公共市场模块") : "选择要打出的牌"}</small><div>${pickerCards.map((card) => `<button type="button" class="board-play-card-chip ${state.selectedCardId === card.id ? "selected" : ""}" data-action="board-play-card-select" data-board-play-card-id="${escapeHtml(card.id)}" ${options.aiRunning ? "disabled" : ""}><strong>${escapeHtml(card.name || card.id)}</strong><span>${escapeHtml(card.description || "无额外说明")}</span></button>`).join("")}</div></section>`
    : "";
  const phase = phaseFor(design, state);
  const responseWindow = state.pendingResponseWindow;
  const responseSeconds = responseWindow ? Math.max(0, Math.ceil((Number(responseWindow.deadlineAt) - Date.now()) / 1000)) : 0;
  return `<aside class="board-play-actions">
    <header><p>${responseWindow ? "当前反应窗口" : "当前执行单元"}</p><h3>${escapeHtml(responseWindow ? "行动后响应" : (phase?.label || "未定义阶段"))}</h3><span>${responseWindow ? `限时 ${responseSeconds}s · 仅允许响应行动` : phase?.mode === "sequential" ? "顺序行动" : phase?.mode === "reveal" ? "提交后统一公开" : "同时选择"}</span></header>
    <div class="board-play-active-seat"><span class="seat-${state.activeSeatIndex % 8}">${state.activeSeatIndex + 1}</span><div><small>当前提交席位</small><strong>席位 ${state.activeSeatIndex + 1}</strong></div></div>
    <ol>
      <li class="${action ? "done" : "active"}"><span>1</span><div><strong>${responseWindow ? "选择响应" : "选择合法行动"}</strong><small>${action ? escapeHtml(action.label) : responseWindow ? "等待当前席位提交响应" : "只显示本阶段声明的行动"}</small></div></li>
      <li class="${target || action?.target === "none" ? "done" : action ? "active" : ""}"><span>2</span><div><strong>选择合法目标</strong><small>${action?.target === "none" ? "该行动不需要目标" : target ? escapeHtml(target.label) : "地图仅开放合法区域"}</small></div></li>
      <li class="${state.resolved ? "done" : ready ? "active" : ""}"><span>3</span><div><strong>确认后执行</strong><small>${state.resolved ? "阶段行动已结算" : ready ? "尚未改变状态" : "等待前置选择"}</small></div></li>
    </ol>
    <section class="board-play-pending"><span>${options.aiMode ? "AI 正在代打" : "待执行"}</span><strong>${action ? escapeHtml(action.label) : "尚未选择"}${target ? ` → ${escapeHtml(target.label)}` : ""}</strong><p>${escapeHtml(action?.description || (options.aiMode ? "所有席位由 AI 代为选择，状态会统一同步到这张桌面。" : "选择行动后，所有状态会在统一结算时更新。"))}</p>${handPicker}${action?.kind === "bid" ? `<label class="board-play-bid-control"><span>本次出价（公开结算前隐藏）</span><input type="number" min="0" max="999" step="1" value="${state.selectedBidAmount}" data-board-play-bid ${options.aiRunning ? "disabled" : ""}></label>` : ""}<button type="button" class="board-play-confirm" data-action="board-play-confirm" ${ready && (!action || !["play", "draft"].includes(action.kind) || state.selectedCardId) && !options.aiRunning ? "" : "disabled"}>确认执行</button>${state.lastError ? `<small class="board-play-error">${escapeHtml(state.lastError)}</small>` : ""}</section>
    <div class="board-play-controls"><button type="button" data-action="board-play-reset">${icon("reset")}<span>重置试玩</span></button><button type="button" data-action="board-play-next" ${state.resolved && !state.ended ? "" : "disabled"}>${icon("next")}<span>推进流程</span></button></div>
    ${responsePanel(state)}
    <section class="board-play-log"><div><h3>引擎事件</h3><span>${state.log.length} 条</span></div><ul>${state.log.map((entry, index) => `<li class="${escapeHtml(entry.tone)} ${index === 0 ? "latest" : ""}"><i></i><span>${escapeHtml(entry.text)}</span></li>`).join("")}</ul></section>
  </aside>`;
}

function compileSummary(report) {
  const passed = report.tests.filter((test) => test.passed).length;
  return `<div class="board-play-compile"><span class="${report.blocking ? "blocked" : "ready"}">${report.blocking ? "不可运行" : "引擎可运行"}</span><strong>${passed}/${report.tests.length} 结构测试通过</strong><small>${report.engine.map.nodes.length} 区域 · ${report.engine.map.edges.length} 路线 · ${report.engine.actions.length} 行动</small></div>`;
}

export function renderBoardGamePlayground(design, stateValue, roles = [], options = {}) {
  const report = compileBoardGameEngine(design, roles.length || design.playerCount.min);
  if (report.blocking) {
    const issues = report.issues.filter((item) => item.level === "error").slice(0, 6);
    return `<section class="board-playground-empty"><div class="board-play-engine-blocked"><span>${icon("map")}</span><p class="section-kicker">ENGINE CONTRACT</p><h2>这个原型还不能进行真实试玩</h2><p>请回到组件、条件与计算中亲自补齐区域、路线、阶段和可执行行动。说明文字不会被当成已实现机制。</p><ul>${issues.map((item) => `<li><strong>${escapeHtml(item.code)}</strong><span>${escapeHtml(item.message)}</span></li>`).join("")}</ul></div></section>`;
  }
  const state = normalizeBoardGamePlaygroundState(stateValue, design, roles.length || design.playerCount.min);
  const phase = phaseFor(design, state);
  const capabilityIds = new Set([`map.${design.engine.map.kind}`, `phase.${phase?.mode}`, ...activeActions(design, state).map((action) => `action.${action.kind}`)]);
  const aiMode = Boolean(options.aiMode);
  const aiRunning = Boolean(options.aiRunning);
  const secondsRemaining = Math.max(0, Math.ceil(Number(options.secondsRemaining) || 0));
  return `<section class="board-playground" data-board-playground>
    <header class="board-playground-head"><div><div class="board-play-kicker-row"><p class="section-kicker">SYNCED TABLETOP · AI HOST</p><span class="board-play-live"><i></i>${aiMode ? "AI 全席代打" : "手动试玩"}</span></div><h2>${escapeHtml(design.title || "最后灯塔 · 同步试玩桌")}</h2><p>${escapeHtml(design.designGoal || "所有角色、资源与地图状态由同一套规则实时同步。")}</p></div><div class="board-play-head-actions"><div class="board-play-deadline"><small>阶段限时</small><strong>${secondsRemaining}s</strong></div><button type="button" class="board-play-ai-toggle ${aiMode ? "active" : ""}" data-action="board-play-ai-toggle">${aiMode ? (aiRunning ? "暂停 AI" : "继续 AI") : "启用 AI 代打"}</button>${compileSummary(report)}</div></header>
    <div class="board-play-capabilities">${[...capabilityIds].map((id) => { const item = boardGameCapability(id); return `<span class="${item.status}">${escapeHtml(item.label)} · ${escapeHtml(item.status)}</span>`; }).join("")}</div>
    <div class="board-play-layout"><div class="board-play-table">
      <section class="board-play-topbar"><div><small>流程位置</small><strong>第 ${state.round} / ${design.engine.maxRounds} 轮 · ${escapeHtml(phase?.label || "阶段")}</strong><span class="board-play-sync-note">所有席位 · 同步结算</span></div><div class="board-play-phases">${design.engine.phases.map((item, index) => `<span class="${index === state.phaseIndex ? "active" : ""}">${index + 1}. ${escapeHtml(item.label)}</span>`).join("")}</div><div class="board-play-resources">${resources(design, state)}</div></section>
      <section class="board-play-scoreboard">${seatTracks(design, state, roles)}</section>
      ${publicCardPanel(design, state)}
      <div class="board-play-map" aria-label="由区域与路线数据生成的桌游地图">${mapEdges(design, state)}${mapRouteControls(design, state)}${mapNodes(design, state)}${mapTokens(design, state, roles)}<span class="board-play-map-grid"></span></div>
      <div class="board-play-hand"><div class="board-play-deck" aria-label="当前阶段行动">${icon("mechanism")}<small>${activeActions(design, state).length} 张行动</small></div>${actionCards(design, state, { aiRunning })}</div>
    </div>${actionRail(design, state, { aiMode, aiRunning })}</div>
  </section>`;
}

function dominionCommandButton(command, label, tone = "secondary") {
  const encoded = encodeURIComponent(JSON.stringify(command));
  return `<button type="button" class="dominion-study-command ${tone}" data-action="board-dominion-command" data-dominion-command="${encoded}">${escapeHtml(label)}</button>`;
}

function dominionPromptActions(state, privateState, selectedIds = []) {
  const prompt = state.pendingPrompt;
  if (!prompt) return "";
  if (prompt.type === "select-reaction") return `<div class="dominion-study-choice-row">${dominionCommandButton({ type: "resolve-prompt", revealMoat: true }, "翻开 Moat", "primary")}${dominionCommandButton({ type: "resolve-prompt", revealMoat: false }, "不响应")}</div>`;
  if (prompt.type === "select-vassal-action") return `<div class="dominion-study-choice-row">${dominionCommandButton({ type: "resolve-prompt", cardId: prompt.cardId }, "打出翻开的行动牌", "primary")}${dominionCommandButton({ type: "resolve-prompt", cardId: "none" }, "弃置")}</div>`;
  if (prompt.type === "select-library-card") return `<div class="dominion-study-choice-row">${dominionCommandButton({ type: "resolve-prompt", cardId: prompt.cardId, choice: "keep" }, "留在手牌")}${dominionCommandButton({ type: "resolve-prompt", cardId: prompt.cardId, choice: "set-aside" }, "暂放并弃置", "primary")}</div>`;
  if (prompt.type === "select-sentry-card") {
    const card = prompt.cards?.[0];
    return `<p class="dominion-study-prompt-card">正在处理：${escapeHtml(card?.name || card?.cardId || "牌库顶牌")}</p><div class="dominion-study-choice-row">${dominionCommandButton({ type: "resolve-prompt", cardId: card?.uid, choice: "trash" }, "垃圾处理")}${dominionCommandButton({ type: "resolve-prompt", cardId: card?.uid, choice: "discard" }, "弃置", "primary")}${dominionCommandButton({ type: "resolve-prompt", cardId: card?.uid, choice: "topdeck" }, "放回牌库顶")}</div>`;
  }
  if (prompt.type === "select-sentry-order") return `<p class="dominion-study-prompt-card">请选择放回牌库顶的顺序：${prompt.cards.map((card) => escapeHtml(card.name)).join("、")}</p><div class="dominion-study-choice-row">${dominionCommandButton({ type: "resolve-prompt", cardIds: prompt.cards.map((card) => card.uid) }, "按当前顺序")}${dominionCommandButton({ type: "resolve-prompt", cardIds: [...prompt.cards].reverse().map((card) => card.uid) }, "反向顺序")}</div>`;
  if (prompt.type === "select-supply") {
    const choices = Object.values(state.supply).filter((pile) => pile.count > 0 && pile.cost <= prompt.maxCost).sort((a, b) => b.cost - a.cost).slice(0, 8);
    return `<div class="dominion-study-choice-grid">${choices.map((pile) => dominionCommandButton({ type: "resolve-prompt", cardId: pile.cardId }, `${pile.name} · ${pile.cost}`)).join("")}</div>`;
  }
  if (prompt.type === "select-action-card") {
    const actions = privateState.players[prompt.playerIndex]?.hand?.filter((item) => item.cardId && !item.cardId.includes("none")) || [];
    return `<div class="dominion-study-choice-grid">${actions.map((card) => dominionCommandButton({ type: "resolve-prompt", cardId: card.uid }, `选择 ${card.name}`)).join("")}${prompt.optional ? dominionCommandButton({ type: "resolve-prompt", cardId: "none" }, "跳过") : ""}</div>`;
  }
  if (prompt.type === "select-hand-trash" || prompt.type === "select-hand-discard" || prompt.type === "select-attack-discard") {
    const hand = privateState.players[prompt.playerIndex]?.hand || [];
    const required = prompt.type === "select-attack-discard" ? Math.max(0, hand.length - prompt.maxHand) : prompt.exact ? prompt.max : `0-${prompt.max}`;
    return `<p class="dominion-study-prompt-card">已选择 ${selectedIds.length} 张 · 需要 ${required} 张</p><div class="dominion-study-choice-grid">${hand.map((card) => `<button type="button" class="dominion-study-card-picker ${selectedIds.includes(card.uid) ? "selected" : ""}" data-action="board-dominion-select-card" data-dominion-card-id="${escapeHtml(card.uid)}"><strong>${escapeHtml(card.name)}</strong><em>${escapeHtml(card.cardId)}</em></button>`).join("")}</div><div class="dominion-study-choice-row">${dominionCommandButton({ type: "resolve-prompt", cardIds: selectedIds }, "提交选择", "primary")}</div>`;
  }
  if (prompt.type === "select-treasure-trash") return `<div class="dominion-study-choice-grid">${privateState.players[prompt.playerIndex]?.hand?.filter((card) => ["copper", "silver", "gold"].includes(card.cardId) && (!prompt.copperOnly || card.cardId === "copper")).map((card) => dominionCommandButton({ type: "resolve-prompt", cardId: card.uid }, `处理 ${card.name}`)).join("")}${!prompt.required ? dominionCommandButton({ type: "resolve-prompt", cardId: "none" }, "不处理") : ""}</div>`;
  if (prompt.type === "select-card-topdeck") {
    const choices = prompt.source === "discard" ? privateState.players[prompt.playerIndex]?.discard || [] : [...(privateState.players[prompt.playerIndex]?.discard || []), ...(privateState.players[prompt.playerIndex]?.hand || [])];
    return `<div class="dominion-study-choice-grid">${choices.map((card) => dominionCommandButton({ type: "resolve-prompt", cardId: card.uid }, `放回 ${card.name}`)).join("")}${dominionCommandButton({ type: "resolve-prompt", cardId: "none" }, "不放回")}</div>`;
  }
  return "";
}

export function renderDominionStudyPanel(stateValue, options = {}) {
  if (!stateValue) return "";
  const publicState = dominionPublicState(stateValue);
  const privateState = dominionPrivateState(stateValue, stateValue.activePlayerIndex);
  const active = privateState.players[stateValue.activePlayerIndex];
  const prompt = stateValue.pendingPrompt;
  const promptPrivateState = prompt ? dominionPrivateState(stateValue, prompt.playerIndex) : privateState;
  const selectedPromptCards = options.selection || [];
  const commands = legalDominionCommands(stateValue);
  const actionButtons = active.phase === "action"
    ? `${active.hand.filter((card) => DOMINION_ACTION_IDS.has(card.cardId)).map((card) => dominionCommandButton({ type: "play-action", cardId: card.uid }, `打出 ${card.name}`)).join("")}${dominionCommandButton({ type: "end-action" }, "结束行动", "primary")}`
    : active.phase === "buy"
      ? `${dominionCommandButton({ type: "play-treasures", cardIds: active.hand.filter((card) => ["copper", "silver", "gold"].includes(card.cardId)).map((card) => card.uid) }, "打出全部宝藏", "primary")}${Object.values(stateValue.supply).filter((pile) => pile.count > 0 && pile.cost <= active.coins).sort((a, b) => b.cost - a.cost).slice(0, 6).map((pile) => dominionCommandButton({ type: "buy", cardId: pile.cardId }, `购买 ${pile.name} · ${pile.cost}`)).join("")}${dominionCommandButton({ type: "end-buy" }, "结束购买")}`
      : "";
  return `<section class="dominion-study-panel" data-dominion-study><header class="dominion-study-head"><div><p class="section-kicker">DOMINION STUDY · RESPONSE LAB</p><h3>牌库构筑研究桌</h3><p>核心局面由同一份状态同步；当前提示必须完成，不能跳过响应。</p></div><div class="dominion-study-head-actions">${dominionCommandButton({ type: "reset" }, "重置研究局")}<button type="button" class="dominion-study-command secondary" data-action="board-dominion-ai-turn">AI 跑一回合</button></div></header><div class="dominion-study-metrics"><span>当前席位 <b>${stateValue.activePlayerIndex + 1}</b></span><span>阶段 <b>${escapeHtml(active.phase)}</b></span><span>回合 <b>${active.turn}</b></span><span>Province <b>${publicState.supply.province.count}</b></span><span>空牌堆 <b>${Object.values(publicState.supply).filter((pile) => pile.count === 0).length}</b></span></div><div class="dominion-study-layout"><div><div class="dominion-study-hand"><small>当前席位私有手牌</small><div>${active.hand.map((card) => `<span class="dominion-study-card"><strong>${escapeHtml(card.name)}</strong><em>${escapeHtml(card.cardId)}</em></span>`).join("")}</div></div><div class="dominion-study-actions">${prompt ? `<div class="dominion-study-prompt"><strong>等待响应：${escapeHtml(prompt.type)} · 席位 ${prompt.playerIndex + 1}</strong>${dominionPromptActions(stateValue, promptPrivateState, selectedPromptCards)}</div>` : actionButtons || `<span class="dominion-study-muted">等待当前阶段继续。</span>`}</div></div><aside class="dominion-study-public"><strong>公共信息</strong>${publicState.players.map((player) => `<div><span>席位 ${player.playerIndex + 1}</span><span>手牌 ${player.handCount} · 牌库 ${player.deckCount} · 分数 ${player.score}</span></div>`).join("")}<small>${commands.length} 个合法命令${prompt ? " · 当前为响应窗口" : ""}</small></aside></div></section>`;
}

export function runDominionStudyAiTurn(stateValue) {
  return runDominionReferenceTurn(stateValue, stateValue.activePlayerIndex).state;
}
