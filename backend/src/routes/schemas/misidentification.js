// Misidentification Editor — route schemas

import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });

const misidentificationBody = {
  type: "object",
  additionalProperties: false,
  required: [
    "actId", "timestamp", "sortOrder",
    "holderLabel", "title", "content"
  ],
  properties: {
    actId: { type: "string", minLength: 1, maxLength: 80 },
    timestamp: { type: "string", maxLength: 80 },
    sortOrder: { type: "integer", minimum: 0, maximum: 9999 },
    holderId: { type: "string", maxLength: 80 },
    holderLabel: { type: "string", maxLength: 200 },
    title: { type: "string", minLength: 1, maxLength: 200 },
    content: { type: "string", minLength: 1, maxLength: 5000 },
    truth: { type: "string", maxLength: 5000 },
    refutedByClueId: { oneOf: [{ type: "null" }, uuid] },
    refutedByItemId: { oneOf: [{ type: "null" }, uuid] },
    refutedAt: { type: "string", maxLength: 80 },
    duration: { type: "string", maxLength: 80 },
    isActive: { type: "boolean" }
  }
};

export const listMisidentificationsSchema = {
  params: worldIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      actId: { type: "string", maxLength: 80 },
      isActive: { type: "string", enum: ["true", "false"] },
      limit: { type: "integer", minimum: 1, maximum: 500 },
      offset: { type: "integer", minimum: 0, maximum: 10000 }
    }
  }
};

export const getMisidentificationSchema = {
  params: paramsSchema({ worldId: uuid, misId: uuid })
};

export const createMisidentificationSchema = {
  params: worldIdParams,
  body: misidentificationBody
};

export const updateMisidentificationSchema = {
  params: paramsSchema({ worldId: uuid, misId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      actId: { type: "string", minLength: 1, maxLength: 80 },
      timestamp: { type: "string", maxLength: 80 },
      sortOrder: { type: "integer", minimum: 0, maximum: 9999 },
      holderId: { type: "string", maxLength: 80 },
      holderLabel: { type: "string", maxLength: 200 },
      title: { type: "string", minLength: 1, maxLength: 200 },
      content: { type: "string", minLength: 1, maxLength: 5000 },
      truth: { type: "string", maxLength: 5000 },
      refutedByClueId: { oneOf: [{ type: "null" }, uuid] },
      refutedByItemId: { oneOf: [{ type: "null" }, uuid] },
      refutedAt: { type: "string", maxLength: 80 },
      duration: { type: "string", maxLength: 80 },
      isActive: { type: "boolean" }
    }
  }
};

export const deleteMisidentificationSchema = {
  params: paramsSchema({ worldId: uuid, misId: uuid })
};