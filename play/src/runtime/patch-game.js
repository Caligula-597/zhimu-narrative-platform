import {
  renderGameTabBar,
  renderGameTabBody,
  renderHostConfirmBannerHtml
} from "../views/game.js";
import { bindPlayReader } from "./reader.js";

/**
 * Patch in-game DOM without full app re-render (preserves focus/scroll in tab body).
 * @returns {boolean} true if patch applied
 */
export function patchGameView(state, ctx) {
  const tabBody = document.querySelector("[data-game-tab-body]");
  if (!tabBody || state.view !== "game") return false;

  const banner = document.querySelector("[data-game-host-banner]");
  if (banner) banner.innerHTML = renderHostConfirmBannerHtml();

  const tabBar = document.querySelector("[data-game-tab-bar]");
  if (tabBar) tabBar.innerHTML = renderGameTabBar();

  tabBody.innerHTML = renderGameTabBody();

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
