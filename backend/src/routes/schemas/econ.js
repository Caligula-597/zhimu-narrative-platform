// Economic System Editor — route schemas

import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });
const idParams = paramsSchema({ worldId: uuid, id: uuid });

const econBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: 120 },
    category: { type: "string", enum: ["initial", "auction", "treasure", "rule"] },
    sequence: { type: "integer" },
    actorLabel: { type: "string", maxLength: 120 },
    amount: { type: ["number", "integer"] },
    source: { type: "string", maxLength: 10000 },
    note: { type: "string", maxLength: 10000 },
    summary: { type: "string", maxLength: 10000 }
  }
};

export const listSchema = { params: worldIdParams };
export const getSchema = { params: idParams };
export const createSchema = { params: worldIdParams, body: econBody };
export const updateSchema = { params: idParams, body: econBody };
export const deleteSchema = { params: idParams };