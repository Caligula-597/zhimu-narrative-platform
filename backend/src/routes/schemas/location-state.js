// Location / Scene-State Enhancement — route schemas

import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });
const idParams = paramsSchema({ worldId: uuid, id: uuid });

const stateJson = {
  type: "object",
  additionalProperties: { type: "number" }
};

const locBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: 200 },
    sequence: { type: "integer" },
    kind: { type: "string", enum: ["衙门", "监狱", "开放地图", "现场"] },
    searchable: { type: "boolean" },
    rewritable: { type: "boolean" },
    state: stateJson,
    combat: { type: "boolean" },
    itemsNote: { type: "string", maxLength: 20000 },
    note: { type: "string", maxLength: 20000 }
  }
};

export const listSchema = { params: worldIdParams };
export const getSchema = { params: idParams };
export const createSchema = { params: worldIdParams, body: locBody };
export const updateSchema = { params: idParams, body: locBody };
export const deleteSchema = { params: idParams };