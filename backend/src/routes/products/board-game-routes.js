import { createBoardGameAiDraft } from "../../board-game-ai-draft.js";
import { sendErr } from "../../api-errors.js";
import { requireActor } from "../../request-actor.js";
import { createLlmContextPreHandler } from "../llm-route-hook.js";
import { requireWorldRole, createWorldProductPreHandler } from "../route-guards.js";
import { boardGameAiDraftSchema } from "../schemas.js";
import { boardGameRuntimeCommandSchema, boardGameRuntimeGetSchema, boardGameRuntimeInitializeSchema } from "../schemas/board-game-runtime.js";
import { withRoomIdempotency } from "../../idempotency-helpers.js";
import { requireRoomRole } from "../route-guards.js";
import { requireHostMembership } from "../host-route-guards.js";
import { getBoardGameRuntime, initializeBoardGameRuntime, submitBoardGameCommand } from "../../board-game-online-service.js";

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

  app.get("/api/rooms/:roomId/board-game-runtime", { schema: boardGameRuntimeGetSchema }, async (request) => {
    const actorId = requireActor(request);
    await requireRoomRole(actorId, request.params.roomId);
    return getBoardGameRuntime({ roomId: request.params.roomId, actorId });
  });

  app.post("/api/rooms/:roomId/board-game-runtime/initialize", { schema: boardGameRuntimeInitializeSchema }, async (request) => {
    const actorId = requireActor(request);
    await requireHostMembership(actorId, request.params.roomId);
    return withRoomIdempotency(request.params.roomId, request, "board_game.initialize", () => initializeBoardGameRuntime({ roomId: request.params.roomId, actorId }));
  });

  app.post("/api/rooms/:roomId/board-game-runtime/commands", { schema: boardGameRuntimeCommandSchema }, async (request) => {
    const actorId = requireActor(request);
    await requireRoomRole(actorId, request.params.roomId);
    return withRoomIdempotency(request.params.roomId, request, "board_game.command", () => submitBoardGameCommand({ roomId: request.params.roomId, actorId, command: request.body }));
  });
}
