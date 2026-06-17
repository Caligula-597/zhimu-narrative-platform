import { loadWorldPublishReadiness } from "../world-readiness-service.js";
import { requireWorldReader } from "./route-guards.js";
import { requireActor } from "../request-actor.js";
import { worldIdParams } from "./schemas.js";

export { loadWorldPublishReadiness };

export async function registerWorldReadinessRoutes(app) {
  app.get(
    "/api/worlds/:worldId/publish-readiness",
    { schema: { params: worldIdParams } },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldReader(actorId, worldId);
      try {
        const result = await loadWorldPublishReadiness(worldId);
        return {
          worldId,
          ...result
        };
      } catch (error) {
        if (error.code && error.statusCode) {
          return reply.code(error.statusCode).send({
            error: error.message,
            code: error.code
          });
        }
        throw error;
      }
    }
  );

  app.get(
    "/api/worlds/:worldId/creator-checks",
    { schema: { params: worldIdParams } },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldReader(actorId, worldId);
      try {
        const result = await loadWorldPublishReadiness(worldId);
        return {
          checks: result.checks.map(({ level, title, detail }) => ({ level, title, detail })),
          summary: result.summary
        };
      } catch (error) {
        if (error.code && error.statusCode) {
          return reply.code(error.statusCode).send({
            error: error.message,
            code: error.code
          });
        }
        throw error;
      }
    }
  );
}
