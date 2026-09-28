// Economic System Editor — REST routes (经济系统)

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import {
  listEconRecords,
  getEconRecord,
  createEconRecord,
  updateEconRecord,
  deleteEconRecord
} from "../econ-service.js";
import {
  listSchema,
  getSchema,
  createSchema,
  updateSchema,
  deleteSchema
} from "./schemas/econ.js";

async function requireEditor(request) {
  const actorId = requireActor(request);
  const { worldId } = request.params;
  await requireWorldRole(actorId, worldId, "editor");
  return worldId;
}

export async function registerEconRoutes(app) {
  app.get("/api/worlds/:worldId/econ-records", {
    schema: listSchema
  }, async (request) => {
    const worldId = await requireEditor(request);
    return listEconRecords(worldId);
  });

  app.get("/api/worlds/:worldId/econ-records/:id", {
    schema: getSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const record = await getEconRecord(worldId, request.params.id);
    if (!record) return sendErr(reply, "NOT_FOUND", "Economic record not found");
    return record;
  });

  app.post("/api/worlds/:worldId/econ-records", {
    schema: createSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const record = await createEconRecord(worldId, request.body);
    return reply.code(201).send(record);
  });

  app.patch("/api/worlds/:worldId/econ-records/:id", {
    schema: updateSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const record = await updateEconRecord(worldId, request.params.id, request.body);
    if (!record) return sendErr(reply, "NOT_FOUND", "Economic record not found");
    return record;
  });

  app.delete("/api/worlds/:worldId/econ-records/:id", {
    schema: deleteSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    try {
      return await deleteEconRecord(worldId, request.params.id);
    } catch (error) {
      if (error?.code === "NOT_FOUND") return sendErr(reply, "NOT_FOUND", "Economic record not found");
      throw error;
    }
  });
}