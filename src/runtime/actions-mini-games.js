/* Actions for creator mini-game design test feature. */
import { callView } from "./view-registry.js";

(function (window) {
  function handleMiniGamesAction(action, el) {
    switch (action) {
      case "mini-game-new": callView("miniGames", "openMiniGameEditor", ""); return true;
      case "mini-game-edit": callView("miniGames", "openMiniGameEditor", el?.dataset?.template); return true;
      case "mini-game-delete": callView("miniGames", "deleteMiniGameTemplate", el?.dataset?.template); return true;
      case "mini-game-launch": callView("miniGames", "launchMiniGameTemplate", el?.dataset?.template); return true;
      default: return false;
    }
  }

  window.zhimuActionsMiniGames = { handleMiniGamesAction };
})(window);
export {};
