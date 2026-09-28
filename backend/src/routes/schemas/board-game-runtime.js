import { paramsSchema, uuid } from "./primitives.js";

const roomParams = paramsSchema({ roomId: uuid });

export const boardGameRuntimeGetSchema = { params: roomParams };
export const boardGameRuntimeInitializeSchema = { params: roomParams, body: { type: "object", additionalProperties: false } };
export const boardGameRuntimeCommandSchema = {
  params: roomParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["commandId", "designSignature", "seatIndex"],
    properties: {
      protocolVersion: { type: "integer", minimum: 1 },
      commandType: { type: "string", enum: ["action", "advance"] },
      commandId: { type: "string", minLength: 1, maxLength: 120 },
      clientSequence: { type: "integer", minimum: 0, maximum: 1000000000 },
      designSignature: { type: "string", minLength: 1, maxLength: 20000 },
      seatIndex: { type: "integer", minimum: 0, maximum: 98 },
      actionId: { type: "string", maxLength: 120 },
      targetId: { type: "string", maxLength: 120 },
      cardId: { type: "string", maxLength: 200 },
      bidAmount: { type: "integer", minimum: 0, maximum: 999999 },
      issuedAt: { type: "integer", minimum: 0, maximum: 9999999999999 }
    }
  }
};
