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

function isParallelPhase() {
  return ["simultaneous", "reveal"].includes(phase()?.mode);
}

function rulebook() {
  return catalog().rulebook || {};
}

function renderPublicFeed() {
  const current = publicState() || {};
  const responseEvents = Array.isArray(current.responseEvents) ? current.responseEvents.slice(0, 5) : [];
  const logs = Array.isArray(current.log) ? current.log.slice(0, 5) : [];
  const items = responseEvents.length
    ? responseEvents.map((event) => `<li class="board-player-feed-item is-${escapeHtml(event.status || "applied")}"><span>${escapeHtml(event.sourceLabel || event.sourceId || "规则响应")}</span><strong>${escapeHtml(event.detail || `${event.targetKey || "状态"} ${event.operation || "更新"}`)}</strong></li>`)
    : logs.map((entry) => `<li class="board-player-feed-item"><span>${escapeHtml(entry.tone || "记录")}</span><strong>${escapeHtml(entry.text || "桌面状态已更新")}</strong></li>`);
  return `<section class="board-player-panel board-player-feed"><div class="board-player-panel-head"><div><span class="eyebrow">LIVE TABLE FEED</span><h2>桌面刚刚发生</h2><p>公开结算、卡牌响应和流程推进会出现在这里。</p></div><span class="board-player-sync">${items.length ? `${items.length} 条更新` : "等待首个结算"}</span></div>${items.length ? `<ol>${items.join("")}</ol>` : `<div class="board-player-feed-empty">第一条公开结算出现后，会在这里显示“谁触发了什么效果”。</div>`}</section>`;
}

function phaseIcon(value) {
  const text = `${value?.id || ""} ${value?.label || ""}`.toLowerCase();
  if (/航|route|move|travel/.test(text)) return "↗";
  if (/建设|build|construct|工坊/.test(text)) return "⌂";
  if (/资源|远征|research|trade|market/.test(text)) return "✦";
  if (/战|combat|attack/.test(text)) return "⚔";
  return "●";
}

function actionIcon(action) {
  const kind = String(action?.kind || "").toLowerCase();
  if (kind === "move") return "↗";
  if (["gain", "draw", "draft"].includes(kind)) return "＋";
  if (["control", "place"].includes(kind)) return "⌂";
  if (["mechanism", "play"].includes(kind)) return "✦";
  if (["roll", "bid"].includes(kind)) return "◈";
  return "—";
}

function renderRules() {
  const book = rulebook();
  const phases = catalog().phases || [];
  const title = catalog().title || state.home?.room?.name || "线上桌游";
  const componentCount = (catalog().components || []).reduce((sum, component) => sum + (Number(component.quantity) || 1), 0);
  const study = catalog().commercialStudy;
  return `<section class="board-player-rules"><div class="board-player-rules-head"><div><span class="eyebrow">HOW TO PLAY</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(catalog().designGoal || "先读懂目标、回合结构和结算条件，再开始行动。")}</p>${study ? `<div class="board-player-study-line"><span>商业机制研究适配</span><strong>${escapeHtml(study.sourceGame)}</strong><small>${escapeHtml(study.family)}</small></div>` : ""}</div><div class="board-player-rule-stats"><span><strong>${Number(catalog().playerCount?.min) || 1}—${Number(catalog().playerCount?.max) || 1}</strong>人</span><span><strong>${Number(catalog().playTimeMinutes) || "—"}</strong>分钟</span><span><strong>${componentCount}</strong>件组件</span></div></div><div class="board-player-rule-columns"><article><span class="board-player-rule-label">获胜目标</span><p>${escapeHtml(book.objective || "按规则完成终局结算。")}</p></article><article><span class="board-player-rule-label">开局准备</span><p>${escapeHtml(book.setup || "等待牌局初始化。")}</p></article><article><span class="board-player-rule-label">一轮怎么走</span><p>${escapeHtml(book.turnStructure || "按当前流程依次完成行动。")}</p></article><article><span class="board-player-rule-label">结束与胜负</span><p>${escapeHtml(book.endCondition || "满足终局条件后结算分数。")}</p></article></div><div class="board-player-phase-rail">${phases.map((item, index) => `<div class="board-player-phase-step ${item.id === phase()?.id ? "is-current" : index < Number(publicState()?.phaseIndex || 0) ? "is-done" : ""}"><span>${phaseIcon(item)}</span><div><strong>${index + 1}. ${escapeHtml(item.label || item.id)}</strong><small>${escapeHtml(item.description || (item.mode === "simultaneous" ? "同时选择，统一结算" : "按席位行动"))}</small></div></div>`).join("")}</div><details class="board-player-rules-details"><summary>查看完整规则说明</summary><div><p><strong>玩家行动：</strong>${escapeHtml(book.playerActions || "按行动卡说明执行。")}</p><p><strong>平局处理：</strong>${escapeHtml(book.tieBreak || "按规则中的次级指标处理。")}</p><p><strong>线上提示：</strong>每次操作都会由服务器校验并同步；倒计时结束时，系统会执行该阶段的默认处理。</p></div></details></section>`;
}

function renderResources() {
  const current = publicState() || {};
  const seatIndex = Number(viewer()?.seatIndex);
  const values = current.playerValues?.[seatIndex] || {};
  const variables = (catalog().variables || []).filter((variable) => variable.scope === "player");
  if (!variables.length) return "";
  return `<section class="board-player-resource-panel"><div class="board-player-panel-head"><div><span class="eyebrow">YOUR ECONOMY</span><h2>资源面板</h2></div><span class="board-player-private-badge">席位 ${seatIndex + 1}</span></div><div class="board-player-resource-grid">${variables.map((variable) => { const value = Number(values[variable.id] ?? 0); const max = Number(variable.max) > Number(variable.min) ? Number(variable.max) : Math.max(value, 1); const percent = Math.max(0, Math.min(100, (value - Number(variable.min || 0)) / (max - Number(variable.min || 0)) * 100)); return `<div class="board-player-resource"><div><span>${escapeHtml(variable.label)}</span><strong>${Number.isFinite(value) ? value : 0}</strong></div><div class="board-player-resource-track"><i style="width:${percent}%"></i></div></div>`; }).join("")}</div></section>`;
}

function secondsLeft() {
  const deadlineAt = Number(runtime()?.snapshot?.deadline?.deadlineAt);
  return Number.isFinite(deadlineAt) ? Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000)) : 0;
}

function targetOptions(action) {
  const current = publicState() || {};
  const kind = action?.target || "none";
  if (kind === "market_card" || (action?.kind === "draft" && action?.draftMode !== "hand")) {
    return (current.market || []).map((card) => ({ id: card.id, label: card.name || card.id }));
  }
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
  const parallel = isParallelPhase();
  const alreadySubmitted = Boolean(current?.submissions?.[String(ownSeat)]?.submitted);
  const isPublicDraft = action.kind === "draft" && action.draftMode !== "hand";
  const cardPool = isPublicDraft ? (current?.market || []) : (viewer()?.hand || []);
  const requiresCard = ["play", "draft"].includes(action.kind);
  const canAct = (parallel ? !alreadySubmitted : ownSeat === current?.activeSeatIndex)
    && (!current.pendingResponseWindow || current.pendingResponseWindow.eligibleSeatIndexes?.includes(ownSeat));
  const blocked = !canAct || state.boardGameCommandBusy || current?.ended || (requiresCard && !cardPool.length);
  const cardPicker = requiresCard && cardPool.length
    ? `<label class="board-player-control"><span>${isPublicDraft ? "公共模块" : "手牌"}</span><select data-board-game-card>${cardPool.map((card) => `<option value="${escapeHtml(card.id)}">${escapeHtml(card.name || card.id)}</option>`).join("")}</select></label>`
    : "";
  const cardHint = requiresCard && !cardPool.length
    ? `<small class="board-player-muted">${isPublicDraft ? "公共市场暂时没有可选模块。" : "当前没有可用手牌。"}</small>`
    : "";
  return `<article class="board-player-action-card ${response ? "is-response" : ""}">
    <div class="board-player-action-title"><span class="board-player-action-icon">${actionIcon(action)}</span><div><span class="board-player-action-kind">${escapeHtml(response ? "响应" : action.kind || "行动")}</span><h3>${escapeHtml(action.label || action.id)}</h3></div></div><p>${escapeHtml(action.description || "执行这项行动，结算结果会同步给全桌。")}</p>
    ${renderTarget(action)}
    ${cardPicker}
    ${cardHint}
    ${action.kind === "bid" ? `<label class="board-player-control"><span>出价</span><input type="number" min="0" max="999999" value="0" data-board-game-bid></label>` : ""}
    <button type="button" class="btn primary board-player-submit" data-action="board-game-submit" data-board-game-action-id="${escapeHtml(action.id)}" ${blocked ? "disabled" : ""}>${response ? "提交响应" : "执行行动"}</button>
  </article>`;
}

function renderCardFace(card, extraClass = "") {
  const face = card?.cardFace || {};
  return `<article class="board-player-card ${extraClass} board-player-card-face accent-${escapeHtml(face.accent || "ember")}">
    <div class="board-player-card-art"><span class="board-player-card-icon">${escapeHtml(face.icon || "✦")}</span><small>${escapeHtml(face.eyebrow || "原创牌面")}</small></div>
    <strong>${escapeHtml(card?.name || card?.id || "未命名牌")}</strong>
    <p>${escapeHtml(face.rulesText || card?.description || "按当前牌面与行动说明执行。")}</p>
    <span class="board-player-card-effect">${escapeHtml(face.effectText || "效果：按牌面说明结算。")}</span>
  </article>`;
}

function renderMarket() {
  const market = publicState()?.market || [];
  if (!market.length) return "";
  return `<section class="board-player-panel board-player-market"><div class="board-player-panel-head"><div><span class="eyebrow">PUBLIC MARKET</span><h2>城市模块市场</h2><p>所有席位同时选择；同一张卡发生冲突时，重新选择。</p></div><span class="board-player-market-count">${market.length} 张公开卡</span></div><div class="board-player-market-grid">${market.map((card, index) => `<article class="board-player-market-card"><span class="board-player-market-index">${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(card.name || card.id)}</strong><small>${escapeHtml(card.description || "公开模块")}</small>${Array.isArray(card.tags) && card.tags.length ? `<em>${escapeHtml(card.tags.join(" · "))}</em>` : ""}</div></article>`).join("")}</div></section>`;
}

function renderPublicBoard() {
  const current = publicState() || {};
  const nodes = Object.keys(current.owners || {});
  const mapNodes = catalog().nodes || [];
  const mapEdges = catalog().edges || [];
  const nodeById = new Map(mapNodes.map((node) => [node.id, node]));
  return `<section class="board-player-panel board-player-map"><div class="board-player-panel-head"><div><span class="eyebrow">PUBLIC BOARD</span><h2>公共桌面</h2><p>地图、路线和席位控制权对全桌公开。</p></div><span class="board-player-sync">修订 ${Number(runtime()?.snapshot?.revision) || 0}</span></div><div class="board-player-board-visual"><svg viewBox="0 0 100 100" role="img" aria-label="公共地图">${mapEdges.map((edge) => { const from = nodeById.get(edge.from); const to = nodeById.get(edge.to); return from && to ? `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />` : ""; }).join("")}${mapNodes.map((node) => { const owner = current.owners?.[node.id]; return `<g class="board-player-map-node ${owner == null ? "" : "is-owned"}" transform="translate(${node.x} ${node.y})"><circle r="5"></circle><text y="10">${escapeHtml(node.label)}</text><text y="-8" class="board-player-map-owner">${owner == null ? "开放" : `席位${Number(owner) + 1}`}</text></g>`; }).join("")}</svg></div><div class="board-player-board-legend"><span><i class="is-open"></i>开放区域</span><span><i class="is-owned"></i>已控制</span><span>${mapNodes.length || nodes.length} 个可见区域</span></div></section>`;
}

function renderScoreboard() {
  const current = publicState() || {};
  const ownSeat = viewer()?.seatIndex;
  const scores = Array.isArray(current.scores) ? current.scores : [];
  const scoreVariable = (catalog().variables || []).find((variable) => variable.id === "score")?.id || "score";
  const visibleScores = Array.from({ length: Number(current.seatCount) || scores.length || 0 }, (_, index) => Number(current.playerValues?.[index]?.[scoreVariable] ?? scores[index] ?? 0));
  const highScore = visibleScores.length ? Math.max(...visibleScores) : 0;
  const leaders = visibleScores.map((score, index) => score === highScore ? index + 1 : null).filter(Boolean);
  const winner = current.ended && leaders.length ? `<div class="board-player-winner"><span>终局结果</span><strong>${leaders.length === 1 ? `席位 ${leaders[0]} 获胜` : `席位 ${leaders.join("、")} 并列获胜`}</strong></div>` : "";
  return `<section class="board-player-panel"><div class="board-player-panel-head"><div><span class="eyebrow">TABLE STATUS</span><h2>全桌状态</h2>${winner}</div><span class="board-player-turn">当前席位 ${Number(current.activeSeatIndex) + 1}</span></div><div class="board-player-score-grid">${visibleScores.map((score, index) => `<div class="board-player-score ${index === ownSeat ? "is-self" : ""} ${index + 1 === leaders[0] && current.ended ? "is-winner" : ""} ${index === current.activeSeatIndex ? "is-active" : ""}"><span>席位 ${index + 1}</span><strong>${score}</strong><small>${index === ownSeat ? "你的席位" : current.ended && leaders.includes(index + 1) ? "获胜席位" : index === current.activeSeatIndex ? "正在行动" : "等待中"}</small></div>`).join("")}</div></section>`;
}

function renderPrivatePanel() {
  const own = viewer();
  return `<section class="board-player-panel board-player-private"><div class="board-player-panel-head"><div><span class="eyebrow">PRIVATE ZONE</span><h2>你的区域</h2></div><span class="board-player-private-badge">仅你可见</span></div><div class="board-player-cards"><div><small>手牌 ${own?.hand?.length || 0}</small>${(own?.hand || []).map((card) => renderCardFace(card)).join("") || `<p class="board-player-muted">当前没有手牌。</p>`}</div><div><small>面板 ${own?.tableau?.length || 0}</small>${(own?.tableau || []).map((card) => renderCardFace(card, "is-tableau")).join("") || `<p class="board-player-muted">当前没有已部署牌。</p>`}</div></div></section>`;
}

function renderActionPanel() {
  const current = publicState() || {};
  const ownSeat = viewer()?.seatIndex;
  const pending = current.pendingResponseWindow;
  const parallel = isParallelPhase();
  const responseEligible = pending?.eligibleSeatIndexes?.includes(ownSeat);
  const ids = pending && responseEligible
    ? pending.actionIds || []
    : (!pending && (parallel || ownSeat === current.activeSeatIndex) ? phase()?.actionIds || [] : []);
  const actions = ids.map(actionById).filter(Boolean);
  const waiting = pending ? (responseEligible ? `等待你在 ${secondsLeft()} 秒内响应` : `席位 ${Number(current.activeSeatIndex) + 1} 正在处理响应`) : parallel ? "同时选择阶段：每个席位各自提交一次，之后统一公开" : ownSeat === current.activeSeatIndex ? "轮到你选择行动" : `等待席位 ${Number(current.activeSeatIndex) + 1}`;
  const advance = current.resolved && !current.ended ? `<button type="button" class="btn quiet board-player-advance" data-action="board-game-advance">推进到下一流程</button>` : "";
  const timeout = secondsLeft() === 0 && !current.resolved
    ? `<button type="button" class="btn quiet board-player-advance" data-action="board-game-timeout">${pending ? "提交超时默认处理" : "结束等待并执行默认行动"}</button>`
    : "";
  return `<section class="board-player-panel board-player-actions"><div class="board-player-panel-head"><div><span class="eyebrow">YOUR ACTIONS</span><h2>${escapeHtml(phase()?.label || "行动阶段")}</h2><p>${escapeHtml(waiting)}</p></div><span class="board-player-deadline ${secondsLeft() && secondsLeft() <= 5 ? "is-urgent" : ""}">${secondsLeft() ? `${secondsLeft()}s` : "同步中"}</span></div>${actions.length ? `<div class="board-player-action-grid">${actions.map((action) => renderActionCard(action, { response: Boolean(pending) })).join("")}</div>` : `<div class="board-player-waiting"><strong>${current.ended ? "本局已结束" : "现在还不是你的操作窗口"}</strong><p>状态会通过房间同步自动更新，不需要刷新页面。</p></div>`}${advance}${timeout}</section>`;
}

export function renderBoardGamePlayer() {
  const value = runtime();
  if (!value?.snapshot) {
    return `<section class="board-player-shell"><div class="board-player-empty"><span class="eyebrow">BOARD GAME TABLE</span><h1>桌游牌桌</h1><p>${escapeHtml(state.boardGameRuntimeError || "正在读取桌游运行态…")}</p><div class="board-player-loader"></div></div></section>`;
  }
  const current = publicState() || {};
  return `<section class="board-player-shell"><header class="board-player-header"><div><span class="eyebrow">ONLINE BOARD GAME · SEAT ${Number(viewer()?.seatIndex) + 1}</span><h1>${escapeHtml(state.home?.room?.name || "实时桌游牌桌")}</h1><p>先看规则与当前阶段，再从行动卡选择；所有结算由服务器确认后同步给全桌。</p></div><div class="board-player-header-meta"><span>第 ${Number(current.round) || 1} 轮</span><span>${escapeHtml(phase()?.label || "等待阶段")}</span><span class="${state.roomEventsConnected ? "is-live" : ""}">${state.roomEventsConnected ? "实时同步" : "状态恢复中"}</span></div></header>${renderRules()}<div class="board-player-grid">${renderScoreboard()}${renderResources()}${renderPrivatePanel()}${renderMarket()}${renderPublicBoard()}${renderPublicFeed()}${renderActionPanel()}</div></section>`;
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
