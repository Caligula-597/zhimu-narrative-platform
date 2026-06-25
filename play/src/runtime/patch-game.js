import { setToast } from "../state.js";
import {
  renderGameTabBar,
  renderGameTabBody,
  renderGameSidebar,
  renderHostConfirmBannerHtml
} from "../views/game.js";
import { renderMiniGamePanel } from "../components/mini-games.js";
import { bindPlayReader } from "./reader.js";

function activeInputIn(el) {
  const active = document.activeElement;
  if (!active || !el?.contains(active)) return false;
  const tag = active.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || active.isContentEditable;
}

export function isGameInputFocused() {
  const tabBody = document.querySelector("[data-game-tab-body]");
  const miniGame = document.querySelector("[data-game-mini-game]");
  return Boolean((tabBody && activeInputIn(tabBody)) || (miniGame && activeInputIn(miniGame)));
}

function bindSectionsReader(state, ctx) {
  if (state.tab !== "sections" || !state.roomId) return;
  bindPlayReader({
    roomId: state.roomId,
    notesSource: () => state.home,
    onPatch: () => patchGameSectionsTab(state, ctx),
    onToast: (message) => setToast(message, ctx.render, { patch: true })
  });
}

function patchGameChrome(state) {
  const banner = document.querySelector("[data-game-host-banner]");
  if (banner) banner.innerHTML = renderHostConfirmBannerHtml();

  const miniGame = document.querySelector("[data-game-mini-game]");
  if (miniGame && !activeInputIn(miniGame)) miniGame.innerHTML = renderMiniGamePanel(state.currentGame);

  const sidebar = document.querySelector("[data-game-sidebar]");
  if (sidebar) sidebar.innerHTML = renderGameSidebar();

  const tabBar = document.querySelector("[data-game-tab-bar]");
  if (tabBar) tabBar.innerHTML = renderGameTabBar();

  const shell = document.querySelector(".game-shell");
  if (shell) {
    shell.classList.toggle("sidebar-collapsed", Boolean(state.gameSidebarCollapsed));
  }
}

/**
 * Switch in-game tab without full app re-render.
 * @returns {boolean}
 */
export function patchGameTabSwitch(state, ctx) {
  const tabBody = document.querySelector("[data-game-tab-body]");
  const tabBar = document.querySelector("[data-game-tab-bar]");
  if (!tabBody || !tabBar || state.view !== "game") return false;

  tabBar.innerHTML = renderGameTabBar();
  tabBody.innerHTML = renderGameTabBody();
  tabBody.setAttribute("aria-labelledby", `play-tab-${state.tab}`);

  if (state.tab === "sections") bindSectionsReader(state, ctx);
  return true;
}

/**
 * Patch in-game DOM without full app re-render (preserves focus/scroll in tab body).
 * @returns {"full"|"chrome"|false}
 */
export function patchGameView(state, ctx) {
  const tabBody = document.querySelector("[data-game-tab-body]");
  if (!tabBody || state.view !== "game") return false;

  patchGameChrome(state);

  if (isGameInputFocused()) return "chrome";

  const tabBodyScroll = tabBody.scrollTop;
  const voiceLog = state.tab === "voice" ? document.querySelector("[data-voice-scroll]") : null;
  const voiceScrollTop = voiceLog?.scrollTop ?? null;

  tabBody.innerHTML = renderGameTabBody();
  tabBody.setAttribute("aria-labelledby", `play-tab-${state.tab}`);
  tabBody.scrollTop = tabBodyScroll;

  if (voiceScrollTop !== null) {
    const nextVoiceLog = document.querySelector("[data-voice-scroll]");
    if (nextVoiceLog) nextVoiceLog.scrollTop = voiceScrollTop;
  }

  bindSectionsReader(state, ctx);
  return "full";
}

/** Patch host/nudge banner only (no tab body). */
export function patchGameHostBanner() {
  const banner = document.querySelector("[data-game-host-banner]");
  if (!banner) return false;
  banner.innerHTML = renderHostConfirmBannerHtml();
  return true;
}

/** Patch sections tab body after optimistic local state change. */
export function patchGameSectionsTab(state, ctx) {
  if (state.view !== "game" || state.tab !== "sections") return false;
  const tabBody = document.querySelector("[data-game-tab-body]");
  if (!tabBody) return false;
  const scroll = tabBody.scrollTop;
  tabBody.innerHTML = renderGameTabBody();
  tabBody.scrollTop = scroll;
  bindSectionsReader(state, ctx);
  return true;
}
