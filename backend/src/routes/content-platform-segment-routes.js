import {
  addWorldSegment,
  getWorldSegments,
  reviseWorldSegment,
  syncSegmentsFromGraph
} from "../content-platform-segment-service.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole, WORLD_CREATOR_READER_ROLES } from "./route-guards.js";
import {
  createSegmentSchema, updateSegmentSchema
} from "./schemas/content-platform.js";
import { worldIdParams } from "./schemas/world.js";

export async function registerContentPlatformSegmentRoutes(app) {
  app.get("/api/worlds/:worldId/segments", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    return { segments: await getWorldSegments(worldId) };
  });

  app.post("/api/worlds/:worldId/segments/sync-from-graph", { schema: { params: worldIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return syncSegmentsFromGraph({ request, reply, actorId, worldId });
  });

  app.post("/api/worlds/:worldId/segments", { schema: createSegmentSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    return addWorldSegment({ request, reply, actorId, worldId, body });
  });

  app.patch("/api/worlds/:worldId/segments/:segmentId", { schema: updateSegmentSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, segmentId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    return reviseWorldSegment({
      request,
      reply,
      actorId,
      worldId,
      segmentId,
      body
    });
  });
}
