import { paramsSchema, uuid } from "./primitives.js";

const roomParams = paramsSchema({ roomId: uuid });

export const hostPlayableRuntimeGetSchema = {
  params: roomParams,
};

export const hostPlayableRuntimeInitializeSchema = {
  params: roomParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      useFixtureFallback: { type: "boolean" },
    },
  },
};

export const hostPlayableRuntimeActionSchema = {
  params: roomParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["action"],
    properties: {
      action: {
        type: "string",
        enum: [
          "assign_role",
          "start",
          "release_content",
          "release_clue",
          "advance",
          "finish",
          "start_mechanism",
          "settle_mechanism",
        ],
      },
      userId: { type: "string" },
      playableRoleId: { type: "string" },
      roleSlotId: { type: "string" },
      contentUnitId: { type: "string" },
      clueId: { type: "string" },
      placementId: { type: "string" },
    },
  },
};
