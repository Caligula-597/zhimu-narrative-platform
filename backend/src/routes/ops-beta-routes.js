import {
  approveBetaApplication,
  listBetaApplications,
  rejectBetaApplication
} from "../beta-apply.js";
import { sendErr } from "../api-errors.js";
import { betaApplicationIdParams } from "./schemas.js";

const betaApplicationListQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["pending", "approved", "rejected"] },
    limit: { type: "integer", minimum: 1, maximum: 200 },
    offset: { type: "integer", minimum: 0, maximum: 100_000 }
  }
};

const betaRejectBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["note"],
  properties: {
    note: { type: "string", minLength: 4, maxLength: 2000 }
  }
};

export async function registerOpsBetaRoutes(app) {
  app.get(
    "/api/ops/beta/applications",
    {
      schema: {
        hide: true,
        tags: ["system"],
        querystring: betaApplicationListQuerySchema,
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            properties: {
              items: { type: "array", items: { type: "object", additionalProperties: true } },
              total: { type: "integer" },
              limit: { type: "integer" },
              offset: { type: "integer" },
              status: { type: "string" }
            }
          }
        }
      }
    },
    async (request) => {
      const { status, limit, offset } = request.query ?? {};
      return listBetaApplications({ status: status || "pending", limit, offset });
    }
  );

  app.post(
    "/api/ops/beta/applications/:applicationId/approve",
    {
      schema: {
        hide: true,
        tags: ["system"],
        params: betaApplicationIdParams,
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            note: { type: "string", maxLength: 2000 }
          }
        },
        response: {
          200: {
            type: "object",
            additionalProperties: true
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const row = await approveBetaApplication(request.params.applicationId, request.body?.note);
        return row;
      } catch (error) {
        if (error.code && error.statusCode) {
          return sendErr(reply, error.code, error.message, error.details);
        }
        throw error;
      }
    }
  );

  app.post(
    "/api/ops/beta/applications/:applicationId/reject",
    {
      schema: {
        hide: true,
        tags: ["system"],
        params: betaApplicationIdParams,
        body: betaRejectBodySchema,
        response: {
          200: {
            type: "object",
            additionalProperties: true
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const row = await rejectBetaApplication(request.params.applicationId, request.body?.note);
        return row;
      } catch (error) {
        if (error.code && error.statusCode) {
          return sendErr(reply, error.code, error.message, error.details);
        }
        throw error;
      }
    }
  );
}
