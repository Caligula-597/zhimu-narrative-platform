import { paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const metadataObject = { type: "object", additionalProperties: true };
const optionalUuid = { anyOf: [uuid, { type: "null" }] };
const ruleMode = { type: "string", enum: ["automatic", "host_confirm", "manual"] };
const ruleJsonObject = { type: "object", additionalProperties: true };
const ruleIdParams = paramsSchema({ worldId: uuid, ruleId: uuid });
const ruleActionItem = {
  type: "object",
  additionalProperties: true,
  required: ["type"],
  properties: {
    type: {
      type: "string",
      enum: ["unlock_script_section", "unlock_scene", "grant_clue", "grant_item", "timeline_log"]
    },
    roleSlotId: optionalUuid,
    scriptSectionId: uuid,
    sceneId: uuid,
    clueId: uuid,
    itemId: uuid,
    investigationPointId: uuid,
    quantity: { type: "integer", minimum: 1, maximum: 99 },
    message: { type: "string", maxLength: 2000 },
    source: { type: "string", maxLength: 80 },
    key: { type: "string", maxLength: 120 },
    operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte"] },
    value: {},
    metadata: metadataObject
  }
};
const ruleActionsArray = {
  type: "array",
  minItems: 1,
  maxItems: 50,
  items: ruleActionItem
};
const ruleBody = {
  type: "object",
  additionalProperties: false,
  required: ["name", "conditions", "actions"],
  properties: {
    roomId: optionalUuid,
    name: { type: "string", minLength: 1, maxLength: 120 },
    mode: ruleMode,
    priority: { type: "integer", minimum: 0, maximum: 9999 },
    enabled: { type: "boolean" },
    conditions: ruleJsonObject,
    actions: ruleActionsArray,
    metadata: metadataObject
  }
};

export const createRuleSchema = { params: worldIdParams, body: ruleBody };
export const updateRuleSchema = { params: ruleIdParams, body: ruleBody };
export const deleteRuleSchema = { params: ruleIdParams };
export const validateRuleBodySchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["conditions", "actions"],
    properties: {
      conditions: ruleJsonObject,
      actions: ruleActionsArray,
      metadata: metadataObject
    }
  }
};
export const validateRulesSchema = { params: worldIdParams };
