import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { PlayableContentRuntimeError } from "../../shared/playable-content-runtime.js";
import {
  initializeRoomPlayableRuntime,
  getHostPlayableRuntime,
  assignRoomPlayableRole,
  startRoomPlayableSession,
  releaseRoomPlayableContent,
  releaseRoomPlayableClue,
  advanceRoomPlayableStage,
  finishRoomPlayableSession,
  startRoomPlayableMechanism,
  settleRoomPlayableMechanism,
} from "../room-playable-runtime-service.js";
import { requireHostMembership } from "./host-route-guards.js";
import {
  hostPlayableRuntimeGetSchema,
  hostPlayableRuntimeInitializeSchema,
  hostPlayableRuntimeActionSchema,
} from "./schemas/host-playable-runtime.js";

function handlePlayableError(reply, error) {
  if (error instanceof PlayableContentRuntimeError || error?.code) {
    const code = error.code || "PLAYABLE_RUNTIME_ERROR";
    return sendErr(reply, code, error.message || code, error.details);
  }
  throw error;
}

export async function registerHostPlayableRuntimeRoutes(app) {
  app.get(
    "/api/rooms/:roomId/host/playable-runtime",
    { schema: hostPlayableRuntimeGetSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      await requireHostMembership(actorId, roomId);
      try {
        return await getHostPlayableRuntime(roomId);
      } catch (error) {
        return handlePlayableError(reply, error);
      }
    },
  );

  app.post(
    "/api/rooms/:roomId/host/playable-runtime/initialize",
    { schema: hostPlayableRuntimeInitializeSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      await requireHostMembership(actorId, roomId);
      try {
        const response = await withRoomIdempotency(roomId, request, "host.playable.initialize", () =>
          initializeRoomPlayableRuntime({
            roomId,
            actorId,
            useFixtureFallback: request.body?.useFixtureFallback !== false,
          }),
        );
        return reply.code(response.replayed ? 200 : 201).send(response);
      } catch (error) {
        return handlePlayableError(reply, error);
      }
    },
  );

  app.post(
    "/api/rooms/:roomId/host/playable-runtime/actions",
    { schema: hostPlayableRuntimeActionSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      await requireHostMembership(actorId, roomId);
      const action = request.body?.action;
      try {
        return await withRoomIdempotency(roomId, request, `host.playable.${action}`, async () => {
          if (action === "assign_role") {
            return assignRoomPlayableRole({
              roomId,
              actorId,
              userId: request.body.userId,
              playableRoleId: request.body.playableRoleId,
              roleSlotId: request.body.roleSlotId,
            });
          }
          if (action === "start") {
            return startRoomPlayableSession({ roomId, actorId });
          }
          if (action === "release_content") {
            return releaseRoomPlayableContent({
              roomId,
              actorId,
              contentUnitId: request.body.contentUnitId,
            });
          }
          if (action === "release_clue") {
            return releaseRoomPlayableClue({
              roomId,
              actorId,
              clueId: request.body.clueId,
            });
          }
          if (action === "advance") {
            return advanceRoomPlayableStage({ roomId, actorId });
          }
          if (action === "finish" || action === "confirm_ending") {
            return finishRoomPlayableSession({ roomId, actorId });
          }
          if (action === "start_mechanism") {
            return startRoomPlayableMechanism({
              roomId,
              actorId,
              placementId: request.body.placementId,
            });
          }
          if (action === "settle_mechanism") {
            return settleRoomPlayableMechanism({
              roomId,
              actorId,
              placementId: request.body.placementId,
            });
          }
          const err = new Error(`Unknown action ${action}`);
          err.code = "UNKNOWN_ACTION";
          throw err;
        });
      } catch (error) {
        return handlePlayableError(reply, error);
      }
    },
  );
}
