import {
  renderGameTabBar,
  renderGameTabBody,
  renderGameSidebar,
  renderHostConfirmBannerHtml
} from "../views/game.js";
import { bindPlayReader } from "./reader.js";

function activeInputIn(el) {
  const active = document.activeElement;
  if (!active || !el?.contains(active)) return false;
  const tag = active.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || active.isContentEditable;
}

/**
 * Patch in-game DOM without full app re-render (preserves focus/scroll in tab body).
 * @returns {boolean} true if patch applied
 */
export function patchGameView(state, ctx) {
  const tabBody = document.querySelector("[data-game-tab-body]");
  if (!tabBody || state.view !== "game") return false;

  if (activeInputIn(tabBody)) return false;

  const tabBodyScroll = tabBody.scrollTop;
  const voiceLog = state.tab === "voice" ? document.querySelector("[data-voice-scroll]") : null;
  const voiceScrollTop = voiceLog?.scrollTop ?? null;

  const banner = document.querySelector("[data-game-host-banner]");
  if (banner) banner.innerHTML = renderHostConfirmBannerHtml();

  const sidebar = document.querySelector("[data-game-sidebar]");
  if (sidebar) sidebar.innerHTML = renderGameSidebar();

  const tabBar = document.querySelector("[data-game-tab-bar]");
  if (tabBar) tabBar.innerHTML = renderGameTabBar();

  tabBody.innerHTML = renderGameTabBody();

  tabBody.scrollTop = tabBodyScroll;

  if (voiceScrollTop !== null) {
    const nextVoiceLog = document.querySelector("[data-voice-scroll]");
    if (nextVoiceLog) nextVoiceLog.scrollTop = voiceScrollTop;
  }

  if (state.tab === "sections" && state.roomId) {
    bindPlayReader({
      roomId: state.roomId,
      notesSource: () => state.home,
      onRefresh: async () => ctx.pullRoomData({ partial: false }),
      onToast: ctx.onToast
    });
  }

  return true;
}
