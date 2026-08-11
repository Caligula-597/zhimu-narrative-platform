import { escapeHtml } from "../../../shared/security.js";

function effectiveElapsed(clock, now = Date.now()) {
  const stored = Math.max(0, Number(clock?.elapsedMs) || 0);
  if (clock?.status !== "running") return stored;
  return stored + Math.max(0, now - Number(clock?._receivedAt || now));
}

function durationLabel(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours ? `${pad(hours)}:${pad(minutes)}:${pad(remainder)}` : `${pad(minutes)}:${pad(remainder)}`;
}

export function formatPlayerPaceClock(clock, now = Date.now()) {
  const elapsed = effectiveElapsed(clock, now);
  const value = clock?.mode === "countdown"
    ? Math.max(0, Number(clock.durationMs) - elapsed)
    : elapsed;
  return durationLabel(value);
}

export function renderPlayerPaceClock(clock) {
  if (!clock?.visibleToPlayers) return "";
  const status = {
    running: "进行中",
    paused: "主持人已暂停",
    completed: "时间到",
    idle: "等待开始",
  }[clock.status] || "等待同步";
  return `<section class="player-pace-clock is-${escapeHtml(clock.status)}" role="timer" aria-live="off" aria-label="主持节奏计时器">
    <div><span>${escapeHtml(clock.label || "本幕节奏")}</span><strong data-player-pace-clock>${formatPlayerPaceClock(clock)}</strong></div>
    <small>${escapeHtml(status)} · ${clock.mode === "countdown" ? "倒计时" : "正计时"}</small>
  </section>`;
}

export function tickPlayerPaceClock(clock) {
  if (!clock?.visibleToPlayers || typeof document === "undefined") return;
  const element = document.querySelector("[data-player-pace-clock]");
  if (element) element.textContent = formatPlayerPaceClock(clock);
}
