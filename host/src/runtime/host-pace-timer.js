import { collapsibleCard } from "../components/collapse.js";
import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { state } from "../state.js";
import { escapeHtml } from "../utils/format.js";

let renderRef = () => {};
let showToastRef = () => {};
let pending = false;

export function bindHostPaceTimerContext({ render, showToast }) {
  renderRef = render;
  showToastRef = showToast || (() => {});
}

function emptyPaceState() {
  return {
    mode: "countup",
    status: "idle",
    label: "本幕节奏",
    durationMs: 0,
    elapsedMs: 0,
    visibleToPlayers: false,
    revision: 0,
    _receivedAt: Date.now(),
  };
}

function effectiveElapsed(pace, now = Date.now()) {
  const base = Math.max(0, Number(pace?.elapsedMs) || 0);
  if (pace?.status !== "running") return base;
  return base + Math.max(0, now - Number(pace?._receivedAt || now));
}

function formatPaceDuration(ms) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatPaceClock(pace, now = Date.now()) {
  const elapsed = effectiveElapsed(pace, now);
  return pace?.mode === "countdown"
    ? formatPaceDuration(Math.max(0, Number(pace.durationMs) - elapsed))
    : formatPaceDuration(elapsed);
}

function applyClock(clock) {
  state.paceTimer = clock ? { ...clock, _receivedAt: Date.now() } : null;
}

async function mutateClock(action, payload = {}) {
  if (pending) return null;
  const pace = state.paceTimer || emptyPaceState();
  pending = true;
  try {
    const response = await api.updateHostPaceClock({
      action,
      expectedRevision: Number(pace.revision) || 0,
      ...payload,
    });
    applyClock(response?.clock);
    renderRef();
    return state.paceTimer;
  } catch (error) {
    try {
      applyClock((await api.getHostPaceClock())?.clock);
    } catch {
      // Keep the last confirmed projection; SSE/poll recovery will retry.
    }
    showToastRef(formatApiError(error, "节奏计时器同步失败"));
    renderRef();
    return null;
  } finally {
    pending = false;
  }
}

export function hostPaceTimerCard() {
  const pace = state.paceTimer || emptyPaceState();
  const modes = [
    { id: "countup", label: "正计时", ms: 0 },
    { id: "countdown", label: "30 分钟", ms: 30 * 60 * 1000 },
    { id: "countdown", label: "45 分钟", ms: 45 * 60 * 1000 },
    { id: "countdown", label: "60 分钟", ms: 60 * 60 * 1000 },
  ];
  const modeButtons = modes.map((mode) => {
    const active = pace.mode === mode.id && Number(pace.durationMs) === mode.ms ? " is-active" : "";
    return `<button type="button" class="host-pace-mode-btn${active}" data-action="host-pace-switch-mode" data-mode="${mode.id}" data-target-ms="${mode.ms}" ${pending ? "disabled" : ""}>${escapeHtml(mode.label)}</button>`;
  }).join("");
  const running = pace.status === "running";
  const primaryLabel = running ? "暂停" : pace.elapsedMs > 0 ? "继续" : "开始";
  const body = `<div class="host-pace-timer" data-host-pace-timer>
    <div class="host-pace-clock-row">
      <div class="host-pace-clock" data-host-pace-clock>${formatPaceClock(pace)}</div>
      <div class="host-pace-clock-meta">
        <span class="status-chip ${running ? "published" : pace.status === "completed" ? "blocked" : "draft"}">${running ? "运行中" : pace.status === "completed" ? "已到时" : pace.status === "paused" ? "已暂停" : "待开始"}</span>
        <span class="muted-note">${pace.mode === "countup" ? "正计时模式" : "倒计时模式"} · R${Number(pace.revision) || 0}</span>
      </div>
    </div>
    <div class="host-pace-modes">${modeButtons}</div>
    <div class="host-pace-actions">
      <button type="button" class="primary-btn" data-action="host-pace-toggle" ${pending || pace.status === "completed" ? "disabled" : ""}>${primaryLabel}</button>
      <button type="button" class="secondary-btn" data-action="host-pace-reset" ${pending ? "disabled" : ""}>重置</button>
      ${pace.mode === "countdown" ? `<button type="button" class="secondary-btn" data-action="host-pace-extend" data-extend-ms="300000" ${pending ? "disabled" : ""}>延长 5 分钟</button>` : ""}
      <button type="button" class="secondary-btn" data-action="host-pace-visibility" data-visible="${pace.visibleToPlayers ? "0" : "1"}" ${pending ? "disabled" : ""}>${pace.visibleToPlayers ? "对玩家隐藏" : "向玩家公开"}</button>
    </div>
    <p class="muted-note host-pace-hint">房间级权威时钟：主持、协主持与玩家端从同一服务端时间锚点恢复；未公开时玩家不会收到时钟内容。</p>
  </div>`;
  return collapsibleCard({
    id: "director:pace-timer",
    title: "节奏计时器",
    subtitle: "跨设备同步 · 可选择向玩家公开",
    body,
    defaultOpen: false,
    className: "card host-pace-timer-card",
    style: "margin-top:14px",
  });
}

export function bootstrapPaceTimer() {
  state.paceTimer ||= emptyPaceState();
}

export async function togglePaceTimer() {
  const pace = state.paceTimer || emptyPaceState();
  return mutateClock(pace.status === "running" ? "pause" : "start");
}

export async function resetPaceTimer() {
  return mutateClock("reset");
}

export async function switchPaceMode(mode, durationMs = 0) {
  return mutateClock("configure", {
    mode: mode === "countdown" ? "countdown" : "countup",
    durationMs: mode === "countdown" ? Number(durationMs) || 0 : 0,
  });
}

export async function extendPaceTimer(extendMs) {
  return mutateClock("extend", { extendMs: Number(extendMs) || 0 });
}

export async function setPaceTimerVisibility(visibleToPlayers) {
  return mutateClock("set_visibility", { visibleToPlayers: Boolean(visibleToPlayers) });
}

export function tickPaceTimer() {
  const pace = state.paceTimer;
  if (!pace) return;
  const element = document.querySelector("[data-host-pace-clock]");
  if (element) element.textContent = formatPaceClock(pace);
}
