import "./board-game-playground.css";
import { escapeHtml } from "../utils/format.js";
import {
  advanceBoardGameRuntime,
  boardGameCapability,
  compileBoardGameEngine,
  createBoardGameRuntimeState,
  executeBoardGameAction,
  legalBoardGameTargets,
  normalizeBoardGameRuntimeState
} from "../../shared/board-game-engine.js";

const ACTION_LABELS = Object.freeze({
  move: "移动", gain: "获得", pay: "支付", control: "控制", score: "计分",
  mechanism: "规则", bid: "竞价", draw: "抽牌", play: "出牌", reveal: "公开", pass: "跳过"
});

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
    uiStage: "command",
    lastError: ""
  };
}

export function normalizeBoardGamePlaygroundState(stateValue, design, seatCount = 0) {
  const state = normalizeBoardGameRuntimeState(stateValue, design, seatCount);
  state.selectedActionId ||= "";
  state.selectedTargetId ||= "";
  state.uiStage ||= state.resolved ? "resolved" : "command";
  state.lastError ||= "";
  return state;
}

export function chooseBoardGamePlaygroundCommand(state, design, actionId) {
  const action = activeActions(design, state).find((item) => item.id === actionId);
  if (!action || state.resolved || state.ended) return false;
  state.selectedActionId = action.id;
  state.selectedTargetId = "";
  state.lastError = "";
  state.uiStage = action.target === "none" ? "confirm" : "target";
  pushUiLog(state, phaseFor(design, state)?.mode === "reveal"
    ? `席位 ${state.activeSeatIndex + 1} 正在编辑一个盖放选择，尚未提交。`
    : `席位 ${state.activeSeatIndex + 1} 选择了行动「${action.label}」，尚未执行。`);
  return true;
}

export function chooseBoardGamePlaygroundTarget(state, design, targetId) {
  const legal = legalBoardGameTargets(design, state, state.selectedActionId, state.activeSeatIndex);
  if (!state.selectedActionId || !legal.includes(targetId)) return false;
  state.selectedTargetId = targetId;
  state.lastError = "";
  state.uiStage = "confirm";
  const target = design.engine.map.nodes.find((node) => node.id === targetId);
  pushUiLog(state, phaseFor(design, state)?.mode === "reveal"
    ? "盖放选择的目标已设置，等待确认提交。"
    : `目标已设为「${target?.label || targetId}」，等待确认。`);
  return true;
}

export function confirmBoardGamePlaygroundAction(state, design) {
  if (!state.selectedActionId) return false;
  const result = executeBoardGameAction(design, state, {
    actionId: state.selectedActionId,
    targetId: state.selectedTargetId,
    seatIndex: state.activeSeatIndex
  });
  if (!result.ok) {
    state.lastError = result.message || "行动不能执行。";
    return false;
  }
  Object.assign(state, result.state, {
    selectedActionId: "",
    selectedTargetId: "",
    uiStage: result.phaseResolved ? "resolved" : "command",
    lastError: ""
  });
  return true;
}

export function advanceBoardGamePlaygroundRound(state, design) {
  const result = advanceBoardGameRuntime(design, state);
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

function resourceValue(state, seatIndex, variable) {
  return variable.scope === "player" ? state.playerValues[seatIndex]?.[variable.id] : state.values[variable.id];
}

function actionCards(design, state) {
  return activeActions(design, state).map((action) => {
    const selected = state.selectedActionId === action.id;
    const variable = design.variables.find((item) => item.id === action.resourceKey);
    const value = variable ? resourceValue(state, state.activeSeatIndex, variable) : null;
    const affordable = !action.cost || number(value) >= action.cost;
    return `<button type="button" class="board-play-card ${selected ? "selected" : ""}" data-action="board-play-command" data-board-play-command-id="${escapeHtml(action.id)}" aria-pressed="${selected}" ${state.resolved || state.ended || !affordable ? "disabled" : ""}>
      <span class="board-play-card-cost">${action.cost || "·"}</span><span class="board-play-card-icon">${icon(action.kind)}</span><strong>${escapeHtml(action.label)}</strong><small>${escapeHtml(action.description || ACTION_LABELS[action.kind] || action.kind)}</small><em>${escapeHtml(ACTION_LABELS[action.kind] || action.kind)}</em>
    </button>`;
  }).join("");
}

function mapEdges(design) {
  const nodes = new Map(design.engine.map.nodes.map((node) => [node.id, node]));
  return `<svg class="board-play-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${design.engine.map.edges.map((edge) => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) return "";
    return `<line class="${edge.blocked ? "blocked" : ""}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line>`;
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
    return `<article class="board-play-seat seat-${seatIndex % 8} ${state.activeSeatIndex === seatIndex ? "active" : ""}"><span>${seatIndex + 1}</span><div><strong>${escapeHtml(roles[seatIndex]?.name || `席位 ${seatIndex + 1}`)}</strong><i><b style="width:${progress}%"></b></i></div><em>${score}</em></article>`;
  }).join("");
}

function resources(design, state) {
  return design.variables.map((variable) => `<span><small>${escapeHtml(variable.label)}</small><strong>${escapeHtml(String(resourceValue(state, state.activeSeatIndex, variable) ?? variable.initialValue))}</strong></span>`).join("");
}

function actionRail(design, state) {
  const action = design.engine.actions.find((item) => item.id === state.selectedActionId);
  const target = design.engine.map.nodes.find((item) => item.id === state.selectedTargetId);
  const ready = Boolean(action && (action.target === "none" || target) && state.uiStage === "confirm");
  const phase = phaseFor(design, state);
  return `<aside class="board-play-actions">
    <header><p>当前执行单元</p><h3>${escapeHtml(phase?.label || "未定义阶段")}</h3><span>${phase?.mode === "sequential" ? "顺序行动" : phase?.mode === "reveal" ? "提交后统一公开" : "同时选择"}</span></header>
    <div class="board-play-active-seat"><span class="seat-${state.activeSeatIndex % 8}">${state.activeSeatIndex + 1}</span><div><small>当前提交席位</small><strong>席位 ${state.activeSeatIndex + 1}</strong></div></div>
    <ol>
      <li class="${action ? "done" : "active"}"><span>1</span><div><strong>选择合法行动</strong><small>${action ? escapeHtml(action.label) : "只显示本阶段声明的行动"}</small></div></li>
      <li class="${target || action?.target === "none" ? "done" : action ? "active" : ""}"><span>2</span><div><strong>选择合法目标</strong><small>${action?.target === "none" ? "该行动不需要目标" : target ? escapeHtml(target.label) : "地图仅开放合法区域"}</small></div></li>
      <li class="${state.resolved ? "done" : ready ? "active" : ""}"><span>3</span><div><strong>确认后执行</strong><small>${state.resolved ? "阶段行动已结算" : ready ? "尚未改变状态" : "等待前置选择"}</small></div></li>
    </ol>
    <section class="board-play-pending"><span>待执行</span><strong>${action ? escapeHtml(action.label) : "尚未选择"}${target ? ` → ${escapeHtml(target.label)}` : ""}</strong><p>${escapeHtml(action?.description || "引擎不会代替任何席位选择行动或目标。")}</p><button type="button" class="board-play-confirm" data-action="board-play-confirm" ${ready ? "" : "disabled"}>确认执行</button>${state.lastError ? `<small class="board-play-error">${escapeHtml(state.lastError)}</small>` : ""}</section>
    <div class="board-play-controls"><button type="button" data-action="board-play-reset">${icon("reset")}<span>重置试玩</span></button><button type="button" data-action="board-play-next" ${state.resolved && !state.ended ? "" : "disabled"}>${icon("next")}<span>推进流程</span></button></div>
    <section class="board-play-log"><div><h3>引擎事件</h3><span>${state.log.length} 条</span></div><ul>${state.log.map((entry, index) => `<li class="${escapeHtml(entry.tone)} ${index === 0 ? "latest" : ""}"><i></i><span>${escapeHtml(entry.text)}</span></li>`).join("")}</ul></section>
  </aside>`;
}

function compileSummary(report) {
  const passed = report.tests.filter((test) => test.passed).length;
  return `<div class="board-play-compile"><span class="${report.blocking ? "blocked" : "ready"}">${report.blocking ? "不可运行" : "引擎可运行"}</span><strong>${passed}/${report.tests.length} 结构测试通过</strong><small>${report.engine.map.nodes.length} 区域 · ${report.engine.map.edges.length} 路线 · ${report.engine.actions.length} 行动</small></div>`;
}

export function renderBoardGamePlayground(design, stateValue, roles = []) {
  const report = compileBoardGameEngine(design, roles.length || design.playerCount.min);
  if (report.blocking) {
    const issues = report.issues.filter((item) => item.level === "error").slice(0, 6);
    return `<section class="board-playground-empty"><div class="board-play-engine-blocked"><span>${icon("map")}</span><p class="section-kicker">ENGINE CONTRACT</p><h2>这个原型还不能进行真实试玩</h2><p>请回到组件、条件与计算中亲自补齐区域、路线、阶段和可执行行动。说明文字不会被当成已实现机制。</p><ul>${issues.map((item) => `<li><strong>${escapeHtml(item.code)}</strong><span>${escapeHtml(item.message)}</span></li>`).join("")}</ul></div></section>`;
  }
  const state = normalizeBoardGamePlaygroundState(stateValue, design, roles.length || design.playerCount.min);
  const phase = phaseFor(design, state);
  const capabilityIds = new Set([`map.${design.engine.map.kind}`, `phase.${phase?.mode}`, ...activeActions(design, state).map((action) => `action.${action.kind}`)]);
  return `<section class="board-playground" data-board-playground>
    <header class="board-playground-head"><div><p class="section-kicker">DATA-DRIVEN PLAYTEST</p><h2>可执行试玩台</h2><p>${escapeHtml(design.designGoal || "地图、合法行动与状态结算来自同一份引擎数据。")}</p></div>${compileSummary(report)}</header>
    <div class="board-play-capabilities">${[...capabilityIds].map((id) => { const item = boardGameCapability(id); return `<span class="${item.status}">${escapeHtml(item.label)} · ${escapeHtml(item.status)}</span>`; }).join("")}</div>
    <div class="board-play-layout"><div class="board-play-table">
      <section class="board-play-topbar"><div><small>流程位置</small><strong>第 ${state.round} / ${design.engine.maxRounds} 轮 · ${escapeHtml(phase?.label || "阶段")}</strong></div><div class="board-play-phases">${design.engine.phases.map((item, index) => `<span class="${index === state.phaseIndex ? "active" : ""}">${index + 1}. ${escapeHtml(item.label)}</span>`).join("")}</div><div class="board-play-resources">${resources(design, state)}</div></section>
      <section class="board-play-scoreboard">${seatTracks(design, state, roles)}</section>
      <div class="board-play-map" aria-label="由区域与路线数据生成的桌游地图">${mapEdges(design)}${mapNodes(design, state)}${mapTokens(design, state, roles)}<span class="board-play-map-grid"></span></div>
      <div class="board-play-hand"><div class="board-play-deck" aria-label="当前阶段行动">${icon("mechanism")}<small>${activeActions(design, state).length}</small></div>${actionCards(design, state)}</div>
    </div>${actionRail(design, state)}</div>
  </section>`;
}
