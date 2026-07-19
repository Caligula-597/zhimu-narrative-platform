import { nonEmptyText, paramsSchema, uuid } from "./primitives.js";

const roomIdParams = paramsSchema({ roomId: uuid });

export const hostLogSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["message"],
    properties: {
      message: { ...nonEmptyText, pattern: "\\S" },
      eventType: { type: "string", minLength: 1, maxLength: 40, pattern: "^[A-Za-z0-9_.:-]+$" },
      roleSlotId: uuid
    }
  }
};

export const hostNudgeWaitingSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      message: { type: "string", maxLength: 500 },
      roleSlotIds: {
        type: "array",
        items: uuid,
        maxItems: 32,
        uniqueItems: true
      }
    }
  }
};
