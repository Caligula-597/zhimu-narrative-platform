import { getFeedbackStats, listFeedback, updateFeedbackStatus } from "../feedback.js";

const feedbackListQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["new", "seen", "resolved"] },
    kind: { type: "string", enum: ["feedback", "bug", "feature"] },
    limit: { type: "integer", minimum: 1, maximum: 200 },
    offset: { type: "integer", minimum: 0, maximum: 100_000 }
  }
};

const feedbackIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: { type: "string", format: "uuid" }
  }
};

const feedbackStatusBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: { type: "string", enum: ["new", "seen", "resolved"] }
  }
};

export async function registerOpsFeedbackRoutes(app) {
  app.get(
    "/api/ops/feedback/stats",
    {
      schema: {
        hide: true,
        tags: ["system"],
        response: {
          200: { type: "array", items: { type: "object", additionalProperties: true } }
        }
      }
    },
    async () => getFeedbackStats()
  );

  app.get(
    "/api/ops/feedback",
    {
      schema: {
        hide: true,
        tags: ["system"],
        querystring: feedbackListQuerySchema,
        response: {
          200: { type: "object", additionalProperties: true }
        }
      }
    },
    async (request) => {
      const { status, kind, limit, offset } = request.query;
      return listFeedback({
        status,
        kind,
        limit: limit != null ? Number(limit) : 50,
        offset: offset != null ? Number(offset) : 0
      });
    }
  );

  app.patch(
    "/api/ops/feedback/:id",
    {
      schema: {
        hide: true,
        tags: ["system"],
        params: feedbackIdParamsSchema,
        body: feedbackStatusBodySchema,
        response: {
          200: { type: "object", additionalProperties: true }
        }
      }
    },
    async (request) => updateFeedbackStatus(request.params.id, request.body.status)
  );
}
