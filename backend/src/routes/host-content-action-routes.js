import {
  grantClueFromHost,
  grantItemFromHost,
  unlockSceneFromHost,
  unlockSectionFromHost
} from "../host-content-action-service.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { requireActor } from "../request-actor.js";
import { requireHostMembership } from "./host-route-guards.js";
import {
  hostGrantClueSchema,
  hostGrantItemSchema,
  hostUnlockSceneSchema,
  hostUnlockSectionSchema
} from "./schemas/host-content-action.js";

export async function registerHostContentActionRoutes(app) {
  app.post("/api/rooms/:roomId/host/grant-clue", { schema: hostGrantClueSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, roleSlotIds, clueId, message } = request.body;
    const targets = [...new Set([...(roleSlotIds ?? []), roleSlotId].filter(Boolean))];
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.grant_clue", () => (
      grantClueFromHost({ roomId, actorId, targets, clueId, message })
    ));
  });

  app.post("/api/rooms/:roomId/host/grant-item", { schema: hostGrantItemSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, itemId, quantity = 1, message } = request.body;
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.grant_item", () => (
      grantItemFromHost({ roomId, actorId, roleSlotId, itemId, quantity, message })
    ));
  });

  app.post("/api/rooms/:roomId/host/unlock-section", { schema: hostUnlockSectionSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, scriptSectionId, message } = request.body;
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.unlock_section", () => (
      unlockSectionFromHost({ roomId, actorId, roleSlotId, scriptSectionId, message })
    ));
  });

  app.post("/api/rooms/:roomId/scenes/:sceneId/unlock", { schema: hostUnlockSceneSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, sceneId } = request.params;
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.unlock_scene", () => (
      unlockSceneFromHost({ roomId, actorId, sceneId })
    ));
  });
}
