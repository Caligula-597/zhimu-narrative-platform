import { paramsSchema, uuid } from "./primitives.js";

export const listItemActionsSchema = { params: paramsSchema({ roomId: uuid }) };

export const submitItemActionSchema = {
  params: paramsSchema({ roomId: uuid, itemId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["actionKey", "targetType"],
    properties: {
      actionKey: { type: "string", pattern: "^[a-z][a-z0-9_]{1,63}$" },
      targetType: { type: "string", enum: ["none", "role", "location"] },
      targetId: { anyOf: [uuid, { type: "null" }] },
      combineItemId: { anyOf: [uuid, { type: "null" }] },
    },
  },
};

export const resolveItemActionSchema = {
  params: paramsSchema({ roomId: uuid, actionId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["expectedRevision", "decision"],
    properties: {
      expectedRevision: { type: "integer", minimum: 1 },
      decision: { type: "string", enum: ["approve", "reject"] },
    },
  },
};
