// Historical Causality Table — REST routes (缺口 H)

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import {
  listHistoryCausalLinks,
  getHistoryCausalLink,
  createHistoryCausalLink,
  updateHistoryCausalLink,
  deleteHistoryCausalLink
} from "../history-causal-service.js";
import {
  listSchema,
  getSchema,
  createSchema,
  updateSchema,
  deleteSchema
} from "./schemas/history-causal.js";

async function requireEditor(request) {
  const actorId = requireActor(request);
  const { worldId } = request.params;
  await requireWorldRole(actorId, worldId, "editor");
  return worldId;
}

export async function registerHistoryCausalRoutes(app) {
  app.get("/api/worlds/:worldId/history-causal-links", {
    schema: listSchema
  }, async (request) => {
    const worldId = await requireEditor(request);
    return listHistoryCausalLinks(worldId);
  });

  app.get("/api/worlds/:worldId/history-causal-links/:id", {
    schema: getSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const link = await getHistoryCausalLink(worldId, request.params.id);
    if (!link) return sendErr(reply, "NOT_FOUND", "History causal link not found");
    return link;
  });

  app.post("/api/worlds/:worldId/history-causal-links", {
    schema: createSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const link = await createHistoryCausalLink(worldId, request.body);
    return reply.code(201).send(link);
  });

  app.patch("/api/worlds/:worldId/history-causal-links/:id", {
    schema: updateSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const link = await updateHistoryCausalLink(worldId, request.params.id, request.body);
    if (!link) return sendErr(reply, "NOT_FOUND", "History causal link not found");
    return link;
  });

  app.delete("/api/worlds/:worldId/history-causal-links/:id", {
    schema: deleteSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    try {
      return await deleteHistoryCausalLink(worldId, request.params.id);
    } catch (error) {
      if (error?.code === "NOT_FOUND") return sendErr(reply, "NOT_FOUND", "History causal link not found");
      throw error;
    }
  });
}