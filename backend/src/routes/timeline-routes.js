// Timeline Editor — REST routes
// Multi-line parallel action timeline CRUD

import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { sendErr } from "../api-errors.js";
import {
  listTimelineEntries,
  getTimelineEntry,
  createTimelineEntry,
  updateTimelineEntry,
  deleteTimelineEntry,
  batchUpdateTimeline
} from "../timeline-service.js";
import {
  listTimelineEntriesSchema,
  getTimelineEntrySchema,
  createTimelineEntrySchema,
  updateTimelineEntrySchema,
  deleteTimelineEntrySchema,
  batchUpdateTimelineSchema
} from "./schemas/timeline.js";

export async function registerTimelineRoutes(app) {
  // ── List entries (with optional act filter) ──
  app.get("/api/worlds/:worldId/timeline", {
    schema: listTimelineEntriesSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return listTimelineEntries(worldId, request.query);
  });

  // ── Get single entry ──
  app.get("/api/worlds/:worldId/timeline/:entryId", {
    schema: getTimelineEntrySchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, entryId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return getTimelineEntry(worldId, entryId);
  });

  // ── Create entry ──
  app.post("/api/worlds/:worldId/timeline", {
    schema: createTimelineEntrySchema
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    const entry = await createTimelineEntry(worldId, request.body);
    return reply.code(201).send(entry);
  });

  // ── Update entry ──
  app.patch("/api/worlds/:worldId/timeline/:entryId", {
    schema: updateTimelineEntrySchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, entryId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return updateTimelineEntry(worldId, entryId, request.body);
  });

  // ── Delete entry ──
  app.delete("/api/worlds/:worldId/timeline/:entryId", {
    schema: deleteTimelineEntrySchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId, entryId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return deleteTimelineEntry(worldId, entryId);
  });

  // ── Batch update (reorder, re-line) ──
  app.patch("/api/worlds/:worldId/timeline/batch", {
    schema: batchUpdateTimelineSchema
  }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, "editor");
    return batchUpdateTimeline(worldId, request.body.entries);
  });
}