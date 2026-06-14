import { query, transaction } from "../db.js";
import { deleteWorldChapter } from "./world-helpers.js";
import { requireActor } from "../request-actor.js";
import { sendErr, throwErr } from "../api-errors.js";
import { requireWorldRole, requireWorldReader } from "./route-guards.js";
import {
  studioNodeReferencesSchema,
  deleteStoryEdgeSchema,
  deleteStudioNodeSchema,
  updateNodePositionSchema,
  updateNodeAnchorsSchema,
  updateStoryLayoutSchema
} from "./schemas.js";

export async function registerStudioGraphRoutes(app) {
  app.get("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/references", { schema: studioNodeReferencesSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    await requireWorldReader(actorId, worldId);

    const edgeCount = await query(
      `SELECT COUNT(*)::int AS value FROM story_graph_edges
       WHERE world_id = $1 AND ((from_type = $2 AND from_id = $3::uuid) OR (to_type = $2 AND to_id = $3::uuid))`,
      [worldId, nodeType, nodeId]
    );
    const ruleReferenceCount = await query(
      `SELECT COUNT(*)::int AS value FROM automation_rules
       WHERE world_id = $1 AND (actions::text LIKE '%' || $2 || '%' OR conditions::text LIKE '%' || $2 || '%')`,
      [worldId, nodeId]
    );

    if (nodeType === "chapter") {
      const exists = await query(`SELECT 1 FROM chapters WHERE id = $1 AND world_id = $2`, [nodeId, worldId]);
      if (!exists.rowCount) return sendErr(reply, "STUDIO_NODE_NOT_FOUND");
      const sceneCount = await query(
        `SELECT COUNT(*)::int AS value FROM scenes WHERE world_id = $1 AND chapter_id = $2::uuid`,
        [worldId, nodeId]
      );
      const sectionCount = await query(
        `SELECT COUNT(*)::int AS value FROM script_sections ss
         INNER JOIN role_slots rs ON rs.id = ss.role_slot_id
         WHERE rs.world_id = $1 AND ss.chapter_id = $2::uuid`,
        [worldId, nodeId]
      );
      const edge = edgeCount.rows[0].value;
      const scenes = sceneCount.rows[0].value;
      const sections = sectionCount.rows[0].value;
      const rules = ruleReferenceCount.rows[0].value;
      return {
        edgeCount: edge,
        sceneCount: scenes,
        sectionCount: sections,
        investigationPointCount: 0,
        clueGrantCount: 0,
        requiredItemCount: 0,
        ruleReferenceCount: rules,
        totalReferences: edge + scenes + sections + rules
      };
    }

    const tables = { scene: "scenes", clue: "clues", investigation_point: "investigation_points", item: "items" };
    if (!tables[nodeType]) return sendErr(reply, "NODE_TYPE_UNSUPPORTED");
    const exists = await query(`SELECT 1 FROM ${tables[nodeType]} WHERE id = $1 AND world_id = $2`, [nodeId, worldId]);
    if (!exists.rowCount) return sendErr(reply, "STUDIO_NODE_NOT_FOUND");

    let investigationPointCount = { rows: [{ value: 0 }] };
    let clueGrantCount = { rows: [{ value: 0 }] };
    if (nodeType === "scene") {
      investigationPointCount = await query(
        `SELECT COUNT(*)::int AS value FROM investigation_points WHERE world_id = $1 AND scene_id = $2::uuid`,
        [worldId, nodeId]
      );
    }
    if (nodeType === "clue") {
      clueGrantCount = await query(
        `SELECT COUNT(*)::int AS value FROM investigation_points WHERE world_id = $1 AND clue_id = $2::uuid`,
        [worldId, nodeId]
      );
    }
    let requiredItemCount = { rows: [{ value: 0 }] };
    if (nodeType === "item") {
      requiredItemCount = await query(
        `SELECT COUNT(*)::int AS value FROM investigation_points WHERE world_id = $1 AND required_item_id = $2::uuid`,
        [worldId, nodeId]
      );
    }

    const edge = edgeCount.rows[0].value;
    const points = investigationPointCount.rows[0].value;
    const grants = clueGrantCount.rows[0].value;
    const items = requiredItemCount.rows[0].value;
    const rules = ruleReferenceCount.rows[0].value;
    return {
      edgeCount: edge,
      sceneCount: 0,
      sectionCount: 0,
      investigationPointCount: points,
      clueGrantCount: grants,
      requiredItemCount: items,
      ruleReferenceCount: rules,
      totalReferences: edge + points + grants + items + rules
    };
  });

  app.delete("/api/worlds/:worldId/story-edges/:edgeId", { schema: deleteStoryEdgeSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, edgeId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(`DELETE FROM story_graph_edges WHERE id = $1 AND world_id = $2 RETURNING id`, [edgeId, worldId]);
    if (!result.rowCount) return sendErr(reply, "STORY_EDGE_NOT_FOUND");
    return { ok: true };
  });

  app.delete("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId", { schema: deleteStudioNodeSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    await requireWorldRole(actorId, worldId);
    const tables = { chapter: "chapters", scene: "scenes", clue: "clues", investigation_point: "investigation_points", item: "items" };
    const table = tables[nodeType];
    if (!table) return sendErr(reply, "NODE_TYPE_UNSUPPORTED");
    const result = await transaction(async (client) => {
      if (nodeType === "chapter") {
        const removed = await deleteWorldChapter(client, worldId, nodeId);
        return removed ? { rowCount: 1 } : { rowCount: 0 };
      }
      await client.query(
        `DELETE FROM story_graph_edges
         WHERE world_id = $1 AND ((from_type = $2 AND from_id = $3) OR (to_type = $2 AND to_id = $3))`,
        [worldId, nodeType, nodeId]
      );
      return client.query(`DELETE FROM ${table} WHERE id = $1 AND world_id = $2 RETURNING id`, [nodeId, worldId]);
    });
    if (!result.rowCount) return sendErr(reply, "STUDIO_NODE_NOT_FOUND");
    return { ok: true };
  });

  app.put("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/position", { schema: updateNodePositionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    const { x, y } = request.body ?? {};
    await requireWorldRole(actorId, worldId);
    const tables = { scene: "scenes", clue: "clues", investigation_point: "investigation_points", item: "items" };
    const table = tables[nodeType];
    if (!table) return sendErr(reply, "NODE_TYPE_DRAG_UNSUPPORTED");
    const result = await query(
      `UPDATE ${table}
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{graphPosition}', $1::jsonb, true)
       WHERE id = $2 AND world_id = $3 RETURNING id, metadata`,
      [JSON.stringify({ x: Math.round(x), y: Math.round(y) }), nodeId, worldId]
    );
    if (!result.rowCount) return sendErr(reply, "STUDIO_NODE_NOT_FOUND");
    return result.rows[0];
  });

  app.put("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/anchors", { schema: updateNodeAnchorsSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    const { anchors = [] } = request.body ?? {};
    await requireWorldRole(actorId, worldId);
    const tables = { scene: "scenes", clue: "clues", investigation_point: "investigation_points", item: "items" };
    const table = tables[nodeType];
    if (!table) return sendErr(reply, "NODE_TYPE_DRAG_UNSUPPORTED");
    const normalized = anchors.map((anchor) => {
      if (!anchor?.id || typeof anchor.id !== "string" || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
        throwErr("ANCHOR_FIELDS_INVALID");
      }
      return { id: anchor.id.slice(0, 80), x: Math.round(Math.max(0, Math.min(156, anchor.x))), y: Math.round(Math.max(0, Math.min(124, anchor.y))) };
    });
    const result = await query(
      `UPDATE ${table}
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{graphAnchors}', $1::jsonb, true)
       WHERE id = $2 AND world_id = $3 RETURNING id, metadata`,
      [JSON.stringify(normalized), nodeId, worldId]
    );
    if (!result.rowCount) return sendErr(reply, "STUDIO_NODE_NOT_FOUND");
    return result.rows[0];
  });

  app.put("/api/worlds/:worldId/story-layout", { schema: updateStoryLayoutSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    const { positions = [] } = request.body ?? {};
    await requireWorldRole(actorId, worldId);
    const tables = { scene: "scenes", clue: "clues", investigation_point: "investigation_points", item: "items" };
    await transaction(async (client) => {
      for (const position of positions) {
        const table = tables[position.type];
        if (!table || !position.id) {
          throwErr("POSITION_ENTRY_INVALID");
        }
        await client.query(
          `UPDATE ${table}
           SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{graphPosition}', $1::jsonb, true)
           WHERE id = $2 AND world_id = $3`,
          [JSON.stringify({ x: Math.round(position.x), y: Math.round(position.y) }), position.id, worldId]
        );
      }
    });
    return { ok: true, updated: positions.length };
  });
}
