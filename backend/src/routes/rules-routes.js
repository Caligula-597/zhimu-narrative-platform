import { requireActor } from "../request-actor.js";
import {
  addRule,
  getWorldRules,
  removeRule,
  reviseRule,
  validateWorldRuleBody,
  validateWorldRules
} from "../rules-service.js";
import { requireWorldReader, requireWorldRole } from "./route-guards.js";
import {
  createRuleSchema,
  deleteRuleSchema,
  updateRuleSchema,
  validateRuleBodySchema,
  validateRulesSchema
} from "./schemas/rules.js";
import { worldIdParams } from "./schemas/world.js";

export async function registerRulesRoutes(app) {
  app.post("/api/worlds/:worldId/rules", { schema: createRuleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return addRule({ request, reply, actorId, worldId, payload: request.body });
  });

  app.get("/api/worlds/:worldId/rules", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    return getWorldRules(worldId);
  });

  app.put("/api/worlds/:worldId/rules/:ruleId", { schema: updateRuleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, ruleId } = request.params;
    await requireWorldRole(actorId, worldId);
    return reviseRule({ request, reply, actorId, worldId, ruleId, payload: request.body });
  });

  app.delete("/api/worlds/:worldId/rules/:ruleId", { schema: deleteRuleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, ruleId } = request.params;
    await requireWorldRole(actorId, worldId);
    return removeRule({ request, reply, actorId, worldId, ruleId });
  });

  app.post("/api/worlds/:worldId/rules/validate", { schema: validateRulesSchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return validateWorldRules(worldId);
  });

  app.post("/api/worlds/:worldId/rules/validate-body", { schema: validateRuleBodySchema }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return validateWorldRuleBody(worldId, request.body);
  });
}
