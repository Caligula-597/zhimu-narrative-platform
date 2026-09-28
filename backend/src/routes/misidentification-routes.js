// Misidentification Editor — REST routes
// Misidentification register CRUD (mistaken beliefs bound to evidence).

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import {
  listMisidentifications,
  getMisidentification,
  createMisidentification,
  updateMisidentification,
  deleteMisidentification
} from "../misidentification-service.js";
import {
  listMisidentificationsSchema,
  getMisidentificationSchema,
  createMisidentificationSchema,
  updateMisidentificationSchema,
  deleteMisidentificationSchema
} from "./schemas/misidentification.js";

export async function registerMisidentificationRoutes(app) {
  // ── List (with optional act / active filter) ──
  app.get("/api/worlds/:worldId/misidentifications", {
    schema: listMisidentificationsSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return listMisidentifications(worldId, request.query);
  });

  // ── Get single ──
  app.get("/api/worlds/:worldId/misidentifications/:misId", {
    schema: getMisidentificationSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, misId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    const item = await getMisidentification(worldId, misId);
    if (!item) return sendErr("NOT_FOUND", "Misidentification not found");
    return item;
  });

  // ── Create ──
  app.post("/api/worlds/:worldId/misidentifications", {
    schema: createMisidentificationSchema
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    const item = await createMisidentification(worldId, request.body);
    return reply.code(201).send(item);
  });

  // ── Update ──
  app.patch("/api/worlds/:worldId/misidentifications/:misId", {
    schema: updateMisidentificationSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, misId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    const item = await updateMisidentification(worldId, misId, request.body);
    if (!item) return sendErr("NOT_FOUND", "Misidentification not found");
    return item;
  });

  // ── Delete ──
  app.delete("/api/worlds/:worldId/misidentifications/:misId", {
    schema: deleteMisidentificationSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, misId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return deleteMisidentification(worldId, misId);
  });
}