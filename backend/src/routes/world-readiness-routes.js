import { evaluateClueAudit } from "../clue-audit.js";
import { buildWorldSnapshot } from "./world-helpers.js";
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
    "/api/worlds/:worldId/clue-audit",
    { schema: { params: worldIdParams } },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldReader(actorId, worldId);
      try {
        const snapshot = await buildWorldSnapshot(worldId);
        return {
          worldId,
          ...evaluateClueAudit(snapshot)
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

  app.get(
    "/api/worlds/:worldId/segment-completion",
    {
      schema: {
        params: worldIdParams,
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            roomId: { type: "string", minLength: 36, maxLength: 36 }
          }
        }
      }
    },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      const { roomId = null } = request.query ?? {};
      await requireWorldReader(actorId, worldId);
      try {
        const { buildSegmentCompletion } = await import("../segment-completion.js");
        return await buildSegmentCompletion({ worldId, actorId, roomId: roomId || null });
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
    "/api/worlds/:worldId/clue-hit-rate",
    {
      schema: {
        params: worldIdParams,
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            roomId: { type: "string", minLength: 36, maxLength: 36 }
          }
        }
      }
    },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      const { roomId = null } = request.query ?? {};
      await requireWorldReader(actorId, worldId);
      try {
        const { buildClueHitRate } = await import("../clue-hit-rate.js");
        return await buildClueHitRate({ worldId, actorId, roomId: roomId || null });
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
    "/api/worlds/:worldId/creator-dashboard",
    {
      schema: {
        params: worldIdParams,
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            roomId: { type: "string", minLength: 36, maxLength: 36 }
          }
        }
      }
    },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      const { roomId = null } = request.query ?? {};
      await requireWorldReader(actorId, worldId);
      try {
        const { buildCreatorDashboard } = await import("../creator-dashboard.js");
        return await buildCreatorDashboard({ worldId, actorId, roomId: roomId || null });
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
