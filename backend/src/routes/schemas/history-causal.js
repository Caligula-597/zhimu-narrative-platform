// Historical Causality Table — route schemas (缺口 H)

import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });
const idParams = paramsSchema({ worldId: uuid, id: uuid });

const historyCausalBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: 120 },
    sequence: { type: "integer", minimum: 0, maximum: 100000 },
    whenText: { type: "string", maxLength: 200 },
    actors: { type: "string", maxLength: 2000 },
    causeText: { type: "string", maxLength: 20000 },
    eventText: { type: "string", maxLength: 20000 },
    effectText: { type: "string", maxLength: 20000 },
    summary: { type: "string", maxLength: 20000 }
  }
};

export const listSchema = { params: worldIdParams };

export const getSchema = { params: idParams };

export const createSchema = {
  params: worldIdParams,
  body: historyCausalBody
};

export const updateSchema = {
  params: idParams,
  body: historyCausalBody
};

export const deleteSchema = { params: idParams };