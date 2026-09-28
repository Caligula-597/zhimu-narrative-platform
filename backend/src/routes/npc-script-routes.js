// NPC Script Editor — REST routes (NPC 专属内容)

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import {
  listNpcs,
  getNpc,
  createNpc,
  updateNpc,
  deleteNpc
} from "../npc-script-service.js";
import {
  listSchema,
  getSchema,
  createSchema,
  updateSchema,
  deleteSchema
} from "./schemas/npc-script.js";

async function requireEditor(request) {
  const actorId = requireActor(request);
  const { worldId } = request.params;
  await requireWorldRole(actorId, worldId, "editor");
  return worldId;
}

export async function registerNpcScriptRoutes(app) {
  app.get("/api/worlds/:worldId/npcs", {
    schema: listSchema
  }, async (request) => {
    const worldId = await requireEditor(request);
    return listNpcs(worldId);
  });

  app.get("/api/worlds/:worldId/npcs/:id", {
    schema: getSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const npc = await getNpc(worldId, request.params.id);
    if (!npc) return sendErr(reply, "NOT_FOUND", "NPC not found");
    return npc;
  });

  app.post("/api/worlds/:worldId/npcs", {
    schema: createSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const npc = await createNpc(worldId, request.body);
    return reply.code(201).send(npc);
  });

  app.patch("/api/worlds/:worldId/npcs/:id", {
    schema: updateSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const npc = await updateNpc(worldId, request.params.id, request.body);
    if (!npc) return sendErr(reply, "NOT_FOUND", "NPC not found");
    return npc;
  });

  app.delete("/api/worlds/:worldId/npcs/:id", {
    schema: deleteSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    try {
      return await deleteNpc(worldId, request.params.id);
    } catch (error) {
      if (error?.code === "NOT_FOUND") return sendErr(reply, "NOT_FOUND", "NPC not found");
      throw error;
    }
  });
}