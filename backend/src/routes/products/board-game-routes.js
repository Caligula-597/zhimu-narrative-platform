import { createBoardGameAiDraft } from "../../board-game-ai-draft.js";
import { sendErr } from "../../api-errors.js";
import { requireActor } from "../../request-actor.js";
import { createLlmContextPreHandler } from "../llm-route-hook.js";
import { requireWorldRole, createWorldProductPreHandler } from "../route-guards.js";
import { boardGameAiDraftSchema } from "../schemas.js";

const llmPreHandler = createLlmContextPreHandler(sendErr);

export async function registerBoardGameProductRoutes(app) {
  app.addHook("preHandler", createWorldProductPreHandler("board_game"));
  app.post(
    "/api/worlds/:worldId/board-game/ai/design-draft",
    { schema: boardGameAiDraftSchema, preHandler: llmPreHandler },
    async (request) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldRole(actorId, worldId);
      return createBoardGameAiDraft(request.body ?? {}, { requestId: request.id });
    }
  );
}
