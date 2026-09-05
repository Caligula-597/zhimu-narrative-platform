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
