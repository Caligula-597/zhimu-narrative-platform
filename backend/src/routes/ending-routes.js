// Ending Branch Editor — REST routes

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import {
  listEndings,
  getEnding,
  createEnding,
  updateEnding,
  deleteEnding
} from "../ending-service.js";
import {
  listEndingsSchema,
  getEndingSchema,
  createEndingSchema,
  updateEndingSchema,
  deleteEndingSchema
} from "./schemas/ending.js";

export async function registerEndingRoutes(app) {
  app.get("/api/worlds/:worldId/endings", {
    schema: listEndingsSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return listEndings(worldId, request.query);
  });

  app.get("/api/worlds/:worldId/endings/:endingId", {
    schema: getEndingSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, endingId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    const ending = await getEnding(worldId, endingId);
    if (!ending) return sendErr("NOT_FOUND", "Ending not found");
    return ending;
  });

  app.post("/api/worlds/:worldId/endings", {
    schema: createEndingSchema
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    const ending = await createEnding(worldId, request.body);
    return reply.code(201).send(ending);
  });

  app.patch("/api/worlds/:worldId/endings/:endingId", {
    schema: updateEndingSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, endingId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    const ending = await updateEnding(worldId, endingId, request.body);
    if (!ending) return sendErr("NOT_FOUND", "Ending not found");
    return ending;
  });

  app.delete("/api/worlds/:worldId/endings/:endingId", {
    schema: deleteEndingSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, endingId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return deleteEnding(worldId, endingId);
  });
}