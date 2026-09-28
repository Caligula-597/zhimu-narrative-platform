import { worldIdParams } from "./world.js";

export const mainlineHierarchyDraftPutSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["draft"],
    properties: {
      draft: {
        type: "object",
        additionalProperties: true,
        maxProperties: 8
      }
    }
  }
};
