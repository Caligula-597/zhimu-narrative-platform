import { paramsSchema, uuid } from "./primitives.js";

const roomParams = paramsSchema({ roomId: uuid });

export const playerPlayableRuntimeGetSchema = {
  params: roomParams,
};

export const playerPlayableContentGetSchema = {
  params: paramsSchema({ roomId: uuid, contentUnitId: { type: "string", minLength: 1 } }),
};

export const playerPlayableClueGetSchema = {
  params: paramsSchema({ roomId: uuid, clueId: { type: "string", minLength: 1 } }),
};

export const playerPlayableReadSchema = {
  params: roomParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["contentUnitId"],
    properties: {
      contentUnitId: { type: "string", minLength: 1 },
    },
  },
};

export const playerPlayableMechanismBidSchema = {
  params: roomParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["placementId", "amount"],
    properties: {
      placementId: { type: "string", minLength: 1 },
      amount: { type: "number" },
      bidId: { type: "string" },
    },
  },
};

export const playerPlayableMechanismVoteSchema = {
  params: roomParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["placementId", "optionId"],
    properties: {
      placementId: { type: "string", minLength: 1 },
      optionId: { type: "string", minLength: 1 },
    },
  },
};
