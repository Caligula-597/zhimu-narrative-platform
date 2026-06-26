/** Host console + director rule preview actions. */
(function (window) {
  function views() { return window.zhimuViews || {}; }

  function handleDirectorAction(action, el) {
    const D = views().director || {};
    switch (action) {
      case "rules-preview": D.refreshRulesPreview?.(); return true;
      case "rule-manual-trigger": D.triggerManualRuleFromDirector?.(el?.dataset?.rule); return true;
      case "delay-host-event":
      case "delay-event": D.openDelayHostEventModal?.(el?.dataset?.event); return true;
      case "host-event-context": D.openHostEventContext?.(el?.dataset?.event); return true;
      case "host-player-detail": D.openHostPlayerDetail?.(el?.dataset?.role); return true;
      case "host-kick-player": D.kickHostPlayer?.(el?.dataset?.role); return true;
      case "host-manual-grant-clue": D.openHostGrantClueModal?.(); return true;
      case "host-manual-grant-item": D.openHostGrantItemModal?.(); return true;
      case "host-manual-unlock-section": D.openHostUnlockSectionModal?.(); return true;
      case "host-manual-unlock-scene": D.openHostUnlockSceneModal?.(); return true;
      case "host-mini-game": D.openHostMiniGameModal?.(); return true;
      case "host-manual-log": D.openHostLogModal?.(); return true;
      case "host-clue-note": D.openHostClueNote?.(el?.dataset?.clue, el?.dataset?.role); return true;
      case "host-event-toggle": D.toggleHostEventSelection?.(el?.dataset?.event, el?.checked); return true;
      case "host-event-select-all": D.syncHostEventSelectAll?.(el?.checked); return true;
      case "batch-execute-host-events": D.batchHostEventsAction?.("execute"); return true;
      case "batch-dismiss-host-events": D.batchHostEventsAction?.("dismiss"); return true;
      case "execute-host-event": D.executeHostEvent?.(el?.dataset?.event); return true;
      case "dismiss-host-event": D.dismissHostEvent?.(el?.dataset?.event); return true;
      case "host-nudge-waiting": D.openHostNudgeWaitingModal?.(); return true;
      default: return false;
    }
  }

  window.zhimuActionsDirector = { handleDirectorAction };
})(window);
export {};
