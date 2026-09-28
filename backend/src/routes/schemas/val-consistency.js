// Val Consistency Ledger — route schemas

import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });
const idParams = paramsSchema({ worldId: uuid, id: uuid });

const valBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: 120 },
    sequence: { type: "integer" },
    referencesEntry: { type: "string", maxLength: 10000 },
    conflictDesc: { type: "string", maxLength: 10000 },
    versionA: { type: "string", maxLength: 10000 },
    versionB: { type: "string", maxLength: 10000 },
    recommendation: { type: "string", maxLength: 10000 },
    status: { type: "string", enum: ["未决", "待裁决", "已统一"] }
  }
};

export const listSchema = { params: worldIdParams };
export const getSchema = { params: idParams };
export const createSchema = { params: worldIdParams, body: valBody };
export const updateSchema = { params: idParams, body: valBody };
export const deleteSchema = { params: idParams };