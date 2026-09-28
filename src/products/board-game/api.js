import { deepseekRequest, demoContext } from "../../api/client.js";

export function generateBoardGameAiDraft(payload, worldId = demoContext.worldId) {
  return deepseekRequest(`/worlds/${worldId}/board-game/ai/design-draft`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: payload,
    timeoutMs: 240_000
  });
}

export function getBoardGameRuntime(roomId = demoContext.roomId) {
  return deepseekRequest(`/rooms/${roomId}/board-game-runtime`, {
    userId: demoContext.playerUserId || demoContext.hostUserId
  });
}

export function initializeBoardGameRuntime(roomId = demoContext.roomId) {
  return deepseekRequest(`/rooms/${roomId}/board-game-runtime/initialize`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: {},
    idempotent: true
  });
}

export function submitBoardGameRuntimeCommand(command, roomId = demoContext.roomId) {
  return deepseekRequest(`/rooms/${roomId}/board-game-runtime/commands`, {
    userId: demoContext.playerUserId || demoContext.hostUserId,
    method: "POST",
    body: command,
    idempotent: true
  });
}
