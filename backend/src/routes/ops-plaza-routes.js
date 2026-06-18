import { sendErr } from "../api-errors.js";
import {
  listPlazaHumanReviewQueue,
  opsApprovePlazaPost,
  opsRejectPlazaPost,
  opsResolvePlazaReport
} from "../play-plaza-ops.js";
import { uuidParams } from "./schemas.js";

const opsListQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: 200 },
    offset: { type: "integer", minimum: 0, maximum: 100_000 }
  }
};

const opsNoteBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    note: { type: "string", minLength: 0, maxLength: 500 }
  }
};

const opsRejectBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["note"],
  properties: {
    note: { type: "string", minLength: 4, maxLength: 500 }
  }
};

const opsResolveReportBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    dismiss: { type: "boolean" },
    note: { type: "string", minLength: 0, maxLength: 500 }
  }
};

export async function registerOpsPlazaRoutes(app) {
  app.get(
    "/api/ops/plaza/reviews",
    {
      schema: {
        hide: true,
        tags: ["system"],
        querystring: opsListQuerySchema,
        response: { 200: { type: "object", additionalProperties: true } }
      }
    },
    async (request) => listPlazaHumanReviewQueue(request.query ?? {})
  );

  app.post(
    "/api/ops/plaza/posts/:postId/approve",
    {
      schema: {
        hide: true,
        tags: ["system"],
        params: uuidParams("postId"),
        body: opsNoteBodySchema,
        response: { 200: { type: "object", additionalProperties: true } }
      }
    },
    async (request, reply) => {
      try {
        return await opsApprovePlazaPost(request.params.postId, { note: request.body?.note });
      } catch (error) {
        if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
        throw error;
      }
    }
  );

  app.post(
    "/api/ops/plaza/posts/:postId/reject",
    {
      schema: {
        hide: true,
        tags: ["system"],
        params: uuidParams("postId"),
        body: opsRejectBodySchema,
        response: { 200: { type: "object", additionalProperties: true } }
      }
    },
    async (request, reply) => {
      try {
        return await opsRejectPlazaPost(request.params.postId, { note: request.body?.note });
      } catch (error) {
        if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
        throw error;
      }
    }
  );

  app.post(
    "/api/ops/plaza/reports/:reportId/resolve",
    {
      schema: {
        hide: true,
        tags: ["system"],
        params: uuidParams("reportId"),
        body: opsResolveReportBodySchema,
        response: { 200: { type: "object", additionalProperties: true } }
      }
    },
    async (request, reply) => {
      try {
        return await opsResolvePlazaReport(request.params.reportId, {
          dismiss: Boolean(request.body?.dismiss),
          note: request.body?.note
        });
      } catch (error) {
        if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
        throw error;
      }
    }
  );
}
