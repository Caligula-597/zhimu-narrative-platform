/** Archive / checkpoint / recap + world & room settings actions. */
import { callView } from "./view-registry.js";

(function (window) {
  function handleArchiveAction(action, el) {
    switch (action) {
      case "create-checkpoint": callView("archive", "openCreateCheckpointModal"); return true;
      case "create-recap": callView("archive", "openCreateRecapModal"); return true;
      case "recap-detail": callView("archive", "openRecapDetail", el?.dataset?.recap, el?.dataset?.player === "1"); return true;
      case "recap-back": callView("archive", "closeRecapDetail"); return true;
      case "player-view-recap": callView("archive", "openPlayerRecapFromBanner"); return true;
      case "checkpoint-detail": callView("archive", "openCheckpointDetail", el?.dataset?.checkpoint); return true;
      case "restore-checkpoint": callView("archive", "openRestoreCheckpointModal", el?.dataset?.checkpoint); return true;
      case "save-world-settings": callView("settings", "saveWorldSettings"); return true;
      case "save-room-settings": callView("settings", "saveRoomSettings"); return true;
      case "open-catalog-review": callView("settings", "openCatalogReviewModal"); return true;
      case "catalog-withdraw": callView("settings", "withdrawCatalogListing"); return true;
      case "world-audit": callView("settings", "openWorldAuditModal"); return true;
      case "open-world-tags": callView("settings", "openWorldTagsModal"); return true;
      case "open-segment-remedies": callView("settings", "openSegmentRemediesModal"); return true;
      case "go-writer-export": callView("settings", "goWriterExport"); return true;
      default: return false;
    }
  }

  window.zhimuActionsArchive = { handleArchiveAction };
})(window);
export {};
