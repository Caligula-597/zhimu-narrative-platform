// Object Lifecycle Editor — REST routes (缺口7)

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import {
  listObjectLifecycles,
  getObjectLifecycle,
  createObjectLifecycle,
  updateObjectLifecycle,
  deleteObjectLifecycle
} from "../object-lifecycle-service.js";
import {
  listSchema,
  getSchema,
  createSchema,
  updateSchema,
  deleteSchema
} from "./schemas/object-lifecycle.js";

async function requireEditor(request) {
  const actorId = requireActor(request);
  const { worldId } = request.params;
  await requireWorldRole(actorId, worldId, "editor");
  return worldId;
}

export async function registerObjectLifecycleRoutes(app) {
  app.get("/api/worlds/:worldId/object-lifecycles", {
    schema: listSchema
  }, async (request) => {
    const worldId = await requireEditor(request);
    return listObjectLifecycles(worldId);
  });

  app.get("/api/worlds/:worldId/object-lifecycles/:id", {
    schema: getSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const lifecycle = await getObjectLifecycle(worldId, request.params.id);
    if (!lifecycle) return sendErr(reply, "NOT_FOUND", "Object lifecycle not found");
    return lifecycle;
  });

  app.post("/api/worlds/:worldId/object-lifecycles", {
    schema: createSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const lifecycle = await createObjectLifecycle(worldId, request.body);
    return reply.code(201).send(lifecycle);
  });

  app.patch("/api/worlds/:worldId/object-lifecycles/:id", {
    schema: updateSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const lifecycle = await updateObjectLifecycle(worldId, request.params.id, request.body);
    if (!lifecycle) return sendErr(reply, "NOT_FOUND", "Object lifecycle not found");
    return lifecycle;
  });

  app.delete("/api/worlds/:worldId/object-lifecycles/:id", {
    schema: deleteSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    try {
      return await deleteObjectLifecycle(worldId, request.params.id);
    } catch (error) {
      if (error?.code === "NOT_FOUND") return sendErr(reply, "NOT_FOUND", "Object lifecycle not found");
      throw error;
    }
  });
}