// NPC Script Editor — route schemas

import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });
const idParams = paramsSchema({ worldId: uuid, id: uuid });

const salientNums = {
  type: "object",
  additionalProperties: { type: "number" }
};

const npcBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: 200 },
    sequence: { type: "integer" },
    salientNums,
    summary: { type: "string", maxLength: 10000 },
    bio: { type: "string", maxLength: 20000 },
    privateScript: { type: "string", maxLength: 50000 }
  }
};

export const listSchema = { params: worldIdParams };
export const getSchema = { params: idParams };
export const createSchema = { params: worldIdParams, body: npcBody };
export const updateSchema = { params: idParams, body: npcBody };
export const deleteSchema = { params: idParams };