// Runtime State Machine + Host Exception Remediation — route schemas (缺口 M)

import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });
const idParams = paramsSchema({ worldId: uuid, id: uuid });

const runtimeStateSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", maxLength: 80 },
    name: { type: "string", maxLength: 200 },
    description: { type: "string", maxLength: 10000 },
    condition: { type: "string", maxLength: 10000 },
    action: { type: "string", maxLength: 10000 },
    nextState: { type: "string", maxLength: 200 },
    remedy: { type: "string", maxLength: 10000 }
  }
};

const runtimeMachineBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: 120 },
    sequence: { type: "integer", minimum: 0, maximum: 100000 },
    startState: { type: "string", maxLength: 200 },
    endState: { type: "string", maxLength: 200 },
    summary: { type: "string", maxLength: 10000 },
    states: {
      type: "array",
      maxItems: 200,
      items: runtimeStateSchema
    }
  }
};

export const listSchema = { params: worldIdParams };

export const getSchema = { params: idParams };

export const createSchema = {
  params: worldIdParams,
  body: runtimeMachineBody
};

export const updateSchema = {
  params: idParams,
  body: runtimeMachineBody
};

export const deleteSchema = { params: idParams };