import { nonEmptyText, paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

export const createWorldSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      summary: { type: "string", maxLength: 4000 },
      settings: { type: "object", additionalProperties: true }
    }
  }
};

export const assetIdParams = paramsSchema({ assetId: uuid });

export const assetUploadUrlSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["worldId", "filename", "contentType", "byteSize"],
    properties: {
      worldId: uuid,
      roomId: { anyOf: [uuid, { type: "null" }] },
      filename: { type: "string", minLength: 1, maxLength: 255 },
      contentType: { type: "string", minLength: 3, maxLength: 120 },
      byteSize: { type: "integer", minimum: 1, maximum: 31_457_280 },
      visibility: { type: "string", enum: ["author", "host", "role", "public"] },
      roleSlotId: { anyOf: [uuid, { type: "null" }] }
    }
  }
};

export const confirmAssetSchema = {
  params: assetIdParams
};

export const deleteAssetSchema = {
  params: assetIdParams
};

export const restoreAssetSchema = {
  params: assetIdParams
};

const metadataObject = { type: "object", additionalProperties: true };
const optionalUuid = { anyOf: [uuid, { type: "null" }] };
const publicationStatus = { type: "string", enum: ["draft", "testing", "published"] };
const clueVisibility = { type: "string", enum: ["author", "host", "role", "faction", "public", "postgame"] };
const studioNodeType = { type: "string", enum: ["chapter", "scene", "clue", "investigation_point", "item"] };
const graphNodeType = { type: "string", enum: ["chapter", "scene", "clue", "investigation_point", "item"] };
const studioLayoutMode = {
  type: "string",
  enum: ["scene-tree", "columns", "flow-horizontal", "flow-vertical", "chapter-groups"]
};
const storyEdgeNodeType = { type: "string", enum: ["chapter", "scene", "clue", "investigation_point"] };
const relationType = { type: "string", enum: ["mainline", "parallel", "extension"] };
const ruleMode = { type: "string", enum: ["automatic", "host_confirm", "manual"] };

export const sceneIdParams = paramsSchema({ worldId: uuid, sceneId: uuid });
export const clueIdParams = paramsSchema({ worldId: uuid, clueId: uuid });
export const investigationPointIdParams = paramsSchema({ worldId: uuid, pointId: uuid });
export const itemIdParams = paramsSchema({ worldId: uuid, itemId: uuid });
export const roleSlotIdParams = paramsSchema({ worldId: uuid, roleSlotId: uuid });
export const chapterIdParams = paramsSchema({ worldId: uuid, chapterId: uuid });
export const sectionIdParams = paramsSchema({ worldId: uuid, roleSlotId: uuid, sectionId: uuid });
export const contentVersionIdParams = paramsSchema({ worldId: uuid, versionId: uuid });
export const storyEdgeIdParams = paramsSchema({ worldId: uuid, edgeId: uuid });
export const ruleIdParams = paramsSchema({ worldId: uuid, ruleId: uuid });
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
    properties: {
      label: { type: "string", minLength: 1, maxLength: 120 }
    }
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
    properties: {
      x: { type: "number" },
      y: { type: "number" }
    }
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
    properties: {
      mode: { ...studioLayoutMode, default: "columns" }
    }
  }
};

export const parseDocumentSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["filename"],
    properties: {
      filename: { type: "string", minLength: 1, maxLength: 255 },
      contentType: { type: "string", minLength: 3, maxLength: 120 },
      dataBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
      contentBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
      parseMode: { type: "string", enum: ["auto", "pages", "text"] },
      allowOcr: { type: "boolean" }
    },
    anyOf: [{ required: ["dataBase64"] }, { required: ["contentBase64"] }]
  }
};

export const importDocumentPagesSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["filename", "roleSlotId"],
    properties: {
      filename: { type: "string", minLength: 1, maxLength: 255 },
      contentType: { type: "string", minLength: 3, maxLength: 120 },
      dataBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
      contentBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
      roleSlotId: uuid,
      title: { type: "string", maxLength: 200 },
      layout: { type: "string", enum: ["single_section", "one_section_per_page"] },
      publicationStatus,
      parseMode: { type: "string", enum: ["auto", "pages", "text"] },
      allowOcr: { type: "boolean" }
    },
    anyOf: [{ required: ["dataBase64"] }, { required: ["contentBase64"] }]
  }
};

const scriptBundleArchiveBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    filename: { type: "string", minLength: 1, maxLength: 255 },
    dataBase64: { type: "string", minLength: 1, maxLength: 70_000_000 },
    contentBase64: { type: "string", minLength: 1, maxLength: 70_000_000 }
  },
  anyOf: [{ required: ["dataBase64"] }, { required: ["contentBase64"] }]
};

const scriptBundleImportOptions = {
  createMissingRoles: { type: "boolean" },
  pdfLayout: { type: "string", enum: ["single_section", "one_section_per_page"] },
  publicationStatus,
  skipCategories: {
    type: "array",
    maxItems: 12,
    items: {
      type: "string",
      enum: ["role_script", "clue", "host_manual", "public_script", "role_profile", "asset", "unknown"]
    }
  },
  roleMappings: {
    type: "object",
    additionalProperties: { type: "string", minLength: 36, maxLength: 36 }
  }
};

export const scriptBundleAnalyzeSchema = {
  params: worldIdParams,
  body: scriptBundleArchiveBody
};

export const scriptBundleImportSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: [],
    properties: {
      ...scriptBundleArchiveBody.properties,
      ...scriptBundleImportOptions
    },
    anyOf: scriptBundleArchiveBody.anyOf
  }
};

export const scriptBundleNewWorldSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...scriptBundleArchiveBody.properties,
      ...scriptBundleImportOptions,
      worldName: { type: "string", minLength: 1, maxLength: 120 },
      name: { type: "string", minLength: 1, maxLength: 120 },
      worldSummary: { type: "string", maxLength: 2000 },
      summary: { type: "string", maxLength: 2000 },
      playerCount: { type: "integer", minimum: 1, maximum: 20 }
    },
    anyOf: scriptBundleArchiveBody.anyOf
  }
};

export const importDocumentSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["target", "document"],
    properties: {
      target: { type: "string", enum: ["manuscript", "role_script"] },
      roleSlotId: optionalUuid,
      document: {
        type: "object",
        additionalProperties: false,
        required: ["text", "sections"],
        properties: {
          text: { type: "string", maxLength: 2_000_000 },
          filename: { type: "string", maxLength: 255 },
          sections: {
            type: "array",
            maxItems: 500,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "body"],
              properties: {
                title: { type: "string", minLength: 1, maxLength: 200 },
                body: { type: "string", maxLength: 200_000 }
              }
            }
          }
        }
      }
    }
  }
};

export const createRoleSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "sequence"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicProfile: { type: "string", maxLength: 4000 },
      privateProfile: { type: "string", maxLength: 20_000 },
      sequence: { type: "integer", minimum: 0, maximum: 9999 }
    }
  }
};

export const updateRoleSchema = {
  params: roleSlotIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "sequence"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicProfile: { type: "string", maxLength: 4000 },
      privateProfile: { type: "string", maxLength: 20_000 },
      sequence: { type: "integer", minimum: 0, maximum: 9999 }
    }
  }
};

export const deleteRoleSchema = { params: roleSlotIdParams };

export const createChapterSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "sequence"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      summary: { type: "string", maxLength: 4000 },
      sequence: { type: "integer", minimum: 0, maximum: 9999 }
    }
  }
};

export const updateChapterSchema = {
  params: chapterIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      summary: { type: "string", maxLength: 4000 },
      publicationStatus,
      unlockRules: metadataObject,
      metadata: metadataObject
    }
  }
};

export const createSectionSchema = {
  params: roleSlotIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "body", "sequence"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      body: { type: "string", minLength: 1, maxLength: 500_000 },
      sequence: { type: "integer", minimum: 0, maximum: 9999 },
      chapterId: optionalUuid,
      publicationStatus
    }
  }
};

export const updateSectionSchema = {
  params: sectionIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "body"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      body: { type: "string", minLength: 1, maxLength: 500_000 },
      chapterId: optionalUuid,
      publicationStatus
    }
  }
};

export const deleteSectionSchema = { params: sectionIdParams };

export const createRoomSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "inviteCode"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 80 },
      inviteCode: { type: "string", minLength: 1, maxLength: 80 },
      publicListing: { type: "boolean" }
    }
  }
};

export const updateRoomListingSchema = {
  params: {
    type: "object",
    additionalProperties: false,
    required: ["worldId", "roomId"],
    properties: {
      worldId: uuid,
      roomId: uuid
    }
  },
  body: {
    type: "object",
    additionalProperties: false,
    required: ["publicListing"],
    properties: {
      publicListing: { type: "boolean" }
    }
  }
};

const ruleJsonObject = { type: "object", additionalProperties: true };
const ruleActionType = {
  type: "string",
  enum: ["unlock_script_section", "unlock_scene", "grant_clue", "grant_item", "timeline_log"]
};
const ruleActionItem = {
  type: "object",
  additionalProperties: true,
  required: ["type"],
  properties: {
    type: ruleActionType,
    roleSlotId: optionalUuid,
    scriptSectionId: uuid,
    sceneId: uuid,
    clueId: uuid,
    itemId: uuid,
    investigationPointId: uuid,
    quantity: { type: "integer", minimum: 1, maximum: 99 },
    message: { type: "string", maxLength: 2000 },
    source: { type: "string", maxLength: 80 },
    key: { type: "string", maxLength: 120 },
    operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte"] },
    value: {},
    metadata: metadataObject
  }
};
const ruleActionsArray = {
  type: "array",
  minItems: 1,
  maxItems: 50,
  items: ruleActionItem
};

export const createRuleSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "conditions", "actions"],
    properties: {
      roomId: optionalUuid,
      name: { type: "string", minLength: 1, maxLength: 120 },
      mode: ruleMode,
      priority: { type: "integer", minimum: 0, maximum: 9999 },
      enabled: { type: "boolean" },
      conditions: ruleJsonObject,
      actions: ruleActionsArray,
      metadata: metadataObject
    }
  }
};

export const updateRuleSchema = {
  params: ruleIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "conditions", "actions"],
    properties: {
      roomId: optionalUuid,
      name: { type: "string", minLength: 1, maxLength: 120 },
      mode: ruleMode,
      priority: { type: "integer", minimum: 0, maximum: 9999 },
      enabled: { type: "boolean" },
      conditions: ruleJsonObject,
      actions: ruleActionsArray,
      metadata: metadataObject
    }
  }
};

export const deleteRuleSchema = { params: ruleIdParams };

export const validateRuleBodySchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["conditions", "actions"],
    properties: {
      conditions: ruleJsonObject,
      actions: ruleActionsArray,
      metadata: metadataObject
    }
  }
};

export const validateRulesSchema = { params: worldIdParams };

export const contentPackageEnvelopeSchema = {
  body: {
    type: "object",
    additionalProperties: true,
    required: ["format", "version", "data"],
    properties: {
      format: { type: "string", minLength: 1, maxLength: 80 },
      version: { type: "integer", minimum: 1, maximum: 99 },
      data: { type: "object", additionalProperties: true }
    }
  }
};

export const createWorldFromPackageSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      summary: { type: "string", maxLength: 4000 },
      data: { type: "object", additionalProperties: true },
      format: { type: "string", maxLength: 80 },
      version: { type: "integer", minimum: 1, maximum: 99 }
    }
  }
};
