import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import {
  activateUserLlmConnection,
  buildLlmAccountPayload,
  createUserLlmConnection,
  deleteUserLlmConnection,
  testUserLlmConnection,
  updateUserLlmConnection,
  upsertUserLlmPreferences
} from "../user-llm.js";

const connectionBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 80 },
    provider: { type: "string", enum: ["deepseek", "openai_compatible", "openai"] },
    baseUrl: { type: "string", minLength: 8, maxLength: 300 },
    model: { type: "string", minLength: 1, maxLength: 120 },
    apiKey: { type: "string", minLength: 8, maxLength: 500 },
    isActive: { type: "boolean" },
    enabled: { type: "boolean" }
  }
};

export async function registerAccountLlmRoutes(app) {
  app.get("/api/account/llm", async (request) => {
    const actorId = requireActor(request);
    return buildLlmAccountPayload(actorId);
  });

  app.put("/api/account/llm/preferences", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["routingMode"],
        properties: {
          routingMode: { type: "string", enum: ["prefer_own", "own_only", "platform_only"] }
        }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    try {
      const preferences = await upsertUserLlmPreferences(actorId, request.body ?? {});
      return { preferences };
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });

  app.post("/api/account/llm/connections", {
    schema: {
      body: {
        ...connectionBody,
        required: ["apiKey", "baseUrl", "model"]
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    try {
      const connection = await createUserLlmConnection(actorId, request.body ?? {});
      return reply.code(201).send({ connection });
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });

  app.put("/api/account/llm/connections/:connectionId", {
    schema: {
      params: {
        type: "object",
        required: ["connectionId"],
        properties: { connectionId: { type: "string", format: "uuid" } }
      },
      body: connectionBody
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    try {
      const connection = await updateUserLlmConnection(actorId, request.params.connectionId, request.body ?? {});
      return { connection };
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });

  app.delete("/api/account/llm/connections/:connectionId", {
    schema: {
      params: {
        type: "object",
        required: ["connectionId"],
        properties: { connectionId: { type: "string", format: "uuid" } }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    try {
      return await deleteUserLlmConnection(actorId, request.params.connectionId);
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });

  app.post("/api/account/llm/connections/:connectionId/activate", {
    schema: {
      params: {
        type: "object",
        required: ["connectionId"],
        properties: { connectionId: { type: "string", format: "uuid" } }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    try {
      const connection = await activateUserLlmConnection(actorId, request.params.connectionId);
      return { connection };
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });

  app.post("/api/account/llm/connections/:connectionId/test", {
    schema: {
      params: {
        type: "object",
        required: ["connectionId"],
        properties: { connectionId: { type: "string", format: "uuid" } }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    try {
      return await testUserLlmConnection(actorId, request.params.connectionId);
    } catch (error) {
      if (error.code && error.statusCode) return sendErr(reply, error.code, error.message, error.details);
      throw error;
    }
  });
}
