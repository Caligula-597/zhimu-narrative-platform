import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });

export const getProjectStoryStateSchema = {
  params: worldIdParams,
};

export const putProjectStoryStateSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
};
