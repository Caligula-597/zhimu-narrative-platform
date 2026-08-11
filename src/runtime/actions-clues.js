/** Standalone clues management view actions. */
import { callView } from "./view-registry.js";

(function (window) {
  function handleCluesAction(action, el) {
    switch (action) {
      case "clues-edit": callView("clues", "openCluesEditor", el?.dataset?.clue); return true;
      case "clues-select": callView("clues", "selectClue", el?.dataset?.clue); return true;
      case "clue-detail-close": callView("clues", "closeClueDetail"); return true;
      case "clue-flow-filter": callView("clues", "setClueFlowFilter", el?.dataset?.filter); return true;
      case "clue-detail-tab": callView("clues", "setClueDetailTab", el?.dataset?.tab); return true;
      case "clue-flow-zoom": callView("clues", "adjustClueFlowZoom", el?.dataset?.zoom); return true;
      case "clue-flow-fit": callView("clues", "fitClueFlow"); return true;
      case "clue-flow-focus": callView("clues", "focusSelectedClue"); return true;
      case "clues-open-studio": callView("clues", "openClueInStudio", el?.dataset?.clue); return true;
      case "clues-add": callView("clues", "openCluesEditor", ""); return true;
      case "clue-editor-close": callView("clues", "closeCluesEditor"); return true;
      case "clue-editor-save": callView("clues", "saveCluesEditor"); return true;
      case "clues-delete": callView("clues", "confirmDeleteClue", el?.dataset?.clue); return true;
      case "clues-batch-delete": callView("clues", "batchDeleteClues"); return true;
      case "clues-batch-bind": callView("clues", "batchBindCluePaths"); return true;
      case "clues-toggle-select": callView("clues", "toggleCluesSelection", el?.dataset?.clue, el?.checked); return true;
      case "clues-select-all": {
        const visible = [...document.querySelectorAll("[data-clue-row]")].map((row) => row.dataset.clueRow);
        callView("clues", "syncCluesSelectAll", el?.checked, visible);
        return true;
      }
      default: return false;
    }
  }

  window.zhimuActionsClues = { handleCluesAction };
})(window);
export {};
