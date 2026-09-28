// Object Lifecycle Editor — route schemas

import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });
const idParams = paramsSchema({ worldId: uuid, id: uuid });

const lifecycleBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: 120 },
    itemId: { oneOf: [{ type: "string", format: "uuid" }, { type: "null" }] },
    itemLabel: { type: "string", maxLength: 120 },
    summary: { type: "string", maxLength: 10000 },
    stages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string", maxLength: 120 },
          description: { type: "string", maxLength: 10000 },
          trigger: { type: "string", maxLength: 10000 },
          change: { type: "string", maxLength: 10000 },
          holder: { type: "string", maxLength: 120 }
        }
      }
    }
  }
};

export const listSchema = { params: worldIdParams };

export const getSchema = { params: idParams };

export const createSchema = {
  params: worldIdParams,
  body: lifecycleBody
};

export const updateSchema = {
  params: idParams,
  body: lifecycleBody
};

export const deleteSchema = { params: idParams };