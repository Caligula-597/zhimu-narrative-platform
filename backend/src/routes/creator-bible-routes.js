/**
 * Creator bible routes —structural story objects (summary + CRUD).
 */
import {
  normalizeCoreTrickBody,
  normalizeCoreTrickPatch,
  normalizeForeshadowBody,
  normalizeForeshadowPatch,
  normalizeRoleArchiveBody,
  normalizeRoleArchivePatch,
  normalizeTimelineEventBody,
  normalizeTimelineEventPatch
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
import { sendErr, throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { runRevisionMutation } from "../world-revision.js";
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
    await requireWorldRole(actorId, worldId);
    return loadBibleSummary(worldId);
  });

  app.get("/api/worlds/:worldId/bible/core-trick", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return { coreTrick: await getCoreTrick(worldId) };
  });

  app.patch("/api/worlds/:worldId/bible/core-trick", { schema: patchCoreTrickSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = normalizeCoreTrickPatch(request.body ?? {});
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const coreTrick = await upsertCoreTrick(worldId, body, { patch: true, client });
      return { coreTrick };
    }, { sendErr });
  });

  app.get("/api/worlds/:worldId/bible/role-archives", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return { archives: await listRoleArchives(worldId) };
  });

  app.get("/api/worlds/:worldId/bible/role-archives/:roleSlotId", { schema: { params: bibleRoleSlotParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const archive = await getRoleArchive(worldId, roleSlotId);
    if (!archive) return sendErr(reply, "NOT_FOUND");
    return { archive };
  });

  app.patch("/api/worlds/:worldId/bible/role-archives/:roleSlotId", { schema: patchRoleArchiveSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = normalizeRoleArchivePatch(request.body ?? {});
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const archive = await upsertRoleArchive(worldId, roleSlotId, body, { patch: true, client });
      return { archive };
    }, { sendErr });
  });

  app.get("/api/worlds/:worldId/bible/foreshadow-beats", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return { beats: await listForeshadowBeats(worldId) };
  });

  app.post("/api/worlds/:worldId/bible/foreshadow-beats", { schema: postForeshadowBeatSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = normalizeForeshadowBody(request.body ?? {});
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const beat = await createForeshadowBeat(worldId, body, client);
      return { beat };
    }, { sendErr, statusCode: 201 });
  });

  app.patch("/api/worlds/:worldId/bible/foreshadow-beats/:beatId", { schema: patchForeshadowBeatSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, beatId } = request.params;
    await requireWorldRole(actorId, worldId);
    const patch = normalizeForeshadowPatch(request.body ?? {});
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const beat = await updateForeshadowBeat(worldId, beatId, patch, client);
      if (!beat) throwErr("NOT_FOUND");
      return { beat };
    }, { sendErr });
  });

  app.delete("/api/worlds/:worldId/bible/foreshadow-beats/:beatId", { schema: { params: bibleBeatIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, beatId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const ok = await deleteForeshadowBeat(worldId, beatId, client);
      if (!ok) throwErr("NOT_FOUND");
      return { ok: true };
    }, { sendErr });
  });

  app.get("/api/worlds/:worldId/bible/timeline-events", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return { events: await listTimelineEvents(worldId) };
  });

  app.post("/api/worlds/:worldId/bible/timeline-events", { schema: postTimelineEventSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = normalizeTimelineEventBody(request.body ?? {});
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const event = await createTimelineEvent(worldId, body, client);
      return { event };
    }, { sendErr, statusCode: 201 });
  });

  app.patch("/api/worlds/:worldId/bible/timeline-events/:eventId", { schema: patchTimelineEventSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, eventId } = request.params;
    await requireWorldRole(actorId, worldId);
    const patch = normalizeTimelineEventPatch(request.body ?? {});
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const event = await updateTimelineEvent(worldId, eventId, patch, client);
      if (!event) throwErr("NOT_FOUND");
      return { event };
    }, { sendErr });
  });

  app.delete("/api/worlds/:worldId/bible/timeline-events/:eventId", { schema: { params: bibleEventIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, eventId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const ok = await deleteTimelineEvent(worldId, eventId, client);
      if (!ok) throwErr("NOT_FOUND");
      return { ok: true };
    }, { sendErr });
  });
}
