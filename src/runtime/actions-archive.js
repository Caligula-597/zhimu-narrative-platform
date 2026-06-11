/** Archive / checkpoint / recap + world & room settings actions. */
(function (window) {
  function views() { return window.zhimuViews || {}; }

  function handleArchiveAction(action, el) {
    const A = views().archive || {};
    const S = views().settings || {};
    switch (action) {
      case "create-checkpoint": A.openCreateCheckpointModal?.(); return true;
      case "create-recap": A.openCreateRecapModal?.(); return true;
      case "recap-detail": A.openRecapDetail?.(el?.dataset?.recap, el?.dataset?.player === "1"); return true;
      case "recap-back": A.closeRecapDetail?.(); return true;
      case "checkpoint-detail": A.openCheckpointDetail?.(el?.dataset?.checkpoint); return true;
      case "restore-checkpoint": A.openRestoreCheckpointModal?.(el?.dataset?.checkpoint); return true;
      case "save-world-settings": S.saveWorldSettings?.(); return true;
      case "save-room-settings": S.saveRoomSettings?.(); return true;
      case "open-catalog-review": S.openCatalogReviewModal?.(); return true;
      case "catalog-withdraw": S.withdrawCatalogListing?.(); return true;
      case "world-audit": S.openWorldAuditModal?.(); return true;
      case "go-writer-export": S.goWriterExport?.(); return true;
      default: return false;
    }
  }

  window.zhimuActionsArchive = { handleArchiveAction };
})(window);
export {};
