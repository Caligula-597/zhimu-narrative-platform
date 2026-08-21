import { paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const metadataObject = { type: "object", additionalProperties: true };
const optionalUuid = { anyOf: [uuid, { type: "null" }] };
const itemIdParams = paramsSchema({ worldId: uuid, itemId: uuid });
const itemAction = {
  type: "object",
  additionalProperties: false,
  required: ["key", "label", "kind", "targetType"],
  properties: {
    key: { type: "string", pattern: "^[a-z][a-z0-9_]{1,63}$" },
    label: { type: "string", minLength: 1, maxLength: 120, pattern: "\\S" },
    kind: { type: "string", enum: ["use", "consume", "combine"] },
    targetType: { type: "string", enum: ["none", "role"] },
    requiresHostConfirmation: { type: "boolean" },
    consumeQuantity: { type: "integer", minimum: 0, maximum: 99 },
    combineConsumeQuantity: { type: "integer", minimum: 0, maximum: 99 },
    combineWithItemIds: { type: "array", maxItems: 50, uniqueItems: true, items: uuid },
    resultText: { type: "string", maxLength: 2000 }
  }
};

export const createItemSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 10_000 },
      hostText: { type: "string", maxLength: 10_000 },
      unique: { type: "boolean" },
      consumable: { type: "boolean" },
      assetId: optionalUuid,
      itemActions: { type: "array", maxItems: 8, items: itemAction },
      metadata: metadataObject
    }
  }
};

export const patchItemSchema = {
  params: itemIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: createItemSchema.body.properties
  }
};

export const deleteItemSchema = { params: itemIdParams };
