/* Actions for creator mini-game design test feature. */
(function (window) {
  function views() { return window.zhimuViews || {}; }

  function handleMiniGamesAction(action, el) {
    const M = views().miniGames || {};
    switch (action) {
      case "mini-game-new": M.openMiniGameEditor?.(""); return true;
      case "mini-game-edit": M.openMiniGameEditor?.(el?.dataset?.template); return true;
      case "mini-game-delete": M.deleteMiniGameTemplate?.(el?.dataset?.template); return true;
      case "mini-game-launch": M.launchMiniGameTemplate?.(el?.dataset?.template); return true;
      default: return false;
    }
  }

  window.zhimuActionsMiniGames = { handleMiniGamesAction };
})(window);
export {};
