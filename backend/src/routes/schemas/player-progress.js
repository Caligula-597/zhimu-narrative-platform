import { paramsSchema, uuid } from "./primitives.js";

export const playerProgressRoomIdParams = paramsSchema({ roomId: uuid });

export const completeSectionSchema = {
  params: paramsSchema({ roomId: uuid, sectionId: uuid })
};

export const sectionProgressResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    startedAt: { type: "string", format: "date-time" },
    completedAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] }
  },
  required: ["startedAt"]
};

export const notebookEntrySchema = {
  params: playerProgressRoomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["sourceType", "title", "body"],
    properties: {
      sourceType: { type: "string", enum: ["script_section", "clue", "manual"] },
      sourceId: { anyOf: [uuid, { type: "null" }] },
      title: { type: "string", minLength: 1, maxLength: 120 },
      body: { type: "string", minLength: 1, maxLength: 5000 }
    }
  }
};

export const deleteNotebookEntrySchema = {
  params: paramsSchema({ roomId: uuid, entryId: uuid })
};

export const submitMiniGameSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["roomId", "answer"],
    anyOf: [
      { required: ["instanceId"] },
      { required: ["instance_id"] },
      { required: ["gameId"] },
      { required: ["game_id"] }
    ],
    properties: {
      roomId: uuid,
      instanceId: uuid,
      instance_id: uuid,
      gameId: uuid,
      game_id: uuid,
      answer: { type: "string", minLength: 1, maxLength: 64 }
    }
  }
};
