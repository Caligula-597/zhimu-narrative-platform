/**
 * B-batch routes — in-room player experience features.
 *
 * Scope: player tasks, suspicions, testimonies, world tags, segment remedies.
 * Platform runtime models (segments, votes, truth chain) are in content-platform-routes.js.
 * See docs/CONTENT_PLATFORM_ROUTE_BOUNDARIES_ZH.md.
 */
import { requireActor } from "../request-actor.js";
import { requireRoomRole, requireWorldRole } from "./route-guards.js";
import { sendErr, throwErr } from "../api-errors.js";
import { transactionWithEvents } from "../transaction-events.js";
import { runRevisionMutation } from "../world-revision.js";
import {
  getRoomSegmentRemedies,
  getRoomSuspicionsForHost,
  getRoomTestimoniesForHost,
  savePlayerSuspicion,
  saveTestimonyReview
} from "../batch-b-service.js";
import {
  roomIdParams,
  worldIdParams,
  roomPlayerTaskParams,
  upsertPlayerSuspicionSchema,
  submitTestimonySchema,
  reviewTestimonySchema,
  replaceWorldTagsSchema,
  createSegmentRemedySchema,
  roomSegmentRemedyParams,
  worldSegmentRemedyParams
} from "./schemas.js";
import {
  completePlayerTask,
  fetchPlayerTasksForRoom,
  listWorldPlayerTasks,
  resolveCurrentActKey
} from "../player-tasks.js";
import { fetchPlayerSuspicions } from "../player-suspicions.js";
import {
  fetchMyTestimonies,
  submitTestimony
} from "../testimonies.js";
import {
  attachTagsToWorldRows,
  buildCatalogTagFilterSql,
  listCatalogTagFacets,
  listWorldTags,
  parseCatalogTagFilters,
  replaceWorldTags
} from "../world-tags.js";
import {
  applySegmentRemedy,
  createSegmentRemedy,
  deleteSegmentRemedy,
  listSegmentRemedies,
  updateSegmentRemedy
} from "../segment-remedies.js";

async function requireHostMembership(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!["host", "cohost"].includes(membership.member_type)) throwErr("HOST_ROLE_REQUIRED");
  return membership;
}

async function requirePlayerRoleSlot(actorId, roomId) {
  const membership = await requireRoomRole(actorId, roomId);
  if (!membership.role_slot_id) throwErr("PLAYER_ROLE_REQUIRED");
  return membership;
}

export async function registerBatchBRoutes(app) {
  app.post("/api/rooms/:roomId/player-tasks/:taskId/complete", { schema: { params: roomPlayerTaskParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, taskId } = request.params;
    const membership = await requirePlayerRoleSlot(actorId, roomId);
    const progress = await transactionWithEvents(async (client, queueEvent) => {
      const row = await completePlayerTask(client.query.bind(client), {
        roomId,
        roleSlotId: membership.role_slot_id,
        taskId
      });
      queueEvent(roomId, "room.player_task_completed", { taskId, roleSlotId: membership.role_slot_id });
      return row;
    });
    return { ok: true, progress };
  });

  app.put("/api/rooms/:roomId/suspicions/:targetRoleSlotId", { schema: upsertPlayerSuspicionSchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, targetRoleSlotId } = request.params;
    const membership = await requirePlayerRoleSlot(actorId, roomId);
    const row = await savePlayerSuspicion({
      roomId,
      observerRoleSlotId: membership.role_slot_id,
      targetRoleSlotId,
      level: request.body?.level,
      reason: request.body?.reason
    });
    return { ok: true, suspicion: row };
  });

  app.post("/api/rooms/:roomId/testimonies", { schema: submitTestimonySchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    const membership = await requirePlayerRoleSlot(actorId, roomId);
    const testimony = await transactionWithEvents(async (client, queueEvent) => {
      const row = await submitTestimony(client.query.bind(client), {
        roomId,
        roleSlotId: membership.role_slot_id,
        actKey: request.body?.actKey ?? request.body?.act_key,
        body: request.body?.body
      });
      queueEvent(roomId, "room.testimony_submitted", {
        testimonyId: row.id,
        roleSlotId: membership.role_slot_id
      });
      return row;
    });
    return { ok: true, testimony };
  });

  app.get("/api/rooms/:roomId/host/testimonies", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const items = await getRoomTestimoniesForHost(roomId);
    return { items };
  });

  app.patch("/api/rooms/:roomId/host/testimonies/:testimonyId", { schema: reviewTestimonySchema }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, testimonyId } = request.params;
    await requireHostMembership(actorId, roomId);
    const testimony = await saveTestimonyReview({
      testimonyId,
      roomId,
      reviewerId: actorId,
      hostFlag: request.body?.hostFlag ?? request.body?.host_flag,
      hostNote: request.body?.hostNote ?? request.body?.host_note
    });
    return { ok: true, testimony };
  });

  app.get("/api/rooms/:roomId/host/suspicions", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const items = await getRoomSuspicionsForHost(roomId);
    return { items };
  });

  app.get("/api/worlds/:worldId/tags", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "reviewer", "host", "viewer"]);
    const tags = await listWorldTags(worldId);
    return { tags };
  });

  app.put("/api/worlds/:worldId/tags", { schema: replaceWorldTagsSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor"]);
    return runRevisionMutation(request, reply, worldId, async (client) => ({
      tags: await replaceWorldTags(worldId, request.body?.tags || [], client.query.bind(client))
    }), { sendErr });
  });

  app.get("/api/worlds/catalog/tag-facets", async () => {
    const facets = await listCatalogTagFacets();
    return { facets };
  });

  app.get("/api/worlds/:worldId/segment-remedies", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "reviewer"]);
    const segmentKey = request.query?.segmentKey || request.query?.segment_key || null;
    const items = await listSegmentRemedies(worldId, segmentKey);
    return { items };
  });

  app.post("/api/worlds/:worldId/segment-remedies", { schema: createSegmentRemedySchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor"]);
    return runRevisionMutation(request, reply, worldId, async (client) => ({
      item: await createSegmentRemedy(worldId, request.body ?? {}, client.query.bind(client))
    }), { sendErr, statusCode: 201 });
  });

  app.patch("/api/worlds/:worldId/segment-remedies/:remedyId", { schema: { params: worldSegmentRemedyParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, remedyId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor"]);
    return runRevisionMutation(request, reply, worldId, async (client) => ({
      item: await updateSegmentRemedy(remedyId, worldId, request.body ?? {}, client.query.bind(client))
    }), { sendErr });
  });

  app.delete("/api/worlds/:worldId/segment-remedies/:remedyId", { schema: { params: worldSegmentRemedyParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, remedyId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor"]);
    return runRevisionMutation(request, reply, worldId, async (client) =>
      deleteSegmentRemedy(remedyId, worldId, client.query.bind(client)), { sendErr });
  });

  app.get("/api/rooms/:roomId/host/segment-remedies", { schema: { params: roomIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId } = request.params;
    await requireHostMembership(actorId, roomId);
    const segmentKey = request.query?.segmentKey || request.query?.segment_key || null;
    const items = await getRoomSegmentRemedies(roomId, segmentKey);
    return { items };
  });

  app.post("/api/rooms/:roomId/host/segment-remedies/:remedyId/apply", { schema: { params: roomSegmentRemedyParams } }, async (request) => {
    const actorId = requireActor(request);
    const { roomId, remedyId } = request.params;
    await requireHostMembership(actorId, roomId);
    const remedy = await transactionWithEvents(async (client, queueEvent) => {
      const row = await applySegmentRemedy(client.query.bind(client), { roomId, remedyId, hostUserId: actorId });
      queueEvent(roomId, "room.segment_remedy_applied", {
        remedyId: row.id,
        segmentKey: row.segment_key,
        title: row.title
      });
      return row;
    });
    return { ok: true, remedy };
  });
}

export {
  resolveCurrentActKey,
  fetchPlayerTasksForRoom,
  fetchPlayerSuspicions,
  fetchMyTestimonies,
  attachTagsToWorldRows,
  buildCatalogTagFilterSql,
  parseCatalogTagFilters,
  listWorldPlayerTasks
};
