import { roomContentBindingSchema } from "./creator-room.js";
import { paramsSchema, uuid } from "./primitives.js";

const roomIdParams = paramsSchema({ roomId: uuid });
const openObject = { type: "object", additionalProperties: true };
const nullableOpenObject = { anyOf: [openObject, { type: "null" }] };

const mechanismRuntimeResponse = {
  type: "object",
  additionalProperties: false,
  required: [
    "initialized",
    "roomId",
    "worldId",
    "contentBinding",
    "stale",
    "submissionSummary",
    "state",
  ],
  properties: {
    initialized: { type: "boolean" },
    roomId: uuid,
    worldId: uuid,
    contentBinding: roomContentBindingSchema,
    stale: { type: "boolean" },
    submissionSummary: { type: "array", items: openObject },
    state: nullableOpenObject,
    history: { type: "array", items: openObject },
    replayed: { type: "boolean" },
    appliedAction: openObject,
    changes: { type: "array", items: openObject },
  },
};

export const hostMechanismRuntimeGetSchema = {
  params: roomIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      includeHistory: { type: "boolean", default: false },
      historyLimit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
    },
  },
  response: { 200: mechanismRuntimeResponse },
};

export const hostMechanismRuntimeInitializeSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      resetExisting: { type: "boolean", default: false },
      expectedRevision: { type: "integer", minimum: 1 },
    },
    allOf: [
      {
        if: {
          properties: { resetExisting: { const: true } },
          required: ["resetExisting"],
        },
        then: { required: ["expectedRevision"] },
      },
    ],
  },
  response: { 200: mechanismRuntimeResponse, 201: mechanismRuntimeResponse },
};

const mechanismOverrideEffect = {
  type: "object",
  additionalProperties: false,
  required: ["targetType", "targetKey", "operation"],
  properties: {
    targetType: { type: "string", enum: ["state", "resource", "evidence"] },
    targetKey: { type: "string", minLength: 1, maxLength: 160 },
    operation: { type: "string" },
    value: {},
    amount: { type: "number" },
  },
  allOf: [
    {
      if: {
        properties: { targetType: { const: "state" } },
        required: ["targetType"],
      },
      then: {
        required: ["value"],
        properties: {
          operation: {
            type: "string",
            enum: ["set", "increment", "decrement", "add", "remove"],
          },
        },
      },
    },
    {
      if: {
        properties: { targetType: { const: "resource" } },
        required: ["targetType"],
      },
      then: {
        required: ["amount"],
        properties: {
          operation: { type: "string", enum: ["gain", "lose", "set"] },
        },
      },
    },
    {
      if: {
        properties: { targetType: { const: "evidence" } },
        required: ["targetType"],
      },
      then: {
        properties: { operation: { type: "string", enum: ["unlock", "lock"] } },
      },
    },
  ],
};

const mechanismAction = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: {
    type: {
      type: "string",
      enum: ["decision", "investigation", "advance", "override"],
    },
    decisionKey: { type: "string", minLength: 1, maxLength: 120 },
    optionKey: { type: "string", minLength: 1, maxLength: 120 },
    source: {
      type: "string",
      enum: ["host_confirmed", "deadline_default"],
    },
    investigationKey: { type: "string", minLength: 1, maxLength: 160 },
    outcome: { type: "string", enum: ["success", "failure"] },
    reason: { type: "string", minLength: 10, maxLength: 500 },
    effects: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: mechanismOverrideEffect,
    },
  },
  allOf: [
    {
      if: { properties: { type: { const: "decision" } }, required: ["type"] },
      then: { required: ["decisionKey", "optionKey"] },
    },
    {
      if: {
        properties: { type: { const: "investigation" } },
        required: ["type"],
      },
      then: { required: ["investigationKey"] },
    },
    {
      if: { properties: { type: { const: "override" } }, required: ["type"] },
      then: { required: ["reason", "effects"] },
    },
  ],
};

export const hostMechanismRuntimeActionSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["expectedRevision", "action"],
    properties: {
      expectedRevision: { type: "integer", minimum: 1 },
      action: mechanismAction,
    },
  },
  response: { 200: mechanismRuntimeResponse },
};
