import { paramsSchema, uuid } from "./primitives.js";

const metadataObject = { type: "object", additionalProperties: true };
const optionalUuid = { anyOf: [uuid, { type: "null" }] };

export const investigationPointIdParams = paramsSchema({ worldId: uuid, pointId: uuid });
export const investigationSceneIdParams = paramsSchema({ worldId: uuid, sceneId: uuid });

export const patchInvestigationPointSchema = {
  params: investigationPointIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      description: { type: "string", maxLength: 10_000 },
      interactionText: { type: "string", maxLength: 10_000 },
      resultText: { type: "string", maxLength: 10_000 },
      sceneId: uuid,
      clueId: optionalUuid,
      requiredItemId: optionalUuid,
      requiredRoleSlotId: optionalUuid,
      sequence: { type: "integer", minimum: 0, maximum: 9999 },
      metadata: metadataObject
    }
  }
};

export const createInvestigationPointSchema = {
  params: investigationSceneIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      description: { type: "string", maxLength: 10_000 },
      interactionText: { type: "string", maxLength: 10_000 },
      resultText: { type: "string", maxLength: 10_000 },
      clueId: optionalUuid,
      requiredItemId: optionalUuid,
      requiredRoleSlotId: optionalUuid,
      sequence: { type: "integer", minimum: 0, maximum: 9999 },
      metadata: metadataObject
    }
  }
};
