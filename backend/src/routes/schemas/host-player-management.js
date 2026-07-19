import { paramsSchema, uuid } from "./primitives.js";

const hostPlayerParams = paramsSchema({ roomId: uuid, roleSlotId: uuid });

export const hostPlayerNotesSchema = {
  params: hostPlayerParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["notes"],
    properties: {
      notes: { type: "string", maxLength: 2000 }
    }
  }
};

export const hostPlayerKickSchema = { params: hostPlayerParams };
