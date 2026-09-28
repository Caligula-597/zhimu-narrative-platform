// Relationship Arc Editor — route schemas

import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });

const relationshipStageSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label"],
  properties: {
    id: { type: "string", maxLength: 80 },
    label: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", maxLength: 3000 },
    trigger: { type: "string", maxLength: 2000 },
    change: { type: "string", maxLength: 2000 }
  }
};

const relationshipArcBody = {
  type: "object",
  additionalProperties: false,
  required: ["title", "charALabel", "charBLabel", "summary", "stages"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    charAId: { type: "string", maxLength: 80 },
    charALabel: { type: "string", maxLength: 200 },
    charBId: { type: "string", maxLength: 80 },
    charBLabel: { type: "string", maxLength: 200 },
    summary: { type: "string", maxLength: 5000 },
    stages: {
      type: "array",
      maxItems: 100,
      items: relationshipStageSchema
    }
  }
};

export const listRelationshipArcsSchema = {
  params: worldIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 500 },
      offset: { type: "integer", minimum: 0, maximum: 10000 }
    }
  }
};

export const getRelationshipArcSchema = {
  params: paramsSchema({ worldId: uuid, arcId: uuid })
};

export const createRelationshipArcSchema = {
  params: worldIdParams,
  body: relationshipArcBody
};

export const updateRelationshipArcSchema = {
  params: paramsSchema({ worldId: uuid, arcId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      charAId: { type: "string", maxLength: 80 },
      charALabel: { type: "string", maxLength: 200 },
      charBId: { type: "string", maxLength: 80 },
      charBLabel: { type: "string", maxLength: 200 },
      summary: { type: "string", maxLength: 5000 },
      stages: {
        type: "array",
        maxItems: 100,
        items: relationshipStageSchema
      }
    }
  }
};

export const deleteRelationshipArcSchema = {
  params: paramsSchema({ worldId: uuid, arcId: uuid })
};