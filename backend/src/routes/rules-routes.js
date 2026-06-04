import { query } from "../db.js";
import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { validateRuleBody } from "../rule-structure-validator.js";
import { buildWorldSnapshot, creatorChecks } from "./world-helpers.js";
import {
  worldIdParams,
  createRuleSchema,
  updateRuleSchema,
  deleteRuleSchema,
  validateRuleBodySchema,
  validateRulesSchema
} from "./schemas.js";

async function rejectInvalidRuleBody(reply, worldId, conditions, actions) {
  const snapshot = await buildWorldSnapshot(worldId);
  const validation = validateRuleBody(snapshot, { conditions, actions });
  if (!validation.ok) {
    sendErr(reply, "RULE_BODY_INVALID", undefined, { errors: validation.errors });
    return false;
  }
  return true;
}

export async function registerRulesRoutes(app) {
  app.post("/api/worlds/:worldId/rules", { schema: createRuleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { roomId = null, name, mode = "automatic", priority = 100, enabled = true, conditions, actions } = request.body ?? {};
    if (roomId) {
      const room = await query(`SELECT 1 FROM rooms WHERE id = $1 AND world_id = $2`, [roomId, worldId]);
      if (!room.rowCount) return sendErr(reply, "RULE_ROOM_WORLD_MISMATCH");
    }
    if (!(await rejectInvalidRuleBody(reply, worldId, conditions, actions))) return;
    const result = await query(
      `INSERT INTO automation_rules (world_id, room_id, name, mode, priority, enabled, conditions, actions)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb) RETURNING *`,
      [worldId, roomId, name, mode, priority, Boolean(enabled), JSON.stringify(conditions), JSON.stringify(actions)]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.get("/api/worlds/:worldId/rules", { schema: { params: worldIdParams } }, async (request) => {
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

  app.put("/api/worlds/:worldId/rules/:ruleId", { schema: updateRuleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, ruleId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { roomId = null, name, mode = "automatic", priority = 100, enabled = true, conditions, actions } = request.body ?? {};
    if (roomId) {
      const room = await query(`SELECT 1 FROM rooms WHERE id = $1 AND world_id = $2`, [roomId, worldId]);
      if (!room.rowCount) return sendErr(reply, "RULE_ROOM_WORLD_MISMATCH");
    }
    if (!(await rejectInvalidRuleBody(reply, worldId, conditions, actions))) return;
    const result = await query(
      `UPDATE automation_rules
       SET room_id = $1, name = $2, mode = $3, priority = $4, enabled = $5,
           conditions = $6::jsonb, actions = $7::jsonb, updated_at = now()
       WHERE id = $8 AND world_id = $9 RETURNING *`,
      [roomId || null, name, mode, Number(priority) || 100, Boolean(enabled), JSON.stringify(conditions), JSON.stringify(actions), ruleId, worldId]
    );
    if (!result.rowCount) return sendErr(reply, "RULE_NOT_FOUND");
    return result.rows[0];
  });

  app.delete("/api/worlds/:worldId/rules/:ruleId", { schema: deleteRuleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, ruleId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(`DELETE FROM automation_rules WHERE id = $1 AND world_id = $2 RETURNING id`, [ruleId, worldId]);
    if (!result.rowCount) return sendErr(reply, "RULE_NOT_FOUND");
    return { ok: true };
  });

  app.post("/api/worlds/:worldId/rules/validate", { schema: validateRulesSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const snapshot = await buildWorldSnapshot(worldId);
    return { checks: creatorChecks(snapshot), totalRules: snapshot.rules.length };
  });

  app.post("/api/worlds/:worldId/rules/validate-body", { schema: validateRuleBodySchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const snapshot = await buildWorldSnapshot(worldId);
    const { conditions, actions } = request.body ?? {};
    return validateRuleBody(snapshot, { conditions, actions });
  });
}
