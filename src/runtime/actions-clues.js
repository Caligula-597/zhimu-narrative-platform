/** Standalone clues management view actions. */
(function (window) {
  function views() { return window.zhimuViews || {}; }

  function handleCluesAction(action, el) {
    const C = views().clues || {};
    switch (action) {
      case "clues-edit": C.openCluesEditor?.(el?.dataset?.clue); return true;
      case "clues-select": C.selectClue?.(el?.dataset?.clue); return true;
      case "clue-detail-close": C.closeClueDetail?.(); return true;
      case "clue-flow-filter": C.setClueFlowFilter?.(el?.dataset?.filter); return true;
      case "clue-detail-tab": C.setClueDetailTab?.(el?.dataset?.tab); return true;
      case "clue-flow-zoom": C.adjustClueFlowZoom?.(el?.dataset?.zoom); return true;
      case "clues-open-studio": C.openClueInStudio?.(el?.dataset?.clue); return true;
      case "clues-add": C.openCluesEditor?.(""); return true;
      case "clues-delete": C.confirmDeleteClue?.(el?.dataset?.clue); return true;
      case "clues-batch-delete": C.batchDeleteClues?.(); return true;
      case "clues-toggle-select": C.toggleCluesSelection?.(el?.dataset?.clue, el?.checked); return true;
      case "clues-select-all": {
        const visible = [...document.querySelectorAll("[data-clue-row]")].map((row) => row.dataset.clueRow);
        C.syncCluesSelectAll?.(el?.checked, visible);
        return true;
      }
      default: return false;
    }
  }

  window.zhimuActionsClues = { handleCluesAction };
})(window);
export {};
