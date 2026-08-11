import { escapeHtml } from "../../../shared/security.js";
import { setHtml } from "../../../shared/safe-dom.js";
import { describeSyncDiagnostics } from "../../../shared/sync-diagnostics.js";

const syncBannerHtml = new WeakMap();

/**
 * Coalesce rapid refresh calls (SSE bursts) into one pull per window.
 * @param {() => Promise<void>} fn
 * @param {number} [waitMs=280]
 */
export function createRefreshCoalescer(fn, waitMs = 280) {
  let timer = null;
  let running = false;
  let rerun = false;
  /** @type {(() => void)[]} */
  let waiters = [];

  async function flush() {
    timer = null;
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    do {
      rerun = false;
      try {
        await fn();
      } catch {
        /* caller handles logging */
      }
      const resolved = waiters.splice(0);
      resolved.forEach((resolve) => resolve());
    } while (rerun);
    running = false;
  }

  return function scheduleRefresh() {
    return new Promise((resolve) => {
      waiters.push(resolve);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, waitMs);
    });
  };
}

export function shouldAutoScrollNearBottom(el, threshold = 96) {
  if (!el) return false;
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

/** Patch live/sync pills in play header without full re-render. */
export function patchPlayHeaderChrome(state) {
  const header = document.querySelector(".play-header");
  if (!header) return false;

  const meta = header.querySelector(".header-meta");
  if (!meta) return false;

  let livePill = meta.querySelector(".pill.live");
  const wantLive = state.roomEventsStatus === "connected";
  const wantOnline = state.platformEventsStatus === "connected" && !wantLive;
  const wantReconnect = state.roomEventsStatus === "reconnecting";
  const wantPoll = state.roomEventsStatus === "polling";

  if (!wantLive && !wantOnline && !wantReconnect && !wantPoll) {
    livePill?.remove();
  } else {
    const label = wantLive
      ? "实时"
      : wantReconnect
        ? "重连中"
        : wantPoll
          ? "轮询"
          : "在线";
    if (!livePill) {
      livePill = document.createElement("span");
      livePill.className = "pill live";
      meta.appendChild(livePill);
    }
    livePill.classList.toggle("is-reconnecting", wantReconnect || wantPoll);
    if (livePill.textContent !== label) livePill.textContent = label;
  }

  const roomName = state.home?.room?.name || "";
  const roleName = state.home?.role?.name || "";

  meta.querySelectorAll(".pill[data-room-pill]").forEach((pill, index) => {
    if (index > 0) pill.remove();
  });
  meta.querySelectorAll(".pill[data-role-pill]").forEach((pill, index) => {
    if (index > 0) pill.remove();
  });
  meta.querySelectorAll(".pill.live").forEach((pill, index) => {
    if (index > 0) pill.remove();
  });

  let roomPill = meta.querySelector(".pill[data-room-pill]");
  if (roomName) {
    if (!roomPill) {
      roomPill = document.createElement("span");
      roomPill.className = "pill";
      roomPill.dataset.roomPill = "1";
      meta.insertBefore(roomPill, meta.firstChild);
    }
    if (roomPill.textContent !== roomName) roomPill.textContent = roomName;
  } else {
    roomPill?.remove();
  }

  let rolePill = meta.querySelector(".pill.accent[data-role-pill]");
  if (roleName) {
    if (!rolePill) {
      rolePill = document.createElement("span");
      rolePill.className = "pill accent";
      rolePill.dataset.rolePill = "1";
      meta.appendChild(rolePill);
    }
    if (rolePill.textContent !== roleName) rolePill.textContent = roleName;
  } else {
    rolePill?.remove();
  }

  return true;
}

/** Patch sync status banner without full re-render. */
export function patchSyncStatusBanner(state) {
  const main = document.querySelector(".play-main");
  if (!main) return false;

  let banner = main.querySelector("[data-sync-banner]");
  const html = renderSyncStatusBannerHtml(state);
  if (!html) {
    if (banner) syncBannerHtml.delete(banner);
    banner?.remove();
    return true;
  }
  if (!banner) {
    banner = document.createElement("div");
    banner.dataset.syncBanner = "1";
    main.insertBefore(banner, main.firstChild);
  }
  if (syncBannerHtml.get(banner) !== html) {
    setHtml(banner, html);
    syncBannerHtml.set(banner, html);
  }
  return true;
}

export function renderSyncStatusBannerHtml(state) {
  if (state.view === "game") {
    if (!state.roomSyncDiagnostics) {
      if (state.roomEventsStatus === "reconnecting") {
        return `<div class="banner sync-banner" role="status">实时同步重连中，数据可能稍有延迟…</div>`;
      }
      if (state.roomEventsStatus === "polling") {
        return `<div class="banner sync-banner warn" role="status">实时推送已断开，每 15 秒自动刷新房间数据</div>`;
      }
      return "";
    }
    const diagnostics = state.roomSyncDiagnostics;
    const warning = diagnostics.status !== "connected" || diagnostics.inputDeferred;
    const heading = diagnostics.inputDeferred
      ? "更新已延迟"
      : diagnostics.status === "connected"
        ? "房间状态已追平"
        : diagnostics.status === "polling" ? "每 15 秒自动核对" : "实时同步重连中";
    return `<div class="banner sync-banner ${warning ? "warn" : "ok"}" role="status" aria-live="polite"><strong>${heading}</strong><span>${escapeHtml(describeSyncDiagnostics(diagnostics))}</span></div>`;
  }
  if (state.view !== "game" && state.platformEventsStatus === "reconnecting") {
    return `<div class="banner sync-banner" role="status">平台推送重连中，广场与私信可能稍有延迟…</div>`;
  }
  if (state.view !== "game" && state.platformEventsStatus === "polling") {
    return `<div class="banner sync-banner warn" role="status">平台推送已断开，每 20 秒自动刷新</div>`;
  }
  return "";
}

export function patchSyncChrome(state) {
  const headerOk = patchPlayHeaderChrome(state);
  const bannerOk = patchSyncStatusBanner(state);
  return headerOk || bannerOk;
}

/** Update toast host without rebuilding the whole app shell. */
export function patchPlayToast(message) {
  const host = document.querySelector(".toast-host");
  if (!host) return false;
  setHtml(host, message
    ? `<div class="toast show" role="status">${escapeHtml(message)}</div>`
    : "");
  return true;
}
