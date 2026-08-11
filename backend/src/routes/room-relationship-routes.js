import { requireActor } from "../request-actor.js";
import {
  listHostRoomRelationships,
  listPlayerRoomRelationships,
  updateRoomRelationship,
} from "../room-relationship-service.js";
import { requireHostMembership } from "./host-route-guards.js";
import { requireRoomRole } from "./route-guards.js";
import { throwErr } from "../api-errors.js";
import { withRoomIdempotency } from "../idempotency-helpers.js";
import {
  listRoomRelationshipsSchema,
  updateRoomRelationshipSchema,
} from "./schemas/room-relationship.js";

export async function registerPlayerRoomRelationshipRoutes(app) {
  app.get("/api/rooms/:roomId/player/relationships", { schema: listRoomRelationshipsSchema }, async (request) => {
    const actorId = requireActor(request);
    const membership = await requireRoomRole(actorId, request.params.roomId);
    if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
    return listPlayerRoomRelationships({
      roomId: request.params.roomId,
      roleSlotId: membership.role_slot_id,
    });
  });
}

export async function registerHostRoomRelationshipRoutes(app) {
  app.get("/api/rooms/:roomId/host/relationships", { schema: listRoomRelationshipsSchema }, async (request) => {
    const actorId = requireActor(request);
    await requireHostMembership(actorId, request.params.roomId);
    return listHostRoomRelationships(request.params.roomId);
  });

  app.patch("/api/rooms/:roomId/host/relationships/:relationshipId", { schema: updateRoomRelationshipSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, relationshipId } = request.params;
    await requireHostMembership(actorId, roomId);
    const { expectedRevision, ...patch } = request.body;
    return withRoomIdempotency(roomId, request, "host.relationship_update", () => updateRoomRelationship({
      roomId,
      relationshipId,
      actorId,
      expectedRevision,
      patch,
    }));
  });
}
