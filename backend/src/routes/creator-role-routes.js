import {
  addCreatorRole,
  removeCreatorRole,
  reviseCreatorRole
} from "../creator-role-service.js";
import { requireActor } from "../request-actor.js";
import { createRoleSchema, deleteRoleSchema, updateRoleSchema } from "./schemas/creator-role.js";

export async function registerCreatorRoleRoutes(app) {
  app.post("/api/worlds/:worldId/roles", { schema: createRoleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    return addCreatorRole({ request, reply, actorId, worldId, body: request.body });
  });

  app.put("/api/worlds/:worldId/roles/:roleSlotId", { schema: updateRoleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    return reviseCreatorRole({ request, reply, actorId, worldId, roleSlotId, body: request.body });
  });

  app.delete("/api/worlds/:worldId/roles/:roleSlotId", { schema: deleteRoleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    return removeCreatorRole({ request, reply, actorId, worldId, roleSlotId });
  });
}
