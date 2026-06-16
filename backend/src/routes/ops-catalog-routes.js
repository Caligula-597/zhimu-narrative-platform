import {
  approveCatalogReview,
  listPendingCatalogReviews,
  rejectCatalogReview
} from "../catalog-review-ops.js";
import { sendErr } from "../api-errors.js";
import { worldIdParams } from "./schemas.js";

const catalogReviewListQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: 200 },
    offset: { type: "integer", minimum: 0, maximum: 100_000 }
  }
};

const catalogRejectBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["note"],
  properties: {
    note: { type: "string", minLength: 4, maxLength: 2000 }
  }
};

export async function registerOpsCatalogRoutes(app) {
  app.get(
    "/api/ops/catalog/reviews",
    {
      schema: {
        hide: true,
        tags: ["system"],
        querystring: catalogReviewListQuerySchema,
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            properties: {
              items: { type: "array", items: { type: "object", additionalProperties: true } },
              total: { type: "integer" },
              limit: { type: "integer" },
              offset: { type: "integer" }
            }
          }
        }
      }
    },
    async (request) => {
      const { limit, offset } = request.query ?? {};
      return listPendingCatalogReviews({ limit, offset });
    }
  );

  app.post(
    "/api/ops/catalog/reviews/:worldId/approve",
    {
      schema: {
        hide: true,
        tags: ["system"],
        params: worldIdParams
      }
    },
    async (request, reply) => {
      try {
        const row = await approveCatalogReview(request.params.worldId);
        return reply.code(200).send({ ok: true, world: row });
      } catch (error) {
        if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
        throw error;
      }
    }
  );

  app.post(
    "/api/ops/catalog/reviews/:worldId/reject",
    {
      schema: {
        hide: true,
        tags: ["system"],
        params: worldIdParams,
        body: catalogRejectBodySchema
      }
    },
    async (request, reply) => {
      try {
        const row = await rejectCatalogReview(request.params.worldId, request.body?.note);
        return reply.code(200).send({ ok: true, world: row });
      } catch (error) {
        if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
        throw error;
      }
    }
  );
}
