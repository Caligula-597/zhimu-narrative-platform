import { withRoomIdempotency } from "../idempotency-helpers.js";
import {
  addPlayerNotebookEntry,
  completePlayerSection,
  getPlayerTimeline,
  removePlayerNotebookEntry,
  startPlayerSection,
  submitPlayerMiniGame,
} from "../player-progress-service.js";
import { submitRoomMechanismDecisionPreference } from "../room-mechanism-submission-service.js";
import { requireActor } from "../request-actor.js";
import { throwErr } from "../api-errors.js";
import { requireRoomRole } from "./route-guards.js";
import {
  completeSectionSchema,
  deleteNotebookEntrySchema,
  notebookEntrySchema,
  playerProgressRoomIdParams,
  submitMechanismDecisionSchema,
  submitMiniGameSchema,
} from "./schemas/player-progress.js";

function requirePlayerRole(membership) {
  if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
  return membership.role_slot_id;
}

export async function registerPlayerProgressRoutes(app) {
  app.post(
    "/api/rooms/:roomId/player/mechanism-decisions/:decisionKey/submissions",
    { schema: submitMechanismDecisionSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId, decisionKey } = request.params;
      const roleSlotId = requirePlayerRole(
        await requireRoomRole(actorId, roomId),
      );
      return withRoomIdempotency(
        roomId,
        request,
        "player.mechanism_decision_submit",
        () =>
          submitRoomMechanismDecisionPreference({
            roomId,
            decisionKey,
            roleSlotId,
            actorId,
            ...request.body,
          }),
      );
    },
  );

  app.post(
    "/api/rooms/game/submit",
    { schema: submitMiniGameSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId, answer } = request.body;
      const gameId =
        request.body.instanceId ||
        request.body.instance_id ||
        request.body.gameId ||
        request.body.game_id;
      requirePlayerRole(await requireRoomRole(actorId, roomId));

      return withRoomIdempotency(
        roomId,
        request,
        "player.mini_game_submit",
        () => submitPlayerMiniGame({ roomId, gameId, actorId, answer }),
      );
    },
  );

  app.post(
    "/api/rooms/:roomId/sections/:sectionId/start",
    { schema: completeSectionSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId, sectionId } = request.params;
      const roleSlotId = requirePlayerRole(
        await requireRoomRole(actorId, roomId),
      );
      return startPlayerSection({ roomId, roleSlotId, sectionId });
    },
  );

  app.post("/api/rooms/:roomId/sections/:sectionId/complete", { schema: completeSectionSchema }, async (request) => {
      const actorId = requireActor(request);
      const { roomId, sectionId } = request.params;
      const roleSlotId = requirePlayerRole(
        await requireRoomRole(actorId, roomId),
      );
      return withRoomIdempotency(roomId, request, "sections.complete", () =>
        completePlayerSection({ roomId, roleSlotId, sectionId, actorId }),
      );
  });

  app.post(
    "/api/rooms/:roomId/notebook",
    { schema: notebookEntrySchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      const roleSlotId = requirePlayerRole(
        await requireRoomRole(actorId, roomId),
      );
      const { sourceType, sourceId, title, body } = request.body;
      const entry = await withRoomIdempotency(
        roomId,
        request,
        "player.notebook_create",
        () =>
          addPlayerNotebookEntry({
            roomId,
            roleSlotId,
            actorId,
            sourceType,
            sourceId,
            title,
            body,
          }),
      );
      return reply.code(201).send(entry);
    },
  );

  app.delete(
    "/api/rooms/:roomId/notebook/:entryId",
    { schema: deleteNotebookEntrySchema },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId, entryId } = request.params;
      const roleSlotId = requirePlayerRole(
        await requireRoomRole(actorId, roomId),
      );
      return withRoomIdempotency(
        roomId,
        request,
        "player.notebook_delete",
        () => removePlayerNotebookEntry({ roomId, roleSlotId, entryId }),
      );
    },
  );

  app.get(
    "/api/rooms/:roomId/my-timeline",
    { schema: { params: playerProgressRoomIdParams } },
    async (request) => {
      const actorId = requireActor(request);
      const { roomId } = request.params;
      const roleSlotId = requirePlayerRole(
        await requireRoomRole(actorId, roomId),
      );
      return getPlayerTimeline({ roomId, roleSlotId, actorId });
    },
  );
}
