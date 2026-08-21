import {
  grantClueFromHost,
  grantItemFromHost,
  grantMaterialBookletFromHost,
  listMaterialBookletsForHost,
  relockSectionFromHost,
  resendClueFromHost,
  revokeClueFromHost,
  skipSectionFromHost,
  unlockSceneFromHost,
  unlockSectionFromHost
} from "../host-content-action-service.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import { requireActor } from "../request-actor.js";
import { requireHostMembership } from "./host-route-guards.js";
import {
  hostGrantBookletSchema,
  hostGrantClueSchema,
  hostGrantItemSchema,
  hostListMaterialBookletsSchema,
  hostRelockSectionSchema,
  hostResendClueSchema,
  hostRevokeClueSchema,
  hostSkipSectionSchema,
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

  app.get("/api/rooms/:roomId/host/material-booklets", { schema: hostListMaterialBookletsSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return { booklets: await listMaterialBookletsForHost({ roomId, actorId }) };
  });

  app.post("/api/rooms/:roomId/host/grant-booklet", { schema: hostGrantBookletSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, roleSlotIds, bookletId, message } = request.body;
    const targets = [...new Set([...(roleSlotIds ?? []), roleSlotId].filter(Boolean))];
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.grant_booklet", () => (
      grantMaterialBookletFromHost({ roomId, actorId, targets, bookletId, message })
    ));
  });

  app.post("/api/rooms/:roomId/host/revoke-clue", { schema: hostRevokeClueSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, clueId, message } = request.body;
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.revoke_clue", () => (
      revokeClueFromHost({ roomId, actorId, roleSlotId, clueId, message })
    ));
  });

  app.post("/api/rooms/:roomId/host/resend-clue", { schema: hostResendClueSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, clueId, message } = request.body;
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.resend_clue", () => (
      resendClueFromHost({ roomId, actorId, roleSlotId, clueId, message })
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

  app.post("/api/rooms/:roomId/host/relock-section", { schema: hostRelockSectionSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, scriptSectionId, message } = request.body;
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.relock_section", () => (
      relockSectionFromHost({ roomId, actorId, roleSlotId, scriptSectionId, message })
    ));
  });

  app.post("/api/rooms/:roomId/host/skip-section", { schema: hostSkipSectionSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const { roleSlotId, scriptSectionId, message } = request.body;
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.skip_section", () => (
      skipSectionFromHost({ roomId, actorId, roleSlotId, scriptSectionId, message })
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
