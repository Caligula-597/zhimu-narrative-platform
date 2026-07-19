import {
  addStudioVersion,
  removeStudioVersion,
  restoreStudioVersion
} from "../studio-version-service.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import {
  createContentVersionSchema,
  deleteContentVersionSchema,
  restoreContentVersionSchema
} from "./schemas/studio-version.js";

export async function registerStudioVersionRoutes(app) {
  app.post("/api/worlds/:worldId/content-versions", { schema: createContentVersionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return addStudioVersion({
      request,
      reply,
      actorId,
      worldId,
      label: request.body?.label ?? "手动创作快照"
    });
  });

  app.post("/api/worlds/:worldId/content-versions/:versionId/restore", { schema: restoreContentVersionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, versionId } = request.params;
    await requireWorldRole(actorId, worldId);
    return restoreStudioVersion({ request, reply, actorId, worldId, versionId });
  });

  app.delete("/api/worlds/:worldId/content-versions/:versionId", { schema: deleteContentVersionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, versionId } = request.params;
    await requireWorldRole(actorId, worldId);
    return removeStudioVersion({ request, reply, actorId, worldId, versionId });
  });
}
