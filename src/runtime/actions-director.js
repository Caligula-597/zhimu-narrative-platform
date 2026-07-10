/** Host console + director rule preview actions. */
import { callView } from "./view-registry.js";

(function (window) {
  function handleDirectorAction(action, el) {
    switch (action) {
      case "rules-preview": callView("director", "refreshRulesPreview"); return true;
      case "rule-manual-trigger": callView("director", "triggerManualRuleFromDirector", el?.dataset?.rule); return true;
      case "delay-host-event":
      case "delay-event": callView("director", "openDelayHostEventModal", el?.dataset?.event); return true;
      case "host-event-context": callView("director", "openHostEventContext", el?.dataset?.event); return true;
      case "host-player-detail": callView("director", "openHostPlayerDetail", el?.dataset?.role); return true;
      case "host-kick-player": callView("director", "kickHostPlayer", el?.dataset?.role); return true;
      case "host-manual-grant-clue": callView("director", "openHostGrantClueModal"); return true;
      case "host-manual-grant-item": callView("director", "openHostGrantItemModal"); return true;
      case "host-manual-unlock-section": callView("director", "openHostUnlockSectionModal"); return true;
      case "host-manual-unlock-scene": callView("director", "openHostUnlockSceneModal"); return true;
      case "host-mini-game": callView("director", "openHostMiniGameModal"); return true;
      case "host-manual-log": callView("director", "openHostLogModal"); return true;
      case "host-clue-note": callView("director", "openHostClueNote", el?.dataset?.clue, el?.dataset?.role); return true;
      case "host-event-toggle": callView("director", "toggleHostEventSelection", el?.dataset?.event, el?.checked); return true;
      case "host-event-select-all": callView("director", "syncHostEventSelectAll", el?.checked); return true;
      case "batch-execute-host-events": callView("director", "batchHostEventsAction", "execute"); return true;
      case "batch-dismiss-host-events": callView("director", "batchHostEventsAction", "dismiss"); return true;
      case "execute-host-event": callView("director", "executeHostEvent", el?.dataset?.event); return true;
      case "dismiss-host-event": callView("director", "dismissHostEvent", el?.dataset?.event); return true;
      case "host-nudge-waiting": callView("director", "openHostNudgeWaitingModal"); return true;
      case "host-stuck-intervene": callView("director", "openHostStuckIntervention", el?.dataset?.role || ""); return true;
      default: return false;
    }
  }

  window.zhimuActionsDirector = { handleDirectorAction };
})(window);
export {};
