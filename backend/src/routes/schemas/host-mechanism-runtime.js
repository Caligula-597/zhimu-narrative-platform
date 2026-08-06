import { roomContentBindingSchema } from "./creator-room.js";
import { paramsSchema, uuid } from "./primitives.js";

const roomIdParams = paramsSchema({ roomId: uuid });
const openObject = { type: "object", additionalProperties: true };
const nullableOpenObject = { anyOf: [openObject, { type: "null" }] };

const mechanismRuntimeResponse = {
  type: "object",
  additionalProperties: false,
  required: ["initialized", "roomId", "worldId", "contentBinding", "stale", "state"],
  properties: {
    initialized: { type: "boolean" },
    roomId: uuid,
    worldId: uuid,
    contentBinding: roomContentBindingSchema,
    stale: { type: "boolean" },
    state: nullableOpenObject,
    history: { type: "array", items: openObject },
    replayed: { type: "boolean" },
    appliedAction: openObject,
    changes: { type: "array", items: openObject }
  }
};

export const hostMechanismRuntimeGetSchema = {
  params: roomIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      includeHistory: { type: "boolean", default: false },
      historyLimit: { type: "integer", minimum: 1, maximum: 200, default: 50 }
    }
  },
  response: { 200: mechanismRuntimeResponse }
};

export const hostMechanismRuntimeInitializeSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      resetExisting: { type: "boolean", default: false },
      expectedRevision: { type: "integer", minimum: 1 }
    },
    allOf: [{
      if: { properties: { resetExisting: { const: true } }, required: ["resetExisting"] },
      then: { required: ["expectedRevision"] }
    }]
  },
  response: { 200: mechanismRuntimeResponse, 201: mechanismRuntimeResponse }
};

const decisionAction = {
  type: "object",
  additionalProperties: false,
  required: ["type", "decisionKey", "optionKey"],
  properties: {
    type: { const: "decision" },
    decisionKey: { type: "string", minLength: 1, maxLength: 120 },
    optionKey: { type: "string", minLength: 1, maxLength: 120 }
  }
};

const investigationAction = {
  type: "object",
  additionalProperties: false,
  required: ["type", "investigationKey"],
  properties: {
    type: { const: "investigation" },
    investigationKey: { type: "string", minLength: 1, maxLength: 160 },
    outcome: { type: "string", enum: ["success", "failure"] }
  }
};

const advanceAction = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: { type: { const: "advance" } }
};

const stateOverrideEffect = {
  type: "object",
  additionalProperties: false,
  required: ["targetType", "targetKey", "operation", "value"],
  properties: {
    targetType: { const: "state" },
    targetKey: { type: "string", minLength: 1, maxLength: 160 },
    operation: { type: "string", enum: ["set", "increment", "decrement", "add", "remove"] },
    value: {}
  }
};

const resourceOverrideEffect = {
  type: "object",
  additionalProperties: false,
  required: ["targetType", "targetKey", "operation", "amount"],
  properties: {
    targetType: { const: "resource" },
    targetKey: { type: "string", minLength: 1, maxLength: 160 },
    operation: { type: "string", enum: ["gain", "lose", "set"] },
    amount: { type: "number" }
  }
};

const evidenceOverrideEffect = {
  type: "object",
  additionalProperties: false,
  required: ["targetType", "targetKey", "operation"],
  properties: {
    targetType: { const: "evidence" },
    targetKey: { type: "string", minLength: 1, maxLength: 160 },
    operation: { type: "string", enum: ["unlock", "lock"] }
  }
};

const overrideAction = {
  type: "object",
  additionalProperties: false,
  required: ["type", "reason", "effects"],
  properties: {
    type: { const: "override" },
    reason: { type: "string", minLength: 10, maxLength: 500 },
    effects: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: { oneOf: [stateOverrideEffect, resourceOverrideEffect, evidenceOverrideEffect] }
    }
  }
};

export const hostMechanismRuntimeActionSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["expectedRevision", "action"],
    properties: {
      expectedRevision: { type: "integer", minimum: 1 },
      action: { oneOf: [decisionAction, investigationAction, advanceAction, overrideAction] }
    }
  },
  response: { 200: mechanismRuntimeResponse }
};
