import { paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const contentVersionIdParams = paramsSchema({ worldId: uuid, versionId: uuid });

export const createContentVersionSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      label: { type: "string", minLength: 1, maxLength: 120 }
    }
  }
};

export const restoreContentVersionSchema = { params: contentVersionIdParams };
export const deleteContentVersionSchema = { params: contentVersionIdParams };
