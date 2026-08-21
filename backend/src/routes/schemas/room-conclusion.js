import { paramsSchema, uuid } from "./primitives.js";

export const roomConclusionSchema = { params: paramsSchema({ roomId: uuid }) };

export const prepareRoomConclusionSchema = {
  params: paramsSchema({ roomId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["endingId", "idempotencyKey"],
    properties: {
      endingId: { type: "string", minLength: 1, maxLength: 80 },
      idempotencyKey: { type: "string", minLength: 8, maxLength: 160 },
      title: { type: "string", minLength: 1, maxLength: 120, pattern: "\\S" },
      description: { type: "string", maxLength: 2000 },
    },
  },
};
