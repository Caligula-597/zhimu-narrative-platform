import { withRoomIdempotency } from "../idempotency-helpers.js";
import {
  listHostItemActions,
  listPlayerItemActions,
  resolveItemAction,
  submitItemAction,
} from "../item-action-service.js";
import { requireActor } from "../request-actor.js";
import { throwErr } from "../api-errors.js";
import { requireHostMembership } from "./host-route-guards.js";
import { requireRoomRole } from "./route-guards.js";
import {
  listItemActionsSchema,
  resolveItemActionSchema,
  submitItemActionSchema,
} from "./schemas/item-action.js";

function playerRole(membership) {
  if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
  return membership.role_slot_id;
}

export async function registerPlayerItemActionRoutes(app) {
  app.get("/api/rooms/:roomId/player/item-actions", { schema: listItemActionsSchema }, async (request) => {
    const actorId = requireActor(request);
    const roleSlotId = playerRole(await requireRoomRole(actorId, request.params.roomId));
    return listPlayerItemActions({ roomId: request.params.roomId, roleSlotId });
  });

  app.post("/api/rooms/:roomId/player/items/:itemId/actions", { schema: submitItemActionSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, itemId } = request.params;
    const roleSlotId = playerRole(await requireRoomRole(actorId, roomId));
    return withRoomIdempotency(roomId, request, "player.item_action_submit", () => submitItemAction({
      roomId,
      itemId,
      roleSlotId,
      actorId,
      ...request.body,
    }));
  });

}

export async function registerHostItemActionRoutes(app) {
  app.get("/api/rooms/:roomId/host/item-actions", { schema: listItemActionsSchema }, async (request) => {
    const actorId = requireActor(request);
    await requireHostMembership(actorId, request.params.roomId);
    return listHostItemActions(request.params.roomId);
  });

  app.post("/api/rooms/:roomId/host/item-actions/:actionId/resolve", { schema: resolveItemActionSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, actionId } = request.params;
    await requireHostMembership(actorId, roomId);
    return withRoomIdempotency(roomId, request, "host.item_action_resolve", () => resolveItemAction({
      roomId,
      actionId,
      actorId,
      ...request.body,
    }));
  });
}
