/**
 * Creator bible routes —structural story objects (summary + CRUD).
 */
import {
  normalizeCoreTrickBody,
  normalizeCoreTrickPatch,
  normalizeForeshadowBody,
  normalizeForeshadowPatch,
  normalizeMaterialBookletBody,
  normalizeMaterialBookletPatch,
  normalizeRoleArchiveBody,
  normalizeRoleArchivePatch,
  normalizeTimelineEventBody,
  normalizeTimelineEventPatch
} from "../creator-bible-contract.js";
import {
  createForeshadowBeat,
  createMaterialBooklet,
  createTimelineEvent,
  deleteForeshadowBeat,
  deleteMaterialBooklet,
  deleteTimelineEvent,
  getCoreTrick,
  getRoleArchive,
  listForeshadowBeats,
  listMaterialBooklets,
  listRoleArchives,
  listTimelineEvents,
  loadBibleSummary,
  updateForeshadowBeat,
  updateMaterialBooklet,
  updateTimelineEvent,
  upsertCoreTrick,
  upsertRoleArchive
} from "../creator-bible.js";
import { loadHandbookDigest } from "../creator-handbook-digest.js";
import { sendErr, throwErr } from "../api-errors.js";
import { query } from "../db.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole, WORLD_CREATOR_READER_ROLES } from "./route-guards.js";
import { runRevisionMutation } from "../world-revision.js";
import {
  bibleBeatIdParams,
  bibleBookletIdParams,
  bibleEventIdParams,
  bibleRoleSlotParams,
  patchCoreTrickSchema,
  patchRoleArchiveSchema,
  patchForeshadowBeatSchema,
  patchMaterialBookletSchema,
  postForeshadowBeatSchema,
  postMaterialBookletSchema,
  postTimelineEventSchema,
  patchTimelineEventSchema,
  worldIdParams
} from "./schemas.js";

export async function registerCreatorBibleRoutes(app) {
  app.get("/api/worlds/:worldId/bible/handbook-manuscript", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    const result = await query(`SELECT settings FROM worlds WHERE id = $1`, [worldId]);
    if (!result.rowCount) throwErr("WORLD_NOT_FOUND");
    const hostHandbook = result.rows[0].settings?.hostHandbook || {};
    return {
      manuscript: String(hostHandbook.manuscript || ""),
      flowNotes: Array.isArray(hostHandbook.flowNotes) ? hostHandbook.flowNotes : [],
      updatedAt: hostHandbook.updatedAt || null
    };
  });

  app.patch("/api/worlds/:worldId/bible/handbook-manuscript", {
    schema: {
      params: worldIdParams,
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          manuscript: { type: "string", maxLength: 120000 }
        },
        required: ["manuscript"]
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const manuscript = String(request.body?.manuscript ?? "");
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const current = await client.query(`SELECT settings FROM worlds WHERE id = $1 FOR UPDATE`, [worldId]);
      if (!current.rowCount) throwErr("WORLD_NOT_FOUND");
      const settings = current.rows[0].settings || {};
      const hostHandbook = {
        ...(settings.hostHandbook || {}),
        manuscript,
        updatedAt: new Date().toISOString()
      };
      const result = await client.query(
        `UPDATE worlds
         SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('hostHandbook', $2::jsonb),
             updated_at = now()
         WHERE id = $1
         RETURNING settings`,
        [worldId, JSON.stringify(hostHandbook)]
      );
      return {
        manuscript: result.rows[0].settings?.hostHandbook?.manuscript || "",
        updatedAt: result.rows[0].settings?.hostHandbook?.updatedAt || null
      };
    }, { sendErr });
  });

  app.get("/api/worlds/:worldId/bible/summary", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    return loadBibleSummary(worldId);
  });

  app.get("/api/worlds/:worldId/bible/handbook-digest", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    return loadHandbookDigest(worldId);
  });

  app.get("/api/worlds/:worldId/bible/endings", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    const digest = await loadHandbookDigest(worldId);
    return { endings: digest.endings || [], flowNotes: digest.flowNotes || [] };
  });

  app.patch("/api/worlds/:worldId/bible/endings", {
    schema: {
      params: worldIdParams,
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          endings: {
            type: "array",
            maxItems: 12,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                key: { type: "string", maxLength: 80 },
                title: { type: "string", maxLength: 120 },
                summary: { type: "string", maxLength: 8000 },
                routeHint: { type: "string", maxLength: 240 }
              }
            }
          },
          flowNotes: {
            type: "array",
            maxItems: 24,
            items: { type: "string", maxLength: 400 }
          }
        }
      }
    }
  }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const endings = Array.isArray(request.body?.endings) ? request.body.endings : [];
    const flowNotes = Array.isArray(request.body?.flowNotes) ? request.body.flowNotes : undefined;
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const current = await client.query(`SELECT settings FROM worlds WHERE id = $1 FOR UPDATE`, [worldId]);
      if (!current.rowCount) throwErr("WORLD_NOT_FOUND");
      const settings = current.rows[0].settings || {};
      const hostHandbook = {
        ...(settings.hostHandbook || {}),
        endings,
        ...(flowNotes ? { flowNotes } : {}),
        updatedAt: new Date().toISOString()
      };
      const result = await client.query(
        `UPDATE worlds
         SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('hostHandbook', $2::jsonb),
             updated_at = now()
         WHERE id = $1
         RETURNING settings`,
        [worldId, JSON.stringify(hostHandbook)]
      );
      return { endings: result.rows[0].settings?.hostHandbook?.endings || [], flowNotes: result.rows[0].settings?.hostHandbook?.flowNotes || [] };
    }, { sendErr });
  });

  app.get("/api/worlds/:worldId/bible/core-trick", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
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
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    return { archives: await listRoleArchives(worldId) };
  });

  app.get("/api/worlds/:worldId/bible/role-archives/:roleSlotId", { schema: { params: bibleRoleSlotParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
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
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
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
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
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

  app.get("/api/worlds/:worldId/bible/material-booklets", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, WORLD_CREATOR_READER_ROLES);
    return { booklets: await listMaterialBooklets(worldId) };
  });

  app.post("/api/worlds/:worldId/bible/material-booklets", { schema: postMaterialBookletSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = normalizeMaterialBookletBody(request.body ?? {});
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const booklet = await createMaterialBooklet(worldId, body, client);
      return { booklet };
    }, { sendErr, statusCode: 201 });
  });

  app.patch("/api/worlds/:worldId/bible/material-booklets/:bookletId", { schema: patchMaterialBookletSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, bookletId } = request.params;
    await requireWorldRole(actorId, worldId);
    const patch = normalizeMaterialBookletPatch(request.body ?? {});
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const booklet = await updateMaterialBooklet(worldId, bookletId, patch, client);
      if (!booklet) throwErr("NOT_FOUND");
      return { booklet };
    }, { sendErr });
  });

  app.delete("/api/worlds/:worldId/bible/material-booklets/:bookletId", { schema: { params: bibleBookletIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, bookletId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const ok = await deleteMaterialBooklet(worldId, bookletId, client);
      if (!ok) throwErr("NOT_FOUND");
      return { ok: true };
    }, { sendErr });
  });
}
