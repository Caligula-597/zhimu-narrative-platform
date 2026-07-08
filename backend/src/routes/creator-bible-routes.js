/**
 * Creator bible routes — structural story objects (summary + CRUD).
 */
import {
  normalizeCoreTrickBody,
  normalizeForeshadowBody,
  normalizeRoleArchiveBody,
  normalizeTimelineEventBody
} from "../creator-bible-contract.js";
import {
  createForeshadowBeat,
  createTimelineEvent,
  deleteForeshadowBeat,
  deleteTimelineEvent,
  getCoreTrick,
  getRoleArchive,
  listForeshadowBeats,
  listRoleArchives,
  listTimelineEvents,
  loadBibleSummary,
  updateForeshadowBeat,
  updateTimelineEvent,
  upsertCoreTrick,
  upsertRoleArchive
} from "../creator-bible.js";
import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { requireWorldReader, requireWorldRole } from "./route-guards.js";
import {
  bibleBeatIdParams,
  bibleEventIdParams,
  bibleRoleSlotParams,
  patchCoreTrickSchema,
  patchRoleArchiveSchema,
  patchForeshadowBeatSchema,
  postForeshadowBeatSchema,
  postTimelineEventSchema,
  patchTimelineEventSchema,
  worldIdParams
} from "./schemas.js";

export async function registerCreatorBibleRoutes(app) {
  app.get("/api/worlds/:worldId/bible/summary", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    return loadBibleSummary(worldId);
  });

  app.get("/api/worlds/:worldId/bible/core-trick", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    return { coreTrick: await getCoreTrick(worldId) };
  });

  app.patch("/api/worlds/:worldId/bible/core-trick", { schema: patchCoreTrickSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = normalizeCoreTrickBody(request.body ?? {});
    const coreTrick = await upsertCoreTrick(worldId, body);
    return reply.send({ coreTrick });
  });

  app.get("/api/worlds/:worldId/bible/role-archives", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    return { archives: await listRoleArchives(worldId) };
  });

  app.get("/api/worlds/:worldId/bible/role-archives/:roleSlotId", { schema: { params: bibleRoleSlotParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldReader(actorId, worldId);
    const archive = await getRoleArchive(worldId, roleSlotId);
    if (!archive) return sendErr(reply, "NOT_FOUND");
    return { archive };
  });

  app.patch("/api/worlds/:worldId/bible/role-archives/:roleSlotId", { schema: patchRoleArchiveSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = normalizeRoleArchiveBody(request.body ?? {});
    const archive = await upsertRoleArchive(worldId, roleSlotId, body);
    return reply.send({ archive });
  });

  app.get("/api/worlds/:worldId/bible/foreshadow-beats", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    return { beats: await listForeshadowBeats(worldId) };
  });

  app.post("/api/worlds/:worldId/bible/foreshadow-beats", { schema: postForeshadowBeatSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = normalizeForeshadowBody(request.body ?? {});
    const beat = await createForeshadowBeat(worldId, body);
    return reply.code(201).send({ beat });
  });

  app.patch("/api/worlds/:worldId/bible/foreshadow-beats/:beatId", { schema: patchForeshadowBeatSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, beatId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = normalizeForeshadowBody(request.body ?? {});
    const beat = await updateForeshadowBeat(worldId, beatId, body);
    if (!beat) return sendErr(reply, "NOT_FOUND");
    return { beat };
  });

  app.delete("/api/worlds/:worldId/bible/foreshadow-beats/:beatId", { schema: { params: bibleBeatIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, beatId } = request.params;
    await requireWorldRole(actorId, worldId);
    const ok = await deleteForeshadowBeat(worldId, beatId);
    if (!ok) return sendErr(reply, "NOT_FOUND");
    return reply.code(204).send();
  });

  app.get("/api/worlds/:worldId/bible/timeline-events", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    return { events: await listTimelineEvents(worldId) };
  });

  app.post("/api/worlds/:worldId/bible/timeline-events", { schema: postTimelineEventSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = normalizeTimelineEventBody(request.body ?? {});
    const event = await createTimelineEvent(worldId, body);
    return reply.code(201).send({ event });
  });

  app.patch("/api/worlds/:worldId/bible/timeline-events/:eventId", { schema: patchTimelineEventSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, eventId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = normalizeTimelineEventBody(request.body ?? {});
    const event = await updateTimelineEvent(worldId, eventId, body);
    if (!event) return sendErr(reply, "NOT_FOUND");
    return { event };
  });

  app.delete("/api/worlds/:worldId/bible/timeline-events/:eventId", { schema: { params: bibleEventIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, eventId } = request.params;
    await requireWorldRole(actorId, worldId);
    const ok = await deleteTimelineEvent(worldId, eventId);
    if (!ok) return sendErr(reply, "NOT_FOUND");
    return reply.code(204).send();
  });
}
