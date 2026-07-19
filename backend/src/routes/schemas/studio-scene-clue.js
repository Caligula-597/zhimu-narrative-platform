import { paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const metadataObject = { type: "object", additionalProperties: true };
const optionalUuid = { anyOf: [uuid, { type: "null" }] };
const clueVisibility = { type: "string", enum: ["author", "host", "role", "faction", "public", "postgame"] };
const clueKind = { type: "string", enum: ["general", "deep", "verify", "misdirect", "emotion", "mechanic"] };

export const sceneIdParams = paramsSchema({ worldId: uuid, sceneId: uuid });
export const clueIdParams = paramsSchema({ worldId: uuid, clueId: uuid });

export const createSceneSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 20_000 },
      hostText: { type: "string", maxLength: 20_000 },
      chapterId: optionalUuid,
      metadata: metadataObject
    }
  }
};

export const createClueSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 20_000 },
      hostText: { type: "string", maxLength: 20_000 },
      visibility: clueVisibility,
      clueKind,
      metadata: metadataObject
    }
  }
};

export const patchSceneSchema = {
  params: sceneIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 20_000 },
      hostText: { type: "string", maxLength: 20_000 },
      chapterId: optionalUuid,
      metadata: metadataObject
    }
  }
};

export const patchClueSchema = {
  params: clueIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 20_000 },
      hostText: { type: "string", maxLength: 20_000 },
      visibility: clueVisibility,
      clueKind,
      metadata: metadataObject
    }
  }
};
