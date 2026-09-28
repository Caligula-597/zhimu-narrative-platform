// Val Consistency Ledger — REST routes (一致性台账)

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import {
  listValRecords,
  getValRecord,
  createValRecord,
  updateValRecord,
  deleteValRecord
} from "../val-consistency-service.js";
import {
  listSchema,
  getSchema,
  createSchema,
  updateSchema,
  deleteSchema
} from "./schemas/val-consistency.js";

async function requireEditor(request) {
  const actorId = requireActor(request);
  const { worldId } = request.params;
  await requireWorldRole(actorId, worldId, "editor");
  return worldId;
}

export async function registerValConsistencyRoutes(app) {
  app.get("/api/worlds/:worldId/val-records", {
    schema: listSchema
  }, async (request) => {
    const worldId = await requireEditor(request);
    return listValRecords(worldId);
  });

  app.get("/api/worlds/:worldId/val-records/:id", {
    schema: getSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const record = await getValRecord(worldId, request.params.id);
    if (!record) return sendErr(reply, "NOT_FOUND", "Val record not found");
    return record;
  });

  app.post("/api/worlds/:worldId/val-records", {
    schema: createSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const record = await createValRecord(worldId, request.body);
    return reply.code(201).send(record);
  });

  app.patch("/api/worlds/:worldId/val-records/:id", {
    schema: updateSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const record = await updateValRecord(worldId, request.params.id, request.body);
    if (!record) return sendErr(reply, "NOT_FOUND", "Val record not found");
    return record;
  });

  app.delete("/api/worlds/:worldId/val-records/:id", {
    schema: deleteSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    try {
      return await deleteValRecord(worldId, request.params.id);
    } catch (error) {
      if (error?.code === "NOT_FOUND") return sendErr(reply, "NOT_FOUND", "Val record not found");
      throw error;
    }
  });
}