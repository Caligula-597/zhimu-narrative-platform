import { query, transaction } from "../db.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";

export async function registerStudioGraphRoutes(app) {
  app.get("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/references", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    await requireWorldRole(actorId, worldId);
    const tables = { scene: "scenes", clue: "clues", investigation_point: "investigation_points" };
    if (!tables[nodeType]) return reply.code(400).send({ error: "Unsupported nodeType" });
    const exists = await query(`SELECT 1 FROM ${tables[nodeType]} WHERE id = $1 AND world_id = $2`, [nodeId, worldId]);
    if (!exists.rowCount) return reply.code(404).send({ error: "Studio node not found" });

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

    return {
      edgeCount: edgeCount.rows[0].value,
      investigationPointCount: investigationPointCount.rows[0].value,
      clueGrantCount: clueGrantCount.rows[0].value,
      ruleReferenceCount: ruleReferenceCount.rows[0].value,
      totalReferences:
        edgeCount.rows[0].value
        + investigationPointCount.rows[0].value
        + clueGrantCount.rows[0].value
        + ruleReferenceCount.rows[0].value
    };
  });

  app.delete("/api/worlds/:worldId/story-edges/:edgeId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, edgeId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(`DELETE FROM story_graph_edges WHERE id = $1 AND world_id = $2 RETURNING id`, [edgeId, worldId]);
    if (!result.rowCount) return reply.code(404).send({ error: "Story edge not found" });
    return { ok: true };
  });

  app.delete("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    await requireWorldRole(actorId, worldId);
    const tables = { chapter: "chapters", scene: "scenes", clue: "clues", investigation_point: "investigation_points" };
    const table = tables[nodeType];
    if (!table) return reply.code(400).send({ error: "Unsupported nodeType" });
    const result = await transaction(async (client) => {
      await client.query(
        `DELETE FROM story_graph_edges
         WHERE world_id = $1 AND ((from_type = $2 AND from_id = $3) OR (to_type = $2 AND to_id = $3))`,
        [worldId, nodeType, nodeId]
      );
      return client.query(`DELETE FROM ${table} WHERE id = $1 AND world_id = $2 RETURNING id`, [nodeId, worldId]);
    });
    if (!result.rowCount) return reply.code(404).send({ error: "Studio node not found" });
    return { ok: true };
  });

  app.put("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/position", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    const { x, y } = request.body ?? {};
    await requireWorldRole(actorId, worldId);
    const tables = { scene: "scenes", clue: "clues", investigation_point: "investigation_points" };
    const table = tables[nodeType];
    if (!table) return reply.code(400).send({ error: "Unsupported draggable nodeType" });
    if (!Number.isFinite(x) || !Number.isFinite(y)) return reply.code(400).send({ error: "Finite x and y are required" });
    const result = await query(
      `UPDATE ${table}
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{graphPosition}', $1::jsonb, true)
       WHERE id = $2 AND world_id = $3 RETURNING id, metadata`,
      [JSON.stringify({ x: Math.round(x), y: Math.round(y) }), nodeId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Studio node not found" });
    return result.rows[0];
  });

  app.put("/api/worlds/:worldId/studio-nodes/:nodeType/:nodeId/anchors", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, nodeType, nodeId } = request.params;
    const { anchors = [] } = request.body ?? {};
    await requireWorldRole(actorId, worldId);
    const tables = { scene: "scenes", clue: "clues", investigation_point: "investigation_points" };
    const table = tables[nodeType];
    if (!table) return reply.code(400).send({ error: "Unsupported draggable nodeType" });
    if (!Array.isArray(anchors) || anchors.length < 1 || anchors.length > 8) {
      return reply.code(400).send({ error: "anchors must contain between 1 and 8 connection points" });
    }
    const normalized = anchors.map((anchor) => {
      if (!anchor?.id || typeof anchor.id !== "string" || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
        throw Object.assign(new Error("Each anchor requires id, x and y"), { statusCode: 400 });
      }
      return { id: anchor.id.slice(0, 80), x: Math.round(Math.max(0, Math.min(156, anchor.x))), y: Math.round(Math.max(0, Math.min(124, anchor.y))) };
    });
    const result = await query(
      `UPDATE ${table}
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{graphAnchors}', $1::jsonb, true)
       WHERE id = $2 AND world_id = $3 RETURNING id, metadata`,
      [JSON.stringify(normalized), nodeId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Studio node not found" });
    return result.rows[0];
  });

  app.put("/api/worlds/:worldId/story-layout", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    const { positions = [] } = request.body ?? {};
    await requireWorldRole(actorId, worldId);
    const tables = { scene: "scenes", clue: "clues", investigation_point: "investigation_points" };
    if (!Array.isArray(positions) || positions.length > 300) return reply.code(400).send({ error: "positions must be an array of up to 300 nodes" });
    await transaction(async (client) => {
      for (const position of positions) {
        const table = tables[position.type];
        if (!table || !position.id || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
          throw Object.assign(new Error("Each position requires a valid type, id, x and y"), { statusCode: 400 });
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
