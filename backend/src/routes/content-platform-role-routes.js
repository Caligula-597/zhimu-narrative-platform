import {
  getWorldRoleRelationships,
  removeWorldRoleRelationship,
  saveWorldRoleRelationship,
  updateRoomRoleState
} from "../content-platform-role-service.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import {
  requireHostMembership
} from "./content-platform-room-access.js";
import {
  createRoleRelationshipSchema, roleRelationshipIdParams, updateRoleStateSchema
} from "./schemas/content-platform.js";
import { worldIdParams } from "./schemas/world.js";

export async function registerContentPlatformRoleRoutes(app) {
  app.get("/api/worlds/:worldId/role-relationships", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return { relationships: await getWorldRoleRelationships(worldId) };
  });

  app.post("/api/worlds/:worldId/role-relationships", { schema: createRoleRelationshipSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    return saveWorldRoleRelationship({ request, reply, actorId, worldId, body });
  });

  app.delete("/api/worlds/:worldId/role-relationships/:relationshipId", { schema: { params: roleRelationshipIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, relationshipId } = request.params;
    await requireWorldRole(actorId, worldId);
    return removeWorldRoleRelationship({
      request,
      reply,
      actorId,
      worldId,
      relationshipId
    });
  });

  app.patch("/api/rooms/:roomId/host/players/:roleSlotId/state", { schema: updateRoleStateSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, roleSlotId } = request.params;
    const body = request.body ?? {};
    await requireHostMembership(actorId, roomId);
    const state = await updateRoomRoleState({ actorId, roomId, roleSlotId, body });
    return { state };
  });
}
