import { paramsSchema, uuid } from "./primitives.js";

export const checkpointRoomIdParams = paramsSchema({ roomId: uuid });

export const checkpointIdParams = paramsSchema({
  roomId: uuid,
  checkpointId: uuid
});

export const createCheckpointSchema = {
  params: checkpointRoomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 120 },
      description: { type: "string", maxLength: 2000 }
    }
  }
};

export const restoreCheckpointSchema = {
  params: checkpointIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      scope: {
        type: "object",
        additionalProperties: false,
        properties: {
          readingProgress: { type: "boolean" },
          clueOwnership: { type: "boolean" },
          inventory: { type: "boolean" },
          contentUnlocks: { type: "boolean" },
          pendingHostEvents: { type: "boolean" },
          investigationRecords: { type: "boolean" },
          playerStates: { type: "boolean" },
          ruleExecutions: { type: "boolean" },
          timelineLogs: { type: "boolean" }
        }
      }
    }
  }
};
