import { paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const metadataObject = { type: "object", additionalProperties: true };
const optionalUuid = { anyOf: [uuid, { type: "null" }] };
const clueVisibility = { type: "string", enum: ["author", "host", "role", "faction", "public", "postgame"] };
const studioNodeType = { type: "string", enum: ["chapter", "scene", "clue", "investigation_point", "item"] };
const graphNodeType = { type: "string", enum: ["chapter", "scene", "clue", "investigation_point", "item"] };
const studioLayoutMode = {
  type: "string",
  enum: ["scene-tree", "columns", "flow-horizontal", "flow-vertical", "chapter-groups"]
};
const storyEdgeNodeType = { type: "string", enum: ["chapter", "scene", "clue", "investigation_point"] };
const relationType = { type: "string", enum: ["mainline", "parallel", "extension"] };

export const sceneIdParams = paramsSchema({ worldId: uuid, sceneId: uuid });
export const clueIdParams = paramsSchema({ worldId: uuid, clueId: uuid });
export const investigationPointIdParams = paramsSchema({ worldId: uuid, pointId: uuid });
export const itemIdParams = paramsSchema({ worldId: uuid, itemId: uuid });
export const contentVersionIdParams = paramsSchema({ worldId: uuid, versionId: uuid });
export const storyEdgeIdParams = paramsSchema({ worldId: uuid, edgeId: uuid });
export const studioNodeParams = paramsSchema({ worldId: uuid, nodeType: graphNodeType, nodeId: uuid });

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
      clueKind: { type: "string", enum: ["general", "deep", "verify", "misdirect", "emotion", "mechanic"] },
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
      clueKind: { type: "string", enum: ["general", "deep", "verify", "misdirect", "emotion", "mechanic"] },
      metadata: metadataObject
    }
  }
};

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
  params: sceneIdParams,
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

export const createItemSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 10_000 },
      hostText: { type: "string", maxLength: 10_000 },
      unique: { type: "boolean" },
      consumable: { type: "boolean" },
      assetId: optionalUuid,
      metadata: metadataObject
    }
  }
};

export const patchItemSchema = {
  params: itemIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 10_000 },
      hostText: { type: "string", maxLength: 10_000 },
      unique: { type: "boolean" },
      consumable: { type: "boolean" },
      assetId: optionalUuid,
      metadata: metadataObject
    }
  }
};

export const deleteItemSchema = { params: itemIdParams };

export const createContentVersionSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: { label: { type: "string", minLength: 1, maxLength: 120 } }
  }
};

export const restoreContentVersionSchema = { params: contentVersionIdParams };
export const deleteContentVersionSchema = { params: contentVersionIdParams };

export const createStoryEdgeSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["fromType", "fromId", "toType", "toId"],
    properties: {
      fromType: storyEdgeNodeType,
      fromId: uuid,
      toType: storyEdgeNodeType,
      toId: uuid,
      relationType,
      label: { type: "string", maxLength: 200 }
    }
  }
};

export const deleteStoryEdgeSchema = { params: storyEdgeIdParams };
export const deleteStudioNodeSchema = {
  params: paramsSchema({ worldId: uuid, nodeType: studioNodeType, nodeId: uuid })
};
export const studioNodeReferencesSchema = {
  params: paramsSchema({ worldId: uuid, nodeType: studioNodeType, nodeId: uuid })
};

export const updateNodePositionSchema = {
  params: studioNodeParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["x", "y"],
    properties: { x: { type: "number" }, y: { type: "number" } }
  }
};

export const updateNodeAnchorsSchema = {
  params: studioNodeParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["anchors"],
    properties: {
      anchors: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "x", "y"],
          properties: {
            id: { type: "string", minLength: 1, maxLength: 80 },
            x: { type: "number" },
            y: { type: "number" }
          }
        }
      }
    }
  }
};

export const updateStoryLayoutSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["positions"],
    properties: {
      positions: {
        type: "array",
        maxItems: 1000,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "id", "x", "y"],
          properties: {
            type: graphNodeType,
            id: uuid,
            x: { type: "number" },
            y: { type: "number" }
          }
        }
      }
    }
  }
};

export const autoStoryLayoutSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: { mode: { ...studioLayoutMode, default: "columns" } }
  }
};
