// Location / Scene-State Enhancement — REST routes (地点/现场状态增强)

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import {
  listLocLocations,
  getLocLocation,
  createLocLocation,
  updateLocLocation,
  deleteLocLocation
} from "../location-state-service.js";
import {
  listSchema,
  getSchema,
  createSchema,
  updateSchema,
  deleteSchema
} from "./schemas/location-state.js";

async function requireEditor(request) {
  const actorId = requireActor(request);
  const { worldId } = request.params;
  await requireWorldRole(actorId, worldId, "editor");
  return worldId;
}

export async function registerLocationStateRoutes(app) {
  app.get("/api/worlds/:worldId/loc-locations", {
    schema: listSchema
  }, async (request) => {
    const worldId = await requireEditor(request);
    return listLocLocations(worldId);
  });

  app.get("/api/worlds/:worldId/loc-locations/:id", {
    schema: getSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const loc = await getLocLocation(worldId, request.params.id);
    if (!loc) return sendErr(reply, "NOT_FOUND", "Location not found");
    return loc;
  });

  app.post("/api/worlds/:worldId/loc-locations", {
    schema: createSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const loc = await createLocLocation(worldId, request.body);
    return reply.code(201).send(loc);
  });

  app.patch("/api/worlds/:worldId/loc-locations/:id", {
    schema: updateSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    const loc = await updateLocLocation(worldId, request.params.id, request.body);
    if (!loc) return sendErr(reply, "NOT_FOUND", "Location not found");
    return loc;
  });

  app.delete("/api/worlds/:worldId/loc-locations/:id", {
    schema: deleteSchema
  }, async (request, reply) => {
    const worldId = await requireEditor(request);
    try {
      return await deleteLocLocation(worldId, request.params.id);
    } catch (error) {
      if (error?.code === "NOT_FOUND") return sendErr(reply, "NOT_FOUND", "Location not found");
      throw error;
    }
  });
}