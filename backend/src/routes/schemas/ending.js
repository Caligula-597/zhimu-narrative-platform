// Ending Branch Editor — route schemas

import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });

const endingBody = {
  type: "object",
  additionalProperties: false,
  required: ["title", "trigger", "result"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    trigger: { type: "string", maxLength: 3000 },
    result: { type: "string", maxLength: 8000 },
    revealText: { type: "string", maxLength: 5000 },
    revealClueIds: { type: "array", maxItems: 100, items: uuid },
    revealItemIds: { type: "array", maxItems: 100, items: uuid },
    isGood: { type: "boolean" },
    sortOrder: { type: "integer", minimum: 0, maximum: 9999 }
  }
};

export const listEndingsSchema = {
  params: worldIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 500 },
      offset: { type: "integer", minimum: 0, maximum: 10000 }
    }
  }
};

export const getEndingSchema = {
  params: paramsSchema({ worldId: uuid, endingId: uuid })
};

export const createEndingSchema = {
  params: worldIdParams,
  body: endingBody
};

export const updateEndingSchema = {
  params: paramsSchema({ worldId: uuid, endingId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      trigger: { type: "string", maxLength: 3000 },
      result: { type: "string", maxLength: 8000 },
      revealText: { type: "string", maxLength: 5000 },
      revealClueIds: { type: "array", maxItems: 100, items: uuid },
      revealItemIds: { type: "array", maxItems: 100, items: uuid },
      isGood: { type: "boolean" },
      sortOrder: { type: "integer", minimum: 0, maximum: 9999 }
    }
  }
};

export const deleteEndingSchema = {
  params: paramsSchema({ worldId: uuid, endingId: uuid })
};