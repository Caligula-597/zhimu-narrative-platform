import { paramsSchema, uuid } from "./primitives.js";

export const playerProgressRoomIdParams = paramsSchema({ roomId: uuid });

export const completeSectionSchema = {
  params: paramsSchema({ roomId: uuid, sectionId: uuid }),
};

export const sectionProgressResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    startedAt: { type: "string", format: "date-time" },
    completedAt: {
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
  },
  required: ["startedAt"],
};

export const notebookEntrySchema = {
  params: playerProgressRoomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["sourceType", "title", "body"],
    properties: {
      sourceType: {
        type: "string",
        enum: ["script_section", "clue", "manual"],
      },
      sourceId: { anyOf: [uuid, { type: "null" }] },
      title: { type: "string", minLength: 1, maxLength: 120 },
      body: { type: "string", minLength: 1, maxLength: 5000 },
    },
  },
};

export const deleteNotebookEntrySchema = {
  params: paramsSchema({ roomId: uuid, entryId: uuid }),
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
      { required: ["game_id"] },
    ],
    properties: {
      roomId: uuid,
      instanceId: uuid,
      instance_id: uuid,
      gameId: uuid,
      game_id: uuid,
      answer: { type: "string", minLength: 1, maxLength: 64 },
      expectedRevision: { type: "integer", minimum: 1 },
    },
  },
};

export const submitMechanismDecisionSchema = {
  params: paramsSchema({
    roomId: uuid,
    decisionKey: { type: "string", minLength: 1, maxLength: 160 },
  }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["expectedRevision"],
    anyOf: [{ required: ["optionKey"] }, { required: ["answer"] }],
    properties: {
      expectedRevision: { type: "integer", minimum: 1 },
      optionKey: { type: "string", minLength: 1, maxLength: 160 },
      answer: {
        type: "object",
        additionalProperties: false,
        required: ["type"],
        properties: {
          type: {
            type: "string",
            enum: ["single_choice", "ranking", "allocation"],
          },
          optionKey: { type: "string", minLength: 1, maxLength: 160 },
          optionKeys: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            uniqueItems: true,
            items: { type: "string", minLength: 1, maxLength: 160 },
          },
          allocations: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["optionKey", "amount"],
              properties: {
                optionKey: { type: "string", minLength: 1, maxLength: 160 },
                amount: { type: "integer", minimum: 0, maximum: 10000 },
              },
            },
          },
        },
        allOf: [
          {
            if: { properties: { type: { const: "single_choice" } }, required: ["type"] },
            then: { required: ["optionKey"] },
          },
          {
            if: { properties: { type: { const: "ranking" } }, required: ["type"] },
            then: { required: ["optionKeys"] },
          },
          {
            if: { properties: { type: { const: "allocation" } }, required: ["type"] },
            then: { required: ["allocations"] },
          },
        ],
      },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["decisionKey", "answer", "revision", "submittedAt"],
      properties: {
        decisionKey: { type: "string" },
        optionKey: { type: "string" },
        answer: { type: "object", additionalProperties: true },
        revision: { type: "integer" },
        submittedAt: { type: "string" },
      },
    },
  },
};
