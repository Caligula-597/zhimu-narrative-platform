import { paramsSchema, uuid } from "./primitives.js";

const roomParams = paramsSchema({ roomId: uuid });
const cohostParams = paramsSchema({ roomId: uuid, userId: uuid });

export const listHostCohostsSchema = { params: roomParams };

export const appointHostCohostSchema = {
  params: roomParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      userId: uuid,
      email: { type: "string", minLength: 3, maxLength: 254 }
    },
    anyOf: [
      { required: ["userId"] },
      { required: ["email"] }
    ]
  }
};

export const removeHostCohostSchema = { params: cohostParams };
