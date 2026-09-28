// Timeline Editor — route schemas

import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });

const cognitionItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["characterId", "content", "isMisleading"],
  properties: {
    id: { type: "string", maxLength: 80 },
    characterId: { type: "string", minLength: 1, maxLength: 80 },
    content: { type: "string", minLength: 1, maxLength: 2000 },
    isMisleading: { type: "boolean" }
  }
};

const timelineEntryBody = {
  type: "object",
  additionalProperties: false,
  required: ["actId", "timestamp", "sortOrder", "parallelLine", "actorId", "action", "impact", "cognitions"],
  properties: {
    actId: { type: "string", minLength: 1, maxLength: 80 },
    timestamp: { type: "string", maxLength: 80 },
    sortOrder: { type: "integer", minimum: 0, maximum: 9999 },
    parallelLine: { type: "integer", minimum: 0, maximum: 5 },
    actorId: { type: "string", maxLength: 80 },
    action: { type: "string", minLength: 1, maxLength: 5000 },
    impact: { type: "string", maxLength: 5000 },
    cognitions: {
      type: "array",
      maxItems: 200,
      items: cognitionItemSchema
    }
  }
};

export const listTimelineEntriesSchema = {
  params: worldIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      actId: { type: "string", maxLength: 80 },
      parallelLine: { type: "integer", minimum: 0, maximum: 5 },
      limit: { type: "integer", minimum: 1, maximum: 500 },
      offset: { type: "integer", minimum: 0, maximum: 10000 }
    }
  }
};

export const getTimelineEntrySchema = {
  params: paramsSchema({ worldId: uuid, entryId: uuid })
};

export const createTimelineEntrySchema = {
  params: worldIdParams,
  body: timelineEntryBody
};

export const updateTimelineEntrySchema = {
  params: paramsSchema({ worldId: uuid, entryId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      actId: { type: "string", maxLength: 80 },
      timestamp: { type: "string", maxLength: 80 },
      sortOrder: { type: "integer", minimum: 0, maximum: 9999 },
      parallelLine: { type: "integer", minimum: 0, maximum: 5 },
      actorId: { type: "string", maxLength: 80 },
      action: { type: "string", maxLength: 5000 },
      impact: { type: "string", maxLength: 5000 },
      cognitions: {
        type: "array",
        maxItems: 200,
        items: cognitionItemSchema
      }
    }
  }
};

export const deleteTimelineEntrySchema = {
  params: paramsSchema({ worldId: uuid, entryId: uuid })
};

export const batchUpdateTimelineSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["entries"],
    properties: {
      entries: {
        type: "array",
        minItems: 1,
        maxItems: 200,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: uuid,
            sortOrder: { type: "integer", minimum: 0, maximum: 9999 },
            parallelLine: { type: "integer", minimum: 0, maximum: 5 },
            timestamp: { type: "string", maxLength: 80 },
            action: { type: "string", maxLength: 5000 },
            impact: { type: "string", maxLength: 5000 }
          }
        }
      }
    }
  }
};