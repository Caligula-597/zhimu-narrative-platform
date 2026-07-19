import { paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const studioNodeType = { type: "string", enum: ["chapter", "scene", "clue", "investigation_point", "item"] };
const graphNodeType = { type: "string", enum: ["chapter", "scene", "clue", "investigation_point", "item"] };
const studioLayoutMode = {
  type: "string",
  enum: ["scene-tree", "columns", "flow-horizontal", "flow-vertical", "chapter-groups"]
};
const storyEdgeNodeType = { type: "string", enum: ["chapter", "scene", "clue", "investigation_point"] };
const relationType = { type: "string", enum: ["mainline", "parallel", "extension"] };

export const storyEdgeIdParams = paramsSchema({ worldId: uuid, edgeId: uuid });
export const studioNodeParams = paramsSchema({ worldId: uuid, nodeType: graphNodeType, nodeId: uuid });

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
