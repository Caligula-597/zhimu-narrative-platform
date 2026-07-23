import { requireActor } from "../request-actor.js";
import { addWorldRelease, listWorldReleases } from "../world-release-service.js";
import { requireWorldRole, WORLD_READER_ROLES } from "./route-guards.js";
import {
  createWorldReleaseSchema,
  listWorldReleasesSchema
} from "./schemas/world-release.js";

export async function registerWorldReleaseRoutes(app) {
  app.get(
    "/api/worlds/:worldId/releases",
    { schema: listWorldReleasesSchema },
    async (request) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldRole(actorId, worldId, WORLD_READER_ROLES);
      return listWorldReleases({ worldId });
    }
  );

  app.post(
    "/api/worlds/:worldId/releases",
    { schema: createWorldReleaseSchema },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      return addWorldRelease({
        request,
        reply,
        actorId,
        worldId,
        label: request.body?.label
      });
    }
  );
}
