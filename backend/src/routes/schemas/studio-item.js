import { paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const metadataObject = { type: "object", additionalProperties: true };
const optionalUuid = { anyOf: [uuid, { type: "null" }] };
const itemIdParams = paramsSchema({ worldId: uuid, itemId: uuid });

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
