import { callView } from "./view-registry.js";

(function (window) {
  function handleTabletopMapAction(action, el) {
    switch (action) {
      case "map-save": callView("tabletopMap", "saveTabletopMap"); return true;
      case "map-add-location": callView("tabletopMap", "addMapLocation"); return true;
      case "map-delete-location": callView("tabletopMap", "deleteMapLocation", el?.dataset?.locationId); return true;
      case "map-add-location-check": callView("tabletopMap", "addLocationCheck"); return true;
      case "map-delete-location-check": callView("tabletopMap", "deleteLocationCheck", el?.dataset?.checkId); return true;
      case "map-select-location": callView("tabletopMap", "selectMapLocation", el?.dataset?.locationId); return true;
      case "map-toggle-route-mode": callView("tabletopMap", "toggleMapRouteMode"); return true;
      case "map-canvas-view": callView("tabletopMap", "updateMapCanvasView", el?.dataset?.mapOperation); return true;
      case "map-set-canvas-mode": callView("tabletopMap", "setMapCanvasMode", el?.dataset?.mapCanvasMode); return true;
      case "map-open-background-upload": callView("tabletopMap", "openMapBackgroundPicker"); return true;
      case "map-set-inspector-tab": callView("tabletopMap", "setMapInspectorTab", el?.dataset?.mapInspectorTab); return true;
      case "map-add-npc": callView("tabletopMap", "addMapNpc"); return true;
      case "map-delete-npc": callView("tabletopMap", "deleteMapNpc", el?.dataset?.npcId); return true;
      case "map-roll-check": callView("tabletopMap", "rollMapCheck"); return true;
      case "map-apply-check-variable": callView("tabletopMap", "applyLastCheckToVariable"); return true;
      case "map-player-attack": callView("tabletopMap", "runMapCombatAttack", "player"); return true;
      case "map-npc-attack": callView("tabletopMap", "runMapCombatAttack", "npc"); return true;
      case "map-reset-combat": callView("tabletopMap", "resetMapCombat"); return true;
      case "map-add-variable": callView("tabletopMap", "addMapVariable"); return true;
      case "map-delete-variable": callView("tabletopMap", "deleteMapVariable", el?.dataset?.variableId); return true;
      case "map-add-ending": callView("tabletopMap", "addMapEnding"); return true;
      case "map-delete-ending": callView("tabletopMap", "deleteMapEnding", el?.dataset?.endingId); return true;
      case "map-add-condition": callView("tabletopMap", "addEndingCondition", el?.dataset?.endingId); return true;
      case "map-delete-condition": callView("tabletopMap", "deleteEndingCondition", el?.dataset?.endingId, el?.dataset?.conditionId); return true;
      case "map-simulate-location": callView("tabletopMap", "simulateMapLocation", el?.dataset?.locationId); return true;
      case "map-start-encounter": callView("tabletopMap", "startLocationEncounter", el?.dataset?.locationId); return true;
      case "map-start-combat": callView("tabletopMap", "startMapCombat"); return true;
      case "map-active-attack": callView("tabletopMap", "runActiveCombatAttack"); return true;
      case "map-skip-turn": callView("tabletopMap", "skipMapCombatTurn"); return true;
      case "map-adjust-hp": callView("tabletopMap", "adjustMapCombatHp", el?.dataset?.hpDirection); return true;
      case "map-add-status": callView("tabletopMap", "addMapCombatStatus"); return true;
      case "map-remove-status": callView("tabletopMap", "removeMapCombatStatus", el?.dataset?.combatantId, el?.dataset?.conditionId); return true;
      case "map-apply-combat-outcome": callView("tabletopMap", "applyCombatOutcomeToVariable"); return true;
      default: return false;
    }
  }

  window.zhimuActionsTabletopMap = { handleTabletopMapAction };
})(window);

export {};
