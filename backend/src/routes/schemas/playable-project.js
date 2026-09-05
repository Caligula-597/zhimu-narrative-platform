import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });

export const getPlayableProjectSchema = {
  params: worldIdParams,
};

export const putPlayableProjectSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["project"],
    properties: {
      project: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
};

export const postCompilePlayableFixtureSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      fixtureId: { type: "string" },
    },
  },
};
