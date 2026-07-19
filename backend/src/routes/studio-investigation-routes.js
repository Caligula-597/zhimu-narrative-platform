import { requireActor } from "../request-actor.js";
import {
  addInvestigationPoint,
  reviseInvestigationPoint
} from "../studio-investigation-service.js";
import { requireWorldRole } from "./route-guards.js";
import {
  createInvestigationPointSchema,
  patchInvestigationPointSchema
} from "./schemas/studio-investigation.js";

export async function registerStudioInvestigationRoutes(app) {
  app.patch("/api/worlds/:worldId/investigation-points/:pointId", { schema: patchInvestigationPointSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, pointId } = request.params;
    await requireWorldRole(actorId, worldId);
    return reviseInvestigationPoint({
      request,
      reply,
      actorId,
      worldId,
      pointId,
      payload: request.body
    });
  });

  app.post("/api/worlds/:worldId/scenes/:sceneId/investigation-points", { schema: createInvestigationPointSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, sceneId } = request.params;
    await requireWorldRole(actorId, worldId);
    return addInvestigationPoint({
      request,
      reply,
      actorId,
      worldId,
      sceneId,
      payload: request.body
    });
  });
}
