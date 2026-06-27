import { pool, query } from "../db.js";
import { requireActor } from "../request-actor.js";
import { sendErr, throwErr } from "../api-errors.js";
import { requireWorldRole, requireWorldReader } from "./route-guards.js";
import { buildWorldSnapshot, ROOMS_VISIBLE_TO_ACTOR_SQL, pruneBrokenAutomationRules, repairChapterSequencesIfNeeded } from "./world-helpers.js";
import { runRevisionMutation } from "../world-revision.js";
import {
  worldIdParams,
  createSceneSchema,
  createClueSchema,
  patchSceneSchema,
  patchClueSchema,
  patchInvestigationPointSchema,
  createInvestigationPointSchema,
  createItemSchema,
  patchItemSchema,
  deleteItemSchema,
  createContentVersionSchema,
  restoreContentVersionSchema,
  deleteContentVersionSchema,
  createStoryEdgeSchema
} from "./schemas.js";

export async function registerStudioRoutes(app) {
  app.post("/api/worlds/:worldId/scenes", { schema: createSceneSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText = "", hostText = "", chapterId = null, metadata = {} } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
        [worldId, chapterId, name, publicText, hostText, JSON.stringify(metadata)]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });

  app.post("/api/worlds/:worldId/clues", { schema: createClueSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText = "", hostText = "", visibility = "role", metadata = {} } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
        [worldId, name, publicText, hostText, visibility, JSON.stringify(metadata)]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });

  app.patch("/api/worlds/:worldId/scenes/:sceneId", { schema: patchSceneSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, sceneId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText, hostText, chapterId, metadata = {} } = request.body ?? {};
    if (name !== undefined && !String(name).trim()) return sendErr(reply, "NAME_EMPTY");
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const updated = await client.query(
        `UPDATE scenes
         SET name = COALESCE($3, name),
             public_text = COALESCE($4, public_text),
             host_text = COALESCE($5, host_text),
             chapter_id = CASE WHEN $6::text IS NULL THEN chapter_id ELSE NULLIF($6::text, '')::uuid END,
             metadata = COALESCE(metadata, '{}'::jsonb) || $7::jsonb
         WHERE id = $1 AND world_id = $2
         RETURNING id, chapter_id, name, public_text, host_text, metadata`,
        [
          sceneId,
          worldId,
          name?.trim() ?? null,
          publicText ?? null,
          hostText ?? null,
          chapterId === undefined ? null : (chapterId ?? ""),
          JSON.stringify(metadata)
        ]
      );
      if (!updated.rowCount) throwErr("SCENE_NOT_FOUND");
      return updated.rows[0];
    }, { sendErr });
  });

  app.patch("/api/worlds/:worldId/clues/:clueId", { schema: patchClueSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, clueId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText, hostText, visibility, metadata = {} } = request.body ?? {};
    if (name !== undefined && !String(name).trim()) return sendErr(reply, "NAME_EMPTY");
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const updated = await client.query(
        `UPDATE clues
         SET name = COALESCE($3, name),
             public_text = COALESCE($4, public_text),
             host_text = COALESCE($5, host_text),
             visibility = COALESCE($6, visibility),
             metadata = COALESCE(metadata, '{}'::jsonb) || $7::jsonb
         WHERE id = $1 AND world_id = $2
         RETURNING id, name, public_text, host_text, visibility, metadata`,
        [
          clueId,
          worldId,
          name?.trim() ?? null,
          publicText ?? null,
          hostText ?? null,
          visibility ?? null,
          JSON.stringify(metadata)
        ]
      );
      if (!updated.rowCount) throwErr("CLUE_NOT_FOUND");
      return updated.rows[0];
    }, { sendErr });
  });

  app.patch("/api/worlds/:worldId/investigation-points/:pointId", { schema: patchInvestigationPointSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, pointId } = request.params;
    await requireWorldRole(actorId, worldId);
    const {
      name, description, interactionText, resultText, sceneId, clueId,
      requiredItemId, requiredRoleSlotId, sequence, metadata = {}
    } = request.body ?? {};
    if (name !== undefined && !String(name).trim()) return sendErr(reply, "NAME_EMPTY");
    if (sceneId) {
      const scene = await query(`SELECT 1 FROM scenes WHERE id = $1 AND world_id = $2`, [sceneId, worldId]);
      if (!scene.rowCount) return sendErr(reply, "SCENE_WORLD_MISMATCH");
    }
    if (clueId) {
      const clue = await query(`SELECT 1 FROM clues WHERE id = $1 AND world_id = $2`, [clueId, worldId]);
      if (!clue.rowCount) return sendErr(reply, "CLUE_WORLD_MISMATCH");
    }
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const updated = await client.query(
        `UPDATE investigation_points
         SET name = COALESCE($3, name),
             description = COALESCE($4, description),
             interaction_text = COALESCE($5, interaction_text),
             result_text = COALESCE($6, result_text),
             scene_id = COALESCE($7::uuid, scene_id),
             clue_id = CASE WHEN $8::text IS NULL THEN clue_id ELSE NULLIF($8::text, '')::uuid END,
             required_item_id = CASE WHEN $9::text IS NULL THEN required_item_id ELSE NULLIF($9::text, '')::uuid END,
             required_role_slot_id = CASE WHEN $10::text IS NULL THEN required_role_slot_id ELSE NULLIF($10::text, '')::uuid END,
             sequence = COALESCE($11, sequence),
             metadata = COALESCE(metadata, '{}'::jsonb) || $12::jsonb
         WHERE id = $1 AND world_id = $2
         RETURNING id, scene_id, name, description, interaction_text, result_text, clue_id,
                  required_item_id, required_role_slot_id, sequence, metadata`,
        [
          pointId,
          worldId,
          name?.trim() ?? null,
          description ?? null,
          interactionText ?? null,
          resultText ?? null,
          sceneId ?? null,
          clueId === undefined ? null : (clueId ?? ""),
          requiredItemId === undefined ? null : (requiredItemId ?? ""),
          requiredRoleSlotId === undefined ? null : (requiredRoleSlotId ?? ""),
          sequence ?? null,
          JSON.stringify(metadata)
        ]
      );
      if (!updated.rowCount) throwErr("INVESTIGATION_POINT_NOT_FOUND");
      return updated.rows[0];
    }, { sendErr });
  });

  app.post("/api/worlds/:worldId/scenes/:sceneId/investigation-points", { schema: createInvestigationPointSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, sceneId } = request.params;
    await requireWorldRole(actorId, worldId);
    const scene = await query(`SELECT 1 FROM scenes WHERE id = $1 AND world_id = $2`, [sceneId, worldId]);
    if (!scene.rowCount) return sendErr(reply, "SCENE_NOT_FOUND");
    const {
      name, description = "", interactionText = "", resultText = "", clueId = null,
      requiredItemId = null, requiredRoleSlotId = null, sequence = 0, metadata = {}
    } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `INSERT INTO investigation_points
          (world_id, scene_id, name, description, interaction_text, result_text, clue_id,
           required_item_id, required_role_slot_id, sequence, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
         RETURNING *`,
        [worldId, sceneId, name, description, interactionText, resultText, clueId,
         requiredItemId, requiredRoleSlotId, sequence, JSON.stringify(metadata)]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });

  app.post("/api/worlds/:worldId/items", { schema: createItemSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText = "", hostText = "", unique = false, consumable = false, assetId = null, metadata = {} } = request.body ?? {};
    const itemMeta = {
      ...metadata,
      unique: Boolean(unique),
      consumable: Boolean(consumable),
      assetId: assetId || null
    };
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `INSERT INTO items (world_id, name, public_text, host_text, metadata)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING id, name, public_text, host_text, metadata, created_at`,
        [worldId, name.trim(), publicText, hostText, JSON.stringify(itemMeta)]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });

  app.patch("/api/worlds/:worldId/items/:itemId", { schema: patchItemSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, itemId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText, hostText, unique, consumable, assetId, metadata = {} } = request.body ?? {};
    if (name !== undefined && !String(name).trim()) return sendErr(reply, "NAME_EMPTY");
    const current = await query(`SELECT metadata FROM items WHERE id = $1 AND world_id = $2`, [itemId, worldId]);
    if (!current.rowCount) return sendErr(reply, "ITEM_NOT_FOUND");
    const mergedMeta = {
      ...(current.rows[0].metadata ?? {}),
      ...metadata,
      ...(unique !== undefined ? { unique: Boolean(unique) } : {}),
      ...(consumable !== undefined ? { consumable: Boolean(consumable) } : {}),
      ...(assetId !== undefined ? { assetId: assetId || null } : {})
    };
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const updated = await client.query(
        `UPDATE items
         SET name = COALESCE($3, name),
             public_text = COALESCE($4, public_text),
             host_text = COALESCE($5, host_text),
             metadata = $6::jsonb
         WHERE id = $1 AND world_id = $2
         RETURNING id, name, public_text, host_text, metadata, created_at`,
        [itemId, worldId, name?.trim() ?? null, publicText ?? null, hostText ?? null, JSON.stringify(mergedMeta)]
      );
      if (!updated.rowCount) throwErr("ITEM_NOT_FOUND");
      return updated.rows[0];
    }, { sendErr });
  });

  app.delete("/api/worlds/:worldId/items/:itemId", { schema: deleteItemSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, itemId } = request.params;
    await requireWorldRole(actorId, worldId);
    const refs = await query(
      `SELECT COUNT(*)::int AS count FROM investigation_points WHERE world_id = $1 AND required_item_id = $2`,
      [worldId, itemId]
    );
    if (refs.rows[0].count > 0) {
      return sendErr(reply, "ITEM_REFERENCED");
    }
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(`DELETE FROM items WHERE id = $1 AND world_id = $2 RETURNING id`, [itemId, worldId]);
      if (!result.rowCount) throwErr("ITEM_NOT_FOUND");
      return { ok: true };
    }, { sendErr });
  });

  app.get("/api/worlds/:worldId/studio", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    const client = await pool.connect();
    try {
      await repairChapterSequencesIfNeeded(worldId, client);
      const world = await client.query(
        `SELECT w.id, w.owner_user_id, w.name, w.summary, w.status, w.catalog_public, w.catalog_review_status, w.catalog_review_submitted_at, w.catalog_review_note, w.settings, w.content_revision, wm.role AS membership_role
         FROM worlds w
         JOIN world_members wm ON wm.world_id = w.id AND wm.user_id = $2
         WHERE w.id = $1`,
        [worldId, actorId]
      );
      const membershipRole = world.rows[0]?.membership_role;
      const canReadDraftContent = ["owner", "editor"].includes(membershipRole);
      const chapters = await client.query(`SELECT id, title, summary, sequence, publication_status, unlock_rules, metadata FROM chapters WHERE world_id = $1 ORDER BY sequence`, [worldId]);
      const roles = await client.query(
        `SELECT id, name, public_profile,
                CASE WHEN $2::boolean THEN private_profile ELSE '' END AS private_profile,
                sequence
         FROM role_slots WHERE world_id = $1 ORDER BY sequence`,
        [worldId, canReadDraftContent]
      );
      const sections = await client.query(
        `SELECT ss.id, ss.role_slot_id, ss.chapter_id, ss.title,
                CASE WHEN $2::boolean THEN ss.body ELSE '' END AS body,
                ss.sequence, ss.publication_status, ss.updated_at
         FROM script_sections ss
         JOIN role_slots rs ON rs.id = ss.role_slot_id
         WHERE rs.world_id = $1
           AND ($2::boolean OR ss.publication_status IN ('testing', 'published'))
         ORDER BY rs.sequence, ss.sequence`,
        [worldId, canReadDraftContent]
      );
      const scenes = await client.query(`SELECT id, chapter_id, name, public_text, host_text, metadata FROM scenes WHERE world_id = $1 ORDER BY created_at`, [worldId]);
      const clues = await client.query(`SELECT id, name, public_text, host_text, visibility, metadata FROM clues WHERE world_id = $1 ORDER BY created_at`, [worldId]);
      const points = await client.query(
        `SELECT ip.id, ip.scene_id, ip.name, ip.description, ip.interaction_text, ip.result_text,
                ip.clue_id, ip.required_item_id, ip.required_role_slot_id, ip.sequence, ip.metadata
         FROM investigation_points ip
         WHERE ip.world_id = $1
         ORDER BY ip.scene_id, ip.sequence, ip.created_at`,
        [worldId]
      );
      const items = await client.query(`SELECT id, name, public_text, host_text, metadata FROM items WHERE world_id = $1 ORDER BY created_at`, [worldId]);
      const edges = await client.query(
        `SELECT id, from_type, from_id, to_type, to_id, relation_type, label
         FROM story_graph_edges
         WHERE world_id = $1
         ORDER BY created_at`,
        [worldId]
      );
      const versions = await client.query(
        `SELECT id, label, created_at FROM content_versions
         WHERE world_id = $1 ORDER BY created_at DESC LIMIT 12`,
        [worldId]
      );
      const rooms = await client.query(
        `SELECT r.id, r.name, r.status, r.invite_code, r.public_listing
         FROM rooms r
         WHERE r.world_id = $1 AND ${ROOMS_VISIBLE_TO_ACTOR_SQL}
         ORDER BY r.created_at DESC`,
        [worldId, actorId]
      );
      return {
        world: {
          ...world.rows[0],
          content_revision: Number(world.rows[0].content_revision ?? 1)
        },
        chapters: chapters.rows,
        roles: roles.rows,
        sections: sections.rows,
        scenes: scenes.rows,
        clues: clues.rows,
        investigationPoints: points.rows,
        items: items.rows,
        edges: edges.rows,
        versions: versions.rows,
        rooms: rooms.rows
      };
    } finally {
      client.release();
    }
  });

  app.post("/api/worlds/:worldId/content-versions", { schema: createContentVersionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { label = "手动创作快照" } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const snapshot = await buildWorldSnapshot(worldId, client);
      const result = await client.query(
        `INSERT INTO content_versions (world_id, created_by_user_id, label, snapshot)
         VALUES ($1, $2, $3, $4::jsonb) RETURNING id, label, created_at`,
        [worldId, actorId, label, JSON.stringify(snapshot)]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });

  app.post("/api/worlds/:worldId/content-versions/:versionId/restore", { schema: restoreContentVersionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, versionId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const version = await client.query(`SELECT snapshot FROM content_versions WHERE id = $1 AND world_id = $2`, [versionId, worldId]);
      if (!version.rowCount) throwErr("CONTENT_VERSION_NOT_FOUND");
      const snapshot = version.rows[0].snapshot;
      for (const chapter of snapshot.chapters ?? []) {
        await client.query(
          `UPDATE chapters SET title = $1, summary = $2, publication_status = $3, unlock_rules = $4::jsonb, updated_at = now()
           WHERE id = $5 AND world_id = $6`,
          [chapter.title, chapter.summary, chapter.publication_status, JSON.stringify(chapter.unlock_rules ?? {}), chapter.id, worldId]
        );
      }
      for (const section of snapshot.sections ?? []) {
        await client.query(
          `UPDATE script_sections ss SET title = $1, body = $2, chapter_id = $3, publication_status = $4, updated_at = now()
           FROM role_slots rs WHERE ss.id = $5 AND rs.id = ss.role_slot_id AND rs.world_id = $6`,
          [section.title, section.body, section.chapter_id, section.publication_status, section.id, worldId]
        );
      }
      return { ok: true, restoredVersionId: versionId };
    }, { sendErr });
  });

  app.delete("/api/worlds/:worldId/content-versions/:versionId", { schema: deleteContentVersionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, versionId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(`DELETE FROM content_versions WHERE id = $1 AND world_id = $2 RETURNING id`, [versionId, worldId]);
      if (!result.rowCount) throwErr("CONTENT_VERSION_NOT_FOUND");
      return { ok: true };
    }, { sendErr });
  });

  app.post("/api/worlds/:worldId/story-edges", { schema: createStoryEdgeSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { fromType, fromId, toType, toId, relationType = "mainline", label = "" } = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [worldId, fromType, fromId, toType, toId, relationType, label]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });
}
