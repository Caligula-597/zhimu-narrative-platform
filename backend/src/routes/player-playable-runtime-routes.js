import { sendErr, throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { PlayableContentRuntimeError } from "../../shared/playable-content-runtime.js";
import {
  getPlayerPlayableRuntime,
  getPlayerPlayableContentUnit,
  getPlayerPlayableClue,
  markRoomPlayableContentRead,
  bidRoomPlayableMechanism,
  voteRoomPlayableMechanism,
} from "../room-playable-runtime-service.js";
import { requireRoomRole } from "./route-guards.js";
import {
  playerPlayableRuntimeGetSchema,
  playerPlayableContentGetSchema,
  playerPlayableClueGetSchema,
  playerPlayableReadSchema,
  playerPlayableMechanismBidSchema,
  playerPlayableMechanismVoteSchema,
} from "./schemas/player-playable-runtime.js";

async function requirePlayerMembership(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
  return membership;
}

function handlePlayableError(reply, error) {
  if (error instanceof PlayableContentRuntimeError || error?.code) {
    const code = error.code || "PLAYABLE_RUNTIME_ERROR";
    return sendErr(reply, code, error.message || code, error.details);
  }
  throw error;
}

export async function registerPlayerPlayableRuntimeRoutes(app) {
  app.get(
    "/api/rooms/:roomId/playable-runtime",
    { schema: playerPlayableRuntimeGetSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      await requirePlayerMembership(actorId, roomId);
      try {
        return await getPlayerPlayableRuntime(roomId, actorId);
      } catch (error) {
        return handlePlayableError(reply, error);
      }
    },
  );

  app.get(
    "/api/rooms/:roomId/playable-runtime/content/:contentUnitId",
    { schema: playerPlayableContentGetSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { roomId, contentUnitId } = request.params;
      await requirePlayerMembership(actorId, roomId);
      try {
        return await getPlayerPlayableContentUnit({
          roomId,
          userId: actorId,
          contentUnitId,
        });
      } catch (error) {
        return handlePlayableError(reply, error);
      }
    },
  );

  app.get(
    "/api/rooms/:roomId/playable-runtime/clues/:clueId",
    { schema: playerPlayableClueGetSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { roomId, clueId } = request.params;
      await requirePlayerMembership(actorId, roomId);
      try {
        return await getPlayerPlayableClue({ roomId, userId: actorId, clueId });
      } catch (error) {
        return handlePlayableError(reply, error);
      }
    },
  );

  app.post(
    "/api/rooms/:roomId/playable-runtime/read",
    { schema: playerPlayableReadSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      await requirePlayerMembership(actorId, roomId);
      try {
        return await markRoomPlayableContentRead({
          roomId,
          userId: actorId,
          contentUnitId: request.body.contentUnitId,
        });
      } catch (error) {
        return handlePlayableError(reply, error);
      }
    },
  );

  app.post(
    "/api/rooms/:roomId/playable-runtime/mechanism-bid",
    { schema: playerPlayableMechanismBidSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      await requirePlayerMembership(actorId, roomId);
      try {
        return await bidRoomPlayableMechanism({
          roomId,
          userId: actorId,
          placementId: request.body.placementId,
          amount: request.body.amount,
          bidId: request.body.bidId,
        });
      } catch (error) {
        return handlePlayableError(reply, error);
      }
    },
  );

  app.post(
    "/api/rooms/:roomId/playable-runtime/mechanism-vote",
    { schema: playerPlayableMechanismVoteSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      await requirePlayerMembership(actorId, roomId);
      try {
        return await voteRoomPlayableMechanism({
          roomId,
          userId: actorId,
          placementId: request.body.placementId,
          optionId: request.body.optionId,
        });
      } catch (error) {
        return handlePlayableError(reply, error);
      }
    },
  );
}
