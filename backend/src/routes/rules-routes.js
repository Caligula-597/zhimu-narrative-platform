import { query } from "../db.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { buildWorldSnapshot, creatorChecks } from "./world-helpers.js";

export async function registerRulesRoutes(app) {
  app.post("/api/worlds/:worldId/rules", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { roomId = null, name, mode = "automatic", priority = 100, enabled = true, conditions, actions } = request.body ?? {};
    if (!name || !conditions || !actions) return reply.code(400).send({ error: "name, conditions and actions are required" });
    if (!["automatic", "host_confirm", "manual"].includes(mode)) return reply.code(400).send({ error: "Unsupported rule mode" });
    if (roomId) {
      const room = await query(`SELECT 1 FROM rooms WHERE id = $1 AND world_id = $2`, [roomId, worldId]);
      if (!room.rowCount) return reply.code(400).send({ error: "roomId does not belong to worldId" });
    }
    const result = await query(
      `INSERT INTO automation_rules (world_id, room_id, name, mode, priority, enabled, conditions, actions)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb) RETURNING *`,
      [worldId, roomId, name, mode, priority, Boolean(enabled), JSON.stringify(conditions), JSON.stringify(actions)]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.get("/api/worlds/:worldId/rules", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(
      `SELECT ar.*, r.name AS room_name
       FROM automation_rules ar
       LEFT JOIN rooms r ON r.id = ar.room_id
       WHERE ar.world_id = $1 ORDER BY ar.priority, ar.created_at`,
      [worldId]
    );
    return result.rows;
  });

  app.put("/api/worlds/:worldId/rules/:ruleId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, ruleId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { roomId = null, name, mode = "automatic", priority = 100, enabled = true, conditions, actions } = request.body ?? {};
    if (!name || !conditions || !actions) return reply.code(400).send({ error: "name, conditions and actions are required" });
    if (!["automatic", "host_confirm", "manual"].includes(mode)) return reply.code(400).send({ error: "Unsupported rule mode" });
    const result = await query(
      `UPDATE automation_rules
       SET room_id = $1, name = $2, mode = $3, priority = $4, enabled = $5,
           conditions = $6::jsonb, actions = $7::jsonb, updated_at = now()
       WHERE id = $8 AND world_id = $9 RETURNING *`,
      [roomId || null, name, mode, Number(priority) || 100, Boolean(enabled), JSON.stringify(conditions), JSON.stringify(actions), ruleId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Rule not found" });
    return result.rows[0];
  });

  app.delete("/api/worlds/:worldId/rules/:ruleId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, ruleId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(`DELETE FROM automation_rules WHERE id = $1 AND world_id = $2 RETURNING id`, [ruleId, worldId]);
    if (!result.rowCount) return reply.code(404).send({ error: "Rule not found" });
    return { ok: true };
  });

  app.post("/api/worlds/:worldId/rules/validate", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const snapshot = await buildWorldSnapshot(worldId);
    return { checks: creatorChecks(snapshot), totalRules: snapshot.rules.length };
  });

}
