import { requireActor } from "../request-actor.js";
import { createWorldStoryEdge } from "../studio-story-edge-service.js";
import { requireWorldRole } from "./route-guards.js";
import { createStoryEdgeSchema } from "./schemas/creator-studio.js";

export async function registerStudioStoryEdgeRoutes(app) {
  app.post("/api/worlds/:worldId/story-edges", { schema: createStoryEdgeSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return createWorldStoryEdge({ request, reply, worldId, body: request.body ?? {} });
  });
}
