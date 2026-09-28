import "./board-game-player.css";
import { escapeHtml } from "../../../shared/security.js";
import { createBoardGameOnlineCommand } from "../../../shared/board-game-online-runtime.js";
import { state } from "../state.js";

function runtime() {
  return state.boardGameRuntime || null;
}

function publicState() {
  return runtime()?.snapshot?.publicState || null;
}

function catalog() {
  return runtime()?.snapshot?.catalog || { phases: [], actions: [], nodes: [] };
}

function viewer() {
  return runtime()?.viewerState?.viewer || null;
}

function actionById(id) {
  return catalog().actions.find((action) => action.id === id) || null;
}

function phase() {
  const current = publicState();
  return catalog().phases[current?.phaseIndex || 0] || null;
}

function secondsLeft() {
  const deadlineAt = Number(runtime()?.snapshot?.deadline?.deadlineAt);
  return Number.isFinite(deadlineAt) ? Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000)) : 0;
}

function targetOptions(action) {
  const current = publicState() || {};
  const kind = action?.target || "none";
  if (kind === "none") return [];
  if (["opponent_seat", "player_seat"].includes(kind)) {
    return Array.from({ length: Number(current.seatCount) || 0 }, (_, index) => ({
      id: String(index),
      label: `席位 ${index + 1}${index === viewer()?.seatIndex ? "（我）" : ""}`
    })).filter((item) => kind !== "opponent_seat" || item.id !== String(viewer()?.seatIndex));
  }
  if (kind === "card") return (viewer()?.hand || []).map((card) => ({ id: card.id, label: card.name || card.id }));
  if (kind === "route" || kind === "edge") {
    return catalog().edges.map((edge) => ({ id: edge.id, label: edge.label || edge.id }));
  }
  return Object.keys(current.owners || {}).map((id) => {
    const node = catalog().nodes.find((candidate) => candidate.id === id);
    return { id, label: node?.label || id };
  });
}

function renderTarget(action) {
  const options = targetOptions(action);
  if (!options.length) return action?.target === "none" ? "" : `<small class="board-player-muted">当前没有可选目标，提交后由服务器校验。</small>`;
  return `<label class="board-player-control"><span>目标</span><select data-board-game-target>${options.map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`).join("")}</select></label>`;
}

function renderActionCard(action, { response = false } = {}) {
  const current = publicState();
  const ownSeat = viewer()?.seatIndex;
  const simultaneous = phase()?.mode === "simultaneous";
  const alreadySubmitted = Boolean(current?.submissions?.[String(ownSeat)]?.submitted);
  const canAct = (simultaneous ? !alreadySubmitted : ownSeat === current?.activeSeatIndex)
    && (!current.pendingResponseWindow || current.pendingResponseWindow.eligibleSeatIndexes?.includes(ownSeat));
  const blocked = !canAct || state.boardGameCommandBusy || current?.ended;
  const cardPicker = ["play", "draft"].includes(action.kind) && viewer()?.hand?.length
    ? `<label class="board-player-control"><span>牌</span><select data-board-game-card>${viewer().hand.map((card) => `<option value="${escapeHtml(card.id)}">${escapeHtml(card.name || card.id)}</option>`).join("")}</select></label>`
    : "";
  return `<article class="board-player-action-card ${response ? "is-response" : ""}">
    <div><span class="board-player-action-kind">${escapeHtml(response ? "响应" : action.kind || "行动")}</span><h3>${escapeHtml(action.label || action.id)}</h3><p>${escapeHtml(action.description || "执行这项行动，结算结果会同步给全桌。")}</p></div>
    ${renderTarget(action)}
    ${cardPicker}
    ${action.kind === "bid" ? `<label class="board-player-control"><span>出价</span><input type="number" min="0" max="999999" value="0" data-board-game-bid></label>` : ""}
    <button type="button" class="btn primary board-player-submit" data-action="board-game-submit" data-board-game-action-id="${escapeHtml(action.id)}" ${blocked ? "disabled" : ""}>${response ? "提交响应" : "执行行动"}</button>
  </article>`;
}

function renderPublicBoard() {
  const current = publicState() || {};
  const nodes = Object.keys(current.owners || {});
  return `<section class="board-player-panel board-player-map"><div class="board-player-panel-head"><div><span class="eyebrow">PUBLIC BOARD</span><h2>公共桌面</h2></div><span class="board-player-sync">修订 ${Number(runtime()?.snapshot?.revision) || 0}</span></div><div class="board-player-node-grid">${nodes.length ? nodes.map((id) => {
    const node = catalog().nodes.find((candidate) => candidate.id === id);
    const owner = current.owners[id];
    return `<div class="board-player-node"><strong>${escapeHtml(node?.label || id)}</strong><span>${owner == null ? "未占领" : `席位 ${Number(owner) + 1}`}</span></div>`;
  }).join("") : `<p class="board-player-muted">当前设计没有公开区域。</p>`}</div></section>`;
}

function renderScoreboard() {
  const current = publicState() || {};
  const ownSeat = viewer()?.seatIndex;
  const scores = Array.isArray(current.scores) ? current.scores : [];
  return `<section class="board-player-panel"><div class="board-player-panel-head"><div><span class="eyebrow">TABLE STATUS</span><h2>全桌状态</h2></div><span class="board-player-turn">当前席位 ${Number(current.activeSeatIndex) + 1}</span></div><div class="board-player-score-grid">${scores.map((score, index) => `<div class="board-player-score ${index === ownSeat ? "is-self" : ""} ${index === current.activeSeatIndex ? "is-active" : ""}"><span>席位 ${index + 1}</span><strong>${Number(score) || 0}</strong><small>${index === ownSeat ? "你的席位" : index === current.activeSeatIndex ? "正在行动" : "等待中"}</small></div>`).join("")}</div></section>`;
}

function renderPrivatePanel() {
  const own = viewer();
  return `<section class="board-player-panel board-player-private"><div class="board-player-panel-head"><div><span class="eyebrow">PRIVATE ZONE</span><h2>你的区域</h2></div><span class="board-player-private-badge">仅你可见</span></div><div class="board-player-cards"><div><small>手牌 ${own?.hand?.length || 0}</small>${(own?.hand || []).map((card) => `<article class="board-player-card"><strong>${escapeHtml(card.name || card.id)}</strong><p>${escapeHtml(card.description || "")}</p></article>`).join("") || `<p class="board-player-muted">当前没有手牌。</p>`}</div><div><small>面板 ${own?.tableau?.length || 0}</small>${(own?.tableau || []).map((card) => `<article class="board-player-card is-tableau"><strong>${escapeHtml(card.name || card.id)}</strong><p>${escapeHtml(card.description || "")}</p></article>`).join("") || `<p class="board-player-muted">当前没有已部署牌。</p>`}</div></div></section>`;
}

function renderActionPanel() {
  const current = publicState() || {};
  const ownSeat = viewer()?.seatIndex;
  const pending = current.pendingResponseWindow;
  const responseEligible = pending?.eligibleSeatIndexes?.includes(ownSeat);
  const ids = pending && responseEligible
    ? pending.actionIds || []
    : (!pending && ownSeat === current.activeSeatIndex ? phase()?.actionIds || [] : []);
  const actions = ids.map(actionById).filter(Boolean);
  const simultaneous = phase()?.mode === "simultaneous";
  const waiting = pending ? (responseEligible ? `等待你在 ${secondsLeft()} 秒内响应` : `席位 ${Number(current.activeSeatIndex) + 1} 正在处理响应`) : simultaneous ? "同时行动阶段：每个席位各自提交一次" : ownSeat === current.activeSeatIndex ? "轮到你选择行动" : `等待席位 ${Number(current.activeSeatIndex) + 1}`;
  const advance = current.resolved && !current.ended ? `<button type="button" class="btn quiet board-player-advance" data-action="board-game-advance">推进到下一流程</button>` : "";
  const timeout = pending && secondsLeft() === 0 ? `<button type="button" class="btn quiet board-player-advance" data-action="board-game-timeout">提交超时默认处理</button>` : "";
  return `<section class="board-player-panel board-player-actions"><div class="board-player-panel-head"><div><span class="eyebrow">YOUR ACTIONS</span><h2>${escapeHtml(phase()?.label || "行动阶段")}</h2><p>${escapeHtml(waiting)}</p></div><span class="board-player-deadline">${secondsLeft() ? `${secondsLeft()}s` : "同步中"}</span></div>${actions.length ? `<div class="board-player-action-grid">${actions.map((action) => renderActionCard(action, { response: Boolean(pending) })).join("")}</div>` : `<div class="board-player-waiting"><strong>${current.ended ? "本局已结束" : "现在还不是你的操作窗口"}</strong><p>状态会通过房间同步自动更新，不需要刷新页面。</p></div>`}${advance}${timeout}</section>`;
}

export function renderBoardGamePlayer() {
  const value = runtime();
  if (!value?.snapshot) {
    return `<section class="board-player-shell"><div class="board-player-empty"><span class="eyebrow">BOARD GAME TABLE</span><h1>桌游牌桌</h1><p>${escapeHtml(state.boardGameRuntimeError || "正在读取桌游运行态…")}</p><div class="board-player-loader"></div></div></section>`;
  }
  const current = publicState() || {};
  return `<section class="board-player-shell"><header class="board-player-header"><div><span class="eyebrow">ONLINE BOARD GAME · SEAT ${Number(viewer()?.seatIndex) + 1}</span><h1>${escapeHtml(state.home?.room?.name || "实时桌游牌桌")}</h1><p>剧本杀、跑团、桌游各自使用独立玩家界面。你的手牌与派系信息只在本席位显示。</p></div><div class="board-player-header-meta"><span>第 ${Number(current.round) || 1} 轮</span><span>${escapeHtml(phase()?.label || "等待阶段")}</span><span class="${state.roomEventsConnected ? "is-live" : ""}">${state.roomEventsConnected ? "实时同步" : "轮询恢复"}</span></div></header><div class="board-player-grid">${renderScoreboard()}${renderPrivatePanel()}${renderPublicBoard()}${renderActionPanel()}</div></section>`;
}

export function buildBoardGameCommand(button, form) {
  const current = publicState();
  const actionId = button?.dataset?.boardGameActionId || "";
  const commandType = button?.dataset?.boardGameCommandType || "action";
  if ((commandType === "action" && !actionId) || !current || !runtime()?.snapshot?.designSignature) return null;
  return createBoardGameOnlineCommand({ engine: {}, variables: [], mechanisms: [] }, {
    commandId: globalThis.crypto?.randomUUID?.() || `board-command-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    clientSequence: Number(runtime()?.snapshot?.revision || 0) + 1,
    designSignature: runtime().snapshot.designSignature,
    commandType,
    seatIndex: Number(viewer()?.seatIndex || 0),
    actionId,
    targetId: form?.querySelector("[data-board-game-target]")?.value || "",
    cardId: form?.querySelector("[data-board-game-card]")?.value || "",
    bidAmount: Number(form?.querySelector("[data-board-game-bid]")?.value || 0)
  });
}
