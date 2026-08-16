import { callView } from "./view-registry.js";

(function (window) {
  function handleBoardGameAction(action, el) {
    switch (action) {
      case "board-tab-select": callView("boardGame", "selectBoardGameTab", el?.dataset?.boardTab); return true;
      case "board-component-add": callView("boardGame", "addBoardGameComponent", el?.dataset?.boardComponentType); return true;
      case "board-component-select": callView("boardGame", "selectBoardGameComponent", el?.dataset?.boardComponentId); return true;
      case "board-component-delete": callView("boardGame", "deleteBoardGameComponent", el?.dataset?.boardComponentId); return true;
      case "board-state-add": callView("boardGame", "addBoardGameStateField"); return true;
      case "board-state-delete": callView("boardGame", "deleteBoardGameStateField", el?.dataset?.boardStateId); return true;
      case "board-asset-open": callView("boardGame", "openBoardGameAssetPicker"); return true;
      case "board-asset-delete": callView("boardGame", "deleteBoardGameAsset", el?.dataset?.boardAssetId); return true;
      case "board-entry-add": callView("boardGame", "addBoardGameEntry"); return true;
      case "board-entry-delete": callView("boardGame", "deleteBoardGameEntry", el?.dataset?.boardEntryId); return true;
      case "board-seat-add": void callView("boardGame", "addBoardGameSeat"); return true;
      case "board-seat-init-six": void callView("boardGame", "initializeSixBoardGameSeats"); return true;
      case "board-seat-name-save": callView("boardGame", "saveBoardGameSeatName", el?.dataset?.boardSeatId); return true;
      case "board-seat-delete": void callView("boardGame", "deleteBoardGameSeat", el?.dataset?.boardSeatId); return true;
      case "board-variable-add": callView("boardGame", "addBoardGameVariable"); return true;
      case "board-variable-delete": callView("boardGame", "deleteBoardGameVariable", el?.dataset?.boardVariableId); return true;
      case "board-mechanism-add": callView("boardGame", "addBoardGameMechanism", el?.dataset?.boardTemplateKey); return true;
      case "board-mechanism-select": callView("boardGame", "selectBoardGameMechanism", el?.dataset?.boardMechanismId); return true;
      case "board-mechanism-delete": callView("boardGame", "deleteBoardGameMechanism", el?.dataset?.boardMechanismId); return true;
      case "board-condition-add": callView("boardGame", "addBoardGameCondition"); return true;
      case "board-condition-delete": callView("boardGame", "deleteBoardGameCondition", el?.dataset?.boardConditionId); return true;
      case "board-effect-add": callView("boardGame", "addBoardGameEffect"); return true;
      case "board-effect-delete": callView("boardGame", "deleteBoardGameEffect", el?.dataset?.boardEffectId); return true;
      case "board-simulator-reset": callView("boardGame", "resetBoardGameSimulator"); return true;
      case "board-design-save": void callView("boardGame", "saveBoardGameDesign"); return true;
      default: return false;
    }
  }

  window.zhimuActionsBoardGame = { handleBoardGameAction };
})(window);

export {};
