import { deepseekRequest, demoContext } from "../../api/client.js";

export function generateBoardGameAiDraft(payload, worldId = demoContext.worldId) {
  return deepseekRequest(`/worlds/${worldId}/board-game/ai/design-draft`, {
    userId: demoContext.hostUserId,
    method: "POST",
    body: payload,
    timeoutMs: 240_000
  });
}
