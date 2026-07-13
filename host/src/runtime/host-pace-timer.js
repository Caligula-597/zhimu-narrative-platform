import { collapsibleCard } from "../components/collapse.js";
import { state } from "../state.js";
import { escapeHtml } from "../utils/format.js";

const PACE_TIMER_KEY = "zhimuHostPaceTimerState";
let renderRef = () => {};

export function bindHostPaceTimerContext({ render }) {
  renderRef = render;
}

function formatPaceDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatPaceClock(pace) {
  let elapsed = pace.elapsedMs || 0;
  if (pace.running && pace.startedAt) elapsed += Date.now() - pace.startedAt;
  if (pace.mode === "count-up") return formatPaceDuration(elapsed);
  return formatPaceDuration(Math.max(0, (pace.targetMs || 0) - elapsed));
}

function loadPaceState() {
  try {
    const raw = localStorage.getItem(PACE_TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.running && parsed.startedAt) {
      parsed.elapsedMs = (parsed.elapsedMs || 0) + (Date.now() - parsed.startedAt);
      parsed.startedAt = Date.now();
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePaceState(pace) {
  try {
    localStorage.setItem(PACE_TIMER_KEY, JSON.stringify(pace));
  } catch {
    // The timer remains usable in-memory when storage is unavailable.
  }
}

function initPaceState() {
  const stored = loadPaceState();
  if (stored) {
    state.paceTimer = stored;
    return stored;
  }
  const fresh = {
    mode: "count-up",
    running: false,
    startedAt: null,
    elapsedMs: 0,
    targetMs: 0
  };
  state.paceTimer = fresh;
  savePaceState(fresh);
  return fresh;
}

export function hostPaceTimerCard() {
  const pace = state.paceTimer || initPaceState();
  const modes = [
    { id: "count-up", label: "正计时" },
    { id: "countdown-30", label: "30 分钟", ms: 30 * 60 * 1000 },
    { id: "countdown-45", label: "45 分钟", ms: 45 * 60 * 1000 },
    { id: "countdown-60", label: "60 分钟", ms: 60 * 60 * 1000 }
  ];
  const modeButtons = modes.map((mode) => {
    const active = pace.mode === mode.id ? " is-active" : "";
    return `<button type="button" class="host-pace-mode-btn${active}" data-action="host-pace-switch-mode" data-mode="${mode.id}" data-target-ms="${mode.ms || 0}">${escapeHtml(mode.label)}</button>`;
  }).join("");
  const running = Boolean(pace.running);
  const primaryLabel = running ? "暂停" : pace.elapsedMs > 0 || pace.startedAt ? "继续" : "开始";
  const body = `<div class="host-pace-timer" data-host-pace-timer>
    <div class="host-pace-clock-row">
      <div class="host-pace-clock" data-host-pace-clock>${formatPaceClock(pace)}</div>
      <div class="host-pace-clock-meta">
        <span class="status-chip ${running ? "published" : "draft"}">${running ? "运行中" : "已暂停"}</span>
        <span class="muted-note">${pace.mode === "count-up" ? "正计时模式" : "倒计时模式"}</span>
      </div>
    </div>
    <div class="host-pace-modes">${modeButtons}</div>
    <div class="host-pace-actions">
      <button type="button" class="primary-btn" data-action="host-pace-toggle" data-running="${running ? "1" : "0"}">${primaryLabel}</button>
      <button type="button" class="secondary-btn" data-action="host-pace-reset">重置</button>
    </div>
    <p class="muted-note host-pace-hint">用于把控每幕节奏：开场播报、调查、公聊、复盘。计时器状态保存在本地，不会同步给玩家。</p>
  </div>`;
  return collapsibleCard({
    id: "director:pace-timer",
    title: "节奏计时器",
    subtitle: "把控每幕时长 · 仅供主持人本地使用",
    body,
    defaultOpen: false,
    className: "card host-pace-timer-card",
    style: "margin-top:14px"
  });
}

export function bootstrapPaceTimer() {
  initPaceState();
}

export function togglePaceTimer() {
  const pace = state.paceTimer || initPaceState();
  if (pace.running) {
    if (pace.startedAt) {
      pace.elapsedMs = (pace.elapsedMs || 0) + (Date.now() - pace.startedAt);
      pace.startedAt = null;
    }
    pace.running = false;
  } else {
    pace.startedAt = Date.now();
    pace.running = true;
  }
  state.paceTimer = { ...pace };
  savePaceState(state.paceTimer);
  renderRef();
}

export function resetPaceTimer() {
  const fresh = {
    mode: state.paceTimer?.mode || "count-up",
    running: false,
    startedAt: null,
    elapsedMs: 0,
    targetMs: state.paceTimer?.targetMs || 0
  };
  state.paceTimer = fresh;
  savePaceState(fresh);
  renderRef();
}

export function switchPaceMode(modeId, targetMs = 0) {
  const pace = state.paceTimer || initPaceState();
  state.paceTimer = {
    ...pace,
    mode: modeId,
    targetMs,
    running: false,
    startedAt: null,
    elapsedMs: 0
  };
  savePaceState(state.paceTimer);
  renderRef();
}

export function tickPaceTimer() {
  const pace = state.paceTimer;
  if (!pace) return;
  const element = document.querySelector("[data-host-pace-clock]");
  if (element) element.textContent = formatPaceClock(pace);
}
