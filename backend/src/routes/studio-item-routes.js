import { requireActor } from "../request-actor.js";
import { addStudioItem, removeStudioItem, reviseStudioItem } from "../studio-item-service.js";
import { requireWorldRole } from "./route-guards.js";
import { createItemSchema, deleteItemSchema, patchItemSchema } from "./schemas/studio-item.js";

export async function registerStudioItemRoutes(app) {
  app.post("/api/worlds/:worldId/items", { schema: createItemSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return addStudioItem({ request, reply, actorId, worldId, body: request.body ?? {} });
  });

  app.patch("/api/worlds/:worldId/items/:itemId", { schema: patchItemSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, itemId } = request.params;
    await requireWorldRole(actorId, worldId);
    return reviseStudioItem({ request, reply, actorId, worldId, itemId, body: request.body ?? {} });
  });

  app.delete("/api/worlds/:worldId/items/:itemId", { schema: deleteItemSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, itemId } = request.params;
    await requireWorldRole(actorId, worldId);
    return removeStudioItem({ request, reply, actorId, worldId, itemId });
  });
}
