// Relationship Arc Editor — REST routes

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import {
  listRelationshipArcs,
  getRelationshipArc,
  createRelationshipArc,
  updateRelationshipArc,
  deleteRelationshipArc
} from "../relationship-arc-service.js";
import {
  listRelationshipArcsSchema,
  getRelationshipArcSchema,
  createRelationshipArcSchema,
  updateRelationshipArcSchema,
  deleteRelationshipArcSchema
} from "./schemas/relationship-arc.js";

export async function registerRelationshipArcRoutes(app) {
  // ── List ──
  app.get("/api/worlds/:worldId/relationship-arcs", {
    schema: listRelationshipArcsSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return listRelationshipArcs(worldId, request.query);
  });

  // ── Get single ──
  app.get("/api/worlds/:worldId/relationship-arcs/:arcId", {
    schema: getRelationshipArcSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, arcId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    const arc = await getRelationshipArc(worldId, arcId);
    if (!arc) return sendErr("NOT_FOUND", "Relationship arc not found");
    return arc;
  });

  // ── Create ──
  app.post("/api/worlds/:worldId/relationship-arcs", {
    schema: createRelationshipArcSchema
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    const arc = await createRelationshipArc(worldId, request.body);
    return reply.code(201).send(arc);
  });

  // ── Update ──
  app.patch("/api/worlds/:worldId/relationship-arcs/:arcId", {
    schema: updateRelationshipArcSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, arcId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    const arc = await updateRelationshipArc(worldId, arcId, request.body);
    if (!arc) return sendErr("NOT_FOUND", "Relationship arc not found");
    return arc;
  });

  // ── Delete ──
  app.delete("/api/worlds/:worldId/relationship-arcs/:arcId", {
    schema: deleteRelationshipArcSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, arcId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return deleteRelationshipArc(worldId, arcId);
  });
}