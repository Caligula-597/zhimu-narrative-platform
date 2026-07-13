import { escapeHtml } from "../../../shared/security.js";
import { api } from "../api.js";
import { state } from "../state.js";
import { collapsibleCard } from "../components/collapse.js";
import { formatApiError } from "../errors.js";
import { refreshHostMiniGames } from "./data.js";

let renderRef = () => {};
let showToastRef = () => {};

export function bindHostMiniGameContext({ render, showToast }) {
  renderRef = render;
  showToastRef = showToast;
}

export function normalizeHostMiniGame(raw) {
  if (!raw) return null;
  const config = raw.config || raw.public_config || {};
  return {
    ...raw,
    id: raw.id || raw.instanceId || raw.instance_id || "",
    gameType: raw.gameType || raw.game_type || "",
    title: raw.title || config.title || "数字密码锁",
    config,
    status: raw.status || "playing",
    attemptsLeft: raw.attemptsLeft ?? raw.attempts_left ?? null
  };
}

export function creatorMiniGameTemplates(stateRef = state) {
  const templates = stateRef.studio?.world?.settings?.miniGameTemplates;
  return Array.isArray(templates) ? templates : [];
}

function templatePayload(template) {
  const answer = String(template?.answer || "").trim();
  return {
    gameType: "zhimu_lock",
    title: String(template?.title || "数字密码锁").trim(),
    prompt: String(template?.prompt || "请输入线索中得到的密码。").trim(),
    hint: String(template?.hint || "").trim(),
    answer,
    length: Math.max(1, Math.min(12, Number(template?.length || answer.length || 4))),
    maxAttempts: Math.max(1, Math.min(12, Number(template?.maxAttempts || template?.max_attempts || 3)))
  };
}

export function applyHostMiniGameEvent(type, payload, stateRef = state) {
  const incoming = normalizeHostMiniGame(payload?.currentGame || payload?.current_game || payload?.game);
  if (!incoming?.id) return false;
  const existing = (stateRef.cloudHostMiniGames || []).map(normalizeHostMiniGame).filter(Boolean);
  const next = [];
  let replaced = false;
  for (const game of existing) {
    if (game.id === incoming.id) {
      next.push({ ...game, ...incoming });
      replaced = true;
    } else if (type === "room.game_started" && game.status === "playing") {
      next.push({ ...game, status: "success" });
    } else {
      next.push(game);
    }
  }
  if (!replaced) next.unshift(incoming);
  stateRef.cloudHostMiniGames = next;
  return true;
}

function statusLabel(game) {
  if (game.status === "playing") return "进行中";
  if (game.status === "success") return "已完成";
  if (game.status === "fail") return "尝试耗尽";
  return game.status || "未知";
}

export function hostMiniGameCard(stateRef = state) {
  const games = (stateRef.cloudHostMiniGames || []).map(normalizeHostMiniGame).filter(Boolean);
  const active = games.find((game) => game.status === "playing") || null;
  const templates = creatorMiniGameTemplates(stateRef);
  const activeHtml = active
    ? `<article class="host-mini-game-active"><div><span class="status-chip testing">进行中</span><h4>${escapeHtml(active.title)}</h4><p>${escapeHtml(active.config?.prompt || "玩家正在尝试解锁")}</p></div><div class="host-mini-game-runtime"><strong>${escapeHtml(active.attemptsLeft ?? "—")}</strong><small>剩余尝试次数</small><button class="secondary-btn" data-action="host-mini-game-force-complete" data-game-id="${escapeHtml(active.id)}">主持人结束并放行</button></div></article>`
    : `<div class="empty-state">当前没有进行中的小游戏。可从创作者保存的模板中选择一个启动。</div>`;
  const templateHtml = templates.length
    ? templates.map((template) => `<article class="host-mini-game-template"><div><strong>${escapeHtml(template.title || "数字密码锁")}</strong><p>${escapeHtml(template.prompt || "未填写玩家提示")}</p><small>${escapeHtml(template.length || String(template.answer || "").length || 4)} 位 · ${escapeHtml(template.maxAttempts || template.max_attempts || 3)} 次机会</small></div><button class="primary-btn" data-action="host-mini-game-start" data-template-id="${escapeHtml(template.id)}" ${active ? "disabled" : ""}>${active ? "已有游戏进行中" : "同步到玩家端"}</button></article>`).join("")
    : `<div class="empty-state">创作者端尚未保存小游戏模板。请先在“小游戏设计”中建立数字锁。</div>`;
  const history = games.filter((game) => game.id !== active?.id).slice(0, 5);
  const historyHtml = history.length
    ? `<div class="host-mini-game-history">${history.map((game) => `<div><strong>${escapeHtml(game.title)}</strong><span class="status-chip ${game.status === "fail" ? "draft" : "published"}">${escapeHtml(statusLabel(game))}</span></div>`).join("")}</div>`
    : "";
  return collapsibleCard({
    id: "director:mini-games",
    title: "小游戏同步控制",
    subtitle: "创作者模板 → 主持启动 → 玩家实时答题与结果回传",
    headerExtra: `<button class="secondary-btn" data-action="host-mini-game-refresh">刷新状态</button>`,
    body: `${activeHtml}<div class="host-mini-game-templates"><p class="section-kicker">创作者模板</p>${templateHtml}</div>${historyHtml}`,
    defaultOpen: Boolean(active),
    className: "card host-mini-game-card"
  });
}

export function createHostMiniGameActionHandler({ apiRef = api, stateRef = state, render = renderRef, showToast = showToastRef } = {}) {
  return async function handleHostMiniGameAction(action, element) {
    if (action === "host-mini-game-refresh") {
      await refreshHostMiniGames(true);
      return true;
    }
    if (action === "host-mini-game-start") {
      const template = creatorMiniGameTemplates(stateRef).find((item) => String(item.id) === String(element?.dataset?.templateId));
      if (!template) {
        showToast("小游戏模板不存在，请返回创作者端检查");
        return true;
      }
      if (!String(template.answer || "").trim()) {
        showToast("该模板没有答案，无法启动");
        return true;
      }
      try {
        const result = await apiRef.startHostMiniGame(templatePayload(template));
        applyHostMiniGameEvent("room.game_started", result, stateRef);
        render();
        showToast("小游戏已同步到玩家端");
      } catch (error) {
        showToast(formatApiError(error, "小游戏启动失败"));
      }
      return true;
    }
    if (action === "host-mini-game-force-complete") {
      const gameId = element?.dataset?.gameId;
      if (!gameId) return true;
      try {
        const result = await apiRef.forceCompleteHostMiniGame(gameId);
        applyHostMiniGameEvent("room.game_completed", result, stateRef);
        render();
        showToast("小游戏已结束，玩家端已放行");
      } catch (error) {
        showToast(formatApiError(error, "小游戏结束失败"));
      }
      return true;
    }
    return false;
  };
}
