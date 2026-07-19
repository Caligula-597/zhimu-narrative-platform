import {
  getPrivateActionsForHost,
  getPrivateActionsForRole,
  reviewPrivateAction,
  submitPrivateAction
} from "../content-platform-private-action-service.js";
import { requireActor } from "../request-actor.js";
import {
  requireHostMembership, requireRoomPlayer
} from "./content-platform-room-access.js";
import {
  createPrivateActionSchema, privateActionListSchema, updatePrivateActionSchema
} from "./schemas/content-platform.js";

export async function registerContentPlatformPrivateActionRoutes(app) {
  app.get("/api/rooms/:roomId/private-actions", { schema: privateActionListSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requireRoomPlayer(actorId, roomId);
    return getPrivateActionsForRole(roomId, membership.role_slot_id, request.query);
  });

  app.post("/api/rooms/:roomId/private-actions", { schema: createPrivateActionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireRoomPlayer(actorId, roomId);
    const body = request.body ?? {};
    const action = await submitPrivateAction({ actorId, roomId, body });
    return reply.code(201).send({ action });
  });

  app.get("/api/rooms/:roomId/host/private-actions", { schema: privateActionListSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    return getPrivateActionsForHost(roomId, request.query);
  });

  app.patch("/api/rooms/:roomId/host/private-actions/:actionId", { schema: updatePrivateActionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { roomId, actionId } = request.params;
    const body = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    const action = await reviewPrivateAction({ actorId, roomId, actionId, body });
    return { action };
  });
}
