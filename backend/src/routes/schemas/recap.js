import { paramsSchema, uuid } from "./primitives.js";

export const recapRoomParams = paramsSchema({ roomId: uuid });
export const recapIdParams = paramsSchema({ roomId: uuid, recapId: uuid });

export const listRecapsSchema = { params: recapRoomParams };
export const latestRecapSchema = { params: recapRoomParams };
export const recapDetailSchema = { params: recapIdParams };

export const createRecapSchema = {
  params: recapRoomParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 120, pattern: "\\S" },
      description: { type: "string", maxLength: 2000 }
    }
  }
};

export const recapLibraryListSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      worldId: uuid,
      roleSlotId: uuid,
      limit: { type: "integer", minimum: 1, maximum: 100, default: 100 },
    },
  },
};

export const recapLibraryEntrySchema = {
  params: paramsSchema({ recapId: uuid }),
};

export const recapLibraryPreferencesSchema = {
  params: recapRoomParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["retentionDays"],
    properties: {
      retentionDays: { type: "integer", minimum: 0, maximum: 3650 },
    },
  },
};
