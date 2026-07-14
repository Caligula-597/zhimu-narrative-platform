import { paramsSchema, uuid } from "./primitives.js";

export const createWorldSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      summary: { type: "string", maxLength: 4000 },
      settings: { type: "object", additionalProperties: true }
    }
  }
};

export const assetIdParams = paramsSchema({ assetId: uuid });

export const assetUploadUrlSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["worldId", "filename", "contentType", "byteSize"],
    properties: {
      worldId: uuid,
      roomId: { anyOf: [uuid, { type: "null" }] },
      filename: { type: "string", minLength: 1, maxLength: 255 },
      contentType: { type: "string", minLength: 3, maxLength: 120 },
      byteSize: { type: "integer", minimum: 1, maximum: 31_457_280 },
      visibility: { type: "string", enum: ["author", "host", "role", "public"] },
      roleSlotId: { anyOf: [uuid, { type: "null" }] }
    }
  }
};

export const confirmAssetSchema = { params: assetIdParams };
export const deleteAssetSchema = { params: assetIdParams };
export const restoreAssetSchema = { params: assetIdParams };
