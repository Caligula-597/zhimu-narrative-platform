import { requireActor } from "../request-actor.js";
import {
  createWorldQualityReport,
  getWorldCreatorAnalytics,
  getWorldQualityReports
} from "../content-platform-insight-service.js";
import { requireWorldRole } from "./route-guards.js";
import { createQualityReportSchema, worldIdParams } from "./schemas.js";

export async function registerContentPlatformInsightRoutes(app) {
  app.get("/api/worlds/:worldId/creator-analytics", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return getWorldCreatorAnalytics(worldId);
  });

  app.get("/api/worlds/:worldId/quality-reports", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return getWorldQualityReports(worldId);
  });

  app.post("/api/worlds/:worldId/quality-reports", { schema: createQualityReportSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    return createWorldQualityReport({ request, reply, actorId, worldId, body });
  });
}
