export const BOARD_GAME_VIEW_MODULES = Object.freeze({
  boardGame: [
    () => import("./shell.css"),
    () => import("../../views/board-game.js"),
    () => import("../../runtime/actions-board-game.js")
  ]
});
