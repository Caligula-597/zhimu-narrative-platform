import { buildCreatorBootstrap } from "../creator-bootstrap.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { creatorBootstrapSchema } from "./schemas/creator-bootstrap.js";

export async function registerCreatorBootstrapRoutes(app) {
  app.get(
    "/api/worlds/:worldId/creator-bootstrap",
    { schema: creatorBootstrapSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      const { roomId = null } = request.query ?? {};
      await requireWorldRole(actorId, worldId);
      return buildCreatorBootstrap({ worldId, actorId, roomId: roomId || null });
    }
  );
}
