import { buildBoardGameCommand } from "../views/board-game-player.js";

export async function handlePlayBoardGameAction({
  action,
  button,
  state,
  api,
  render,
  setToast,
  formatApiError,
  documentRef = document
}) {
  if (!["board-game-submit", "board-game-advance", "board-game-timeout"].includes(action)) return false;
  const form = button.closest(".board-player-action-card") || button.closest(".board-player-actions");
  if (action === "board-game-advance") button.dataset.boardGameCommandType = "advance";
  if (action === "board-game-timeout") button.dataset.boardGameCommandType = "timeout";
  const command = buildBoardGameCommand(button, form);
  if (!command || !state.roomId || state.boardGameCommandBusy) return true;
  state.boardGameCommandBusy = true;
  render();
  try {
    state.boardGameRuntime = await api.submitBoardGameCommand(state.roomId, command);
    state.boardGameRuntimeError = "";
    setToast("行动已提交并同步到全桌", render);
  } catch (error) {
    setToast(formatApiError(error, "桌游行动提交失败"), render);
  } finally {
    state.boardGameCommandBusy = false;
    render();
  }
  return true;
}
