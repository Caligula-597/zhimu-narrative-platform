import { evaluateClueAudit } from "../clue-audit.js";
import { buildWorldArchiveSnapshot, buildWorldSnapshot } from "./world-helpers.js";
import { loadWorldPublishReadiness } from "../world-readiness-service.js";
import {
  evaluateStoryDiagnostics,
  STORY_DIAGNOSTIC_STANDARDS
} from "../story-diagnostics.js";
import { requireWorldRole, WORLD_CREATOR_READER_ROLES } from "./route-guards.js";
import { requireActor } from "../request-actor.js";
import { worldIdParams } from "./schemas.js";

export { loadWorldPublishReadiness };

export async function registerWorldReadinessRoutes(app) {
  app.get(
    "/api/worlds/:worldId/story-diagnostics",
    {
      schema: {
        params: worldIdParams,
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            standard: {
              type: "string",
              enum: Object.keys(STORY_DIAGNOSTIC_STANDARDS),
              default: "classic"
            }
          }
        }
      }
    },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      const { standard = "classic" } = request.query ?? {};
      await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
      try {
        const snapshot = await buildWorldArchiveSnapshot(worldId);
        return {
          worldId,
          generatedAt: new Date().toISOString(),
          ...evaluateStoryDiagnostics(snapshot, { standard })
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
    "/api/worlds/:worldId/publish-readiness",
    { schema: { params: worldIdParams } },
    async (request, reply) => {
      const actorId = requireActor(request);
      const { worldId } = request.params;
      await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
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
      await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
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
      await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
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
      await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
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
      await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
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
      await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
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
