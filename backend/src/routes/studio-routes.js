import { query, transaction } from "../db.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { buildWorldSnapshot, creatorChecks } from "./world-helpers.js";

export async function registerStudioRoutes(app) {
  app.post("/api/worlds/:worldId/scenes", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText = "", hostText = "", chapterId = null, metadata = {} } = request.body ?? {};
    if (!name) return reply.code(400).send({ error: "name is required" });
    const result = await query(
      `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
      [worldId, chapterId, name, publicText, hostText, JSON.stringify(metadata)]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.post("/api/worlds/:worldId/clues", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText = "", hostText = "", visibility = "role", metadata = {} } = request.body ?? {};
    if (!name) return reply.code(400).send({ error: "name is required" });
    const result = await query(
      `INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
      [worldId, name, publicText, hostText, visibility, JSON.stringify(metadata)]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.patch("/api/worlds/:worldId/scenes/:sceneId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, sceneId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText, hostText, chapterId, metadata = {} } = request.body ?? {};
    if (name !== undefined && !String(name).trim()) return reply.code(400).send({ error: "name cannot be empty" });
    const result = await query(
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
    if (!result.rowCount) return reply.code(404).send({ error: "Scene not found" });
    return result.rows[0];
  });

  app.patch("/api/worlds/:worldId/clues/:clueId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, clueId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText, hostText, visibility, metadata = {} } = request.body ?? {};
    if (name !== undefined && !String(name).trim()) return reply.code(400).send({ error: "name cannot be empty" });
    const allowedVisibility = ["author", "host", "role", "faction", "public", "postgame"];
    if (visibility !== undefined && !allowedVisibility.includes(visibility)) {
      return reply.code(400).send({ error: "Unsupported visibility" });
    }
    const result = await query(
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
    if (!result.rowCount) return reply.code(404).send({ error: "Clue not found" });
    return result.rows[0];
  });

  app.patch("/api/worlds/:worldId/investigation-points/:pointId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, pointId } = request.params;
    await requireWorldRole(actorId, worldId);
    const {
      name, description, interactionText, resultText, sceneId, clueId,
      requiredItemId, requiredRoleSlotId, sequence, metadata = {}
    } = request.body ?? {};
    if (name !== undefined && !String(name).trim()) return reply.code(400).send({ error: "name cannot be empty" });
    if (sceneId) {
      const scene = await query(`SELECT 1 FROM scenes WHERE id = $1 AND world_id = $2`, [sceneId, worldId]);
      if (!scene.rowCount) return reply.code(404).send({ error: "Scene not found in world" });
    }
    if (clueId) {
      const clue = await query(`SELECT 1 FROM clues WHERE id = $1 AND world_id = $2`, [clueId, worldId]);
      if (!clue.rowCount) return reply.code(404).send({ error: "Clue not found in world" });
    }
    const result = await query(
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
       RETURNING id, scene_id, name, description, interaction_text, result_text, clue_id, sequence, metadata`,
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
    if (!result.rowCount) return reply.code(404).send({ error: "Investigation point not found" });
    return result.rows[0];
  });

  app.post("/api/worlds/:worldId/scenes/:sceneId/investigation-points", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, sceneId } = request.params;
    await requireWorldRole(actorId, worldId);
    const scene = await query(`SELECT 1 FROM scenes WHERE id = $1 AND world_id = $2`, [sceneId, worldId]);
    if (!scene.rowCount) return reply.code(404).send({ error: "Scene not found" });
    const {
      name, description = "", interactionText = "", resultText = "", clueId = null,
      requiredItemId = null, requiredRoleSlotId = null, sequence = 0, metadata = {}
    } = request.body ?? {};
    if (!name) return reply.code(400).send({ error: "name is required" });
    const result = await query(
      `INSERT INTO investigation_points
        (world_id, scene_id, name, description, interaction_text, result_text, clue_id,
         required_item_id, required_role_slot_id, sequence, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       RETURNING *`,
      [worldId, sceneId, name, description, interactionText, resultText, clueId,
       requiredItemId, requiredRoleSlotId, sequence, JSON.stringify(metadata)]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.get("/api/worlds/:worldId/studio", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const [world, chapters, roles, sections, scenes, clues, points, edges, versions, rooms] = await Promise.all([
      query(`SELECT id, name, summary, status, settings FROM worlds WHERE id = $1`, [worldId]),
      query(`SELECT id, title, summary, sequence, publication_status, unlock_rules FROM chapters WHERE world_id = $1 ORDER BY sequence`, [worldId]),
      query(`SELECT id, name, public_profile, private_profile, sequence FROM role_slots WHERE world_id = $1 ORDER BY sequence`, [worldId]),
      query(
        `SELECT ss.id, ss.role_slot_id, ss.chapter_id, ss.title, ss.body, ss.sequence, ss.publication_status, ss.updated_at
         FROM script_sections ss
         JOIN role_slots rs ON rs.id = ss.role_slot_id
         WHERE rs.world_id = $1
         ORDER BY rs.sequence, ss.sequence`,
        [worldId]
      ),
      query(`SELECT id, chapter_id, name, public_text, host_text, metadata FROM scenes WHERE world_id = $1 ORDER BY created_at`, [worldId]),
      query(`SELECT id, name, public_text, host_text, visibility, metadata FROM clues WHERE world_id = $1 ORDER BY created_at`, [worldId]),
      query(
        `SELECT ip.id, ip.scene_id, ip.name, ip.description, ip.interaction_text, ip.result_text, ip.clue_id, ip.sequence, ip.metadata
         FROM investigation_points ip
         WHERE ip.world_id = $1
         ORDER BY ip.scene_id, ip.sequence, ip.created_at`,
        [worldId]
      ),
      query(
        `SELECT id, from_type, from_id, to_type, to_id, relation_type, label
         FROM story_graph_edges
         WHERE world_id = $1
         ORDER BY created_at`,
        [worldId]
      ),
      query(
        `SELECT id, label, created_at FROM content_versions
         WHERE world_id = $1 ORDER BY created_at DESC LIMIT 12`,
        [worldId]
      ),
      query(`SELECT id, name, status, invite_code FROM rooms WHERE world_id = $1 ORDER BY created_at DESC`, [worldId])
    ]);
    return {
      world: world.rows[0],
      chapters: chapters.rows,
      roles: roles.rows,
      sections: sections.rows,
      scenes: scenes.rows,
      clues: clues.rows,
      investigationPoints: points.rows,
      edges: edges.rows,
      versions: versions.rows,
      rooms: rooms.rows
    };
  });

  app.get("/api/worlds/:worldId/creator-checks", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return { checks: creatorChecks(await buildWorldSnapshot(worldId)) };
  });

  app.post("/api/worlds/:worldId/content-versions", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { label = "手动创作快照" } = request.body ?? {};
    const result = await query(
      `INSERT INTO content_versions (world_id, created_by_user_id, label, snapshot)
       VALUES ($1, $2, $3, $4::jsonb) RETURNING id, label, created_at`,
      [worldId, actorId, label, JSON.stringify(await buildWorldSnapshot(worldId))]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.post("/api/worlds/:worldId/content-versions/:versionId/restore", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, versionId } = request.params;
    await requireWorldRole(actorId, worldId);
    const version = await query(`SELECT snapshot FROM content_versions WHERE id = $1 AND world_id = $2`, [versionId, worldId]);
    if (!version.rowCount) return reply.code(404).send({ error: "Content version not found" });
    const snapshot = version.rows[0].snapshot;
    await transaction(async (client) => {
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
    });
    return { ok: true };
  });

  app.delete("/api/worlds/:worldId/content-versions/:versionId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, versionId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(`DELETE FROM content_versions WHERE id = $1 AND world_id = $2 RETURNING id`, [versionId, worldId]);
    if (!result.rowCount) return reply.code(404).send({ error: "Content version not found" });
    return { ok: true };
  });

  app.post("/api/worlds/:worldId/story-edges", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { fromType, fromId, toType, toId, relationType = "mainline", label = "" } = request.body ?? {};
    const nodeTypes = ["chapter", "scene", "clue", "investigation_point"];
    if (!nodeTypes.includes(fromType) || !nodeTypes.includes(toType) || !fromId || !toId) {
      return reply.code(400).send({ error: "Valid fromType, fromId, toType and toId are required" });
    }
    if (!["mainline", "parallel", "extension"].includes(relationType)) {
      return reply.code(400).send({ error: "Unsupported relationType" });
    }
    const result = await query(
      `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [worldId, fromType, fromId, toType, toId, relationType, label]
    );
    return reply.code(201).send(result.rows[0]);
  });

}
