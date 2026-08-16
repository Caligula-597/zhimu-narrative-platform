import { nonEmptyText, paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const deepseekBriefBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: 120 },
    premise: { type: "string", maxLength: 12_000 },
    conflicts: { type: "string", maxLength: 3000 },
    wordsPerChapter: { type: "integer", minimum: 2000, maximum: 12_000 },
    style: { type: "string", maxLength: 800 },
    audience: { type: "string", maxLength: 400 },
    requirements: { type: "string", maxLength: 3000 },
    roleRequirements: { type: "string", maxLength: 3000 },
    evaluationFocus: { type: "string", maxLength: 3000 },
    existingManuscript: { type: "string", maxLength: 12_000 },
    playerCount: { type: "integer", minimum: 4, maximum: 8 },
    targetWordCount: { type: "integer", minimum: 500, maximum: 20_000 },
    chapterCount: { type: "integer", minimum: 1, maximum: 12 },
    sceneCount: { type: "integer", minimum: 1, maximum: 40 },
    investigationPointCount: { type: "integer", minimum: 1, maximum: 80 },
    clueCount: { type: "integer", minimum: 1, maximum: 80 },
    skipOutline: { type: "boolean" }
  }
};

const deepseekJsonObject = { type: "object", additionalProperties: true };
const optionalNullableJsonObject = { anyOf: [deepseekJsonObject, { type: "null" }] };
const optionalNullableJsonArray = { anyOf: [{ type: "array", maxItems: 24, items: deepseekJsonObject }, { type: "null" }] };

const creativeSettingBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    theme: { type: "string", maxLength: 120 },
    playerCount: { type: "integer", minimum: 4, maximum: 8 },
    chapterCount: { type: "integer", minimum: 3, maximum: 5 },
    wordsPerChapter: { type: "integer", minimum: 2000, maximum: 12_000 },
    extraConflicts: { type: "string", maxLength: 3000 },
    tone: { type: "string", maxLength: 800 },
    volumeTier: { type: "string", enum: ["demo", "standard", "epic"] },
    pov: { type: "string", enum: ["second", "first"] },
    literaryStyle: { type: "string", maxLength: 80 },
    mysteryStyle: { type: "string", maxLength: 80 },
    killerAwareness: { type: "string", enum: ["self-aware", "self-unaware"] },
    matrixMode: { type: "string", enum: ["honkaku", "henkaku"] },
    playStructure: { type: "string", enum: ["mystery", "faction", "mechanism", "hybrid"] },
    eraPreset: { type: "string", maxLength: 80 },
    eraNotes: { type: "string", maxLength: 800 },
    styleAnchor: { type: "string", maxLength: 2000 },
    forbiddenPhrases: { type: "string", maxLength: 1000 }
  }
};

const creativeSynopsisBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    body: { type: "string", maxLength: 12_000 },
    charactersSketch: { type: "string", maxLength: 4000 },
    truthSketch: { type: "string", maxLength: 4000 },
    redHerringsSketch: { type: "string", maxLength: 2000 }
  }
};

const creativePipelineFields = {
  setting: creativeSettingBody,
  synopsis: creativeSynopsisBody,
  config: deepseekJsonObject
};

export const deepseekPipelineSpecSchema = {
  params: worldIdParams,
  body: deepseekBriefBody
};

export const deepseekPipelineOutlineSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...deepseekBriefBody.properties,
      spec: deepseekJsonObject
    }
  }
};

export const deepseekPipelineStructureSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...deepseekBriefBody.properties,
      spec: deepseekJsonObject,
      outline: deepseekJsonObject
    }
  }
};

export const deepseekPipelineRoleMatrixSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["spec", "proposal"],
    properties: {
      ...deepseekBriefBody.properties,
      spec: deepseekJsonObject,
      outline: deepseekJsonObject,
      proposal: deepseekJsonObject
    }
  }
};

export const deepseekPipelineSectionSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["spec", "proposal", "roleMatrix", "roleKey", "chapterKey"],
    properties: {
      ...deepseekBriefBody.properties,
      spec: deepseekJsonObject,
      outline: deepseekJsonObject,
      proposal: deepseekJsonObject,
      roleMatrix: deepseekJsonObject,
      roleKey: { type: "string", minLength: 1, maxLength: 40 },
      chapterKey: { type: "string", minLength: 1, maxLength: 40 }
    }
  }
};

export const deepseekPipelineManuscriptSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["spec", "proposal"],
    properties: {
      ...deepseekBriefBody.properties,
      spec: deepseekJsonObject,
      outline: deepseekJsonObject,
      proposal: deepseekJsonObject,
      roleMatrix: deepseekJsonObject
    }
  }
};

export const deepseekPipelineImportSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["pipeline"],
    properties: {
      pipeline: {
        type: "object",
        additionalProperties: true,
        required: ["proposal"],
        properties: {
          proposal: deepseekJsonObject,
          roleMatrix: deepseekJsonObject,
          sections: deepseekJsonObject,
          synopsis: deepseekJsonObject,
          package: deepseekJsonObject
        }
      }
    }
  }
};

export const deepseekPipelineEvaluateSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...deepseekBriefBody.properties,
      ...creativePipelineFields,
      evaluationFocus: { type: "string", maxLength: 3000 },
      spec: optionalNullableJsonObject,
      outline: optionalNullableJsonObject,
      proposal: optionalNullableJsonObject,
      roleMatrix: optionalNullableJsonObject,
      rolesMeta: optionalNullableJsonObject,
      sections: optionalNullableJsonObject,
      sampleSection: optionalNullableJsonObject,
      narrativeChapters: { type: "array", maxItems: 12, items: deepseekJsonObject },
      truthBible: optionalNullableJsonObject,
      characterArchives: optionalNullableJsonObject,
      infoMatrix: optionalNullableJsonObject,
      scripts: optionalNullableJsonObject,
      hostRunbooks: optionalNullableJsonObject
    }
  }
};

const matrixPipelineBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...creativePipelineFields,
    truthBible: optionalNullableJsonObject,
    characterArchives: optionalNullableJsonObject,
    clueNetwork: optionalNullableJsonObject,
    infoMatrix: optionalNullableJsonObject,
    actOutlines: optionalNullableJsonObject,
    scripts: optionalNullableJsonObject,
    hostRunbooks: optionalNullableJsonArray,
    evaluation: optionalNullableJsonObject,
    generationProvenance: optionalNullableJsonObject,
    artifactDependencyManifest: optionalNullableJsonObject,
    actKey: { type: "string", maxLength: 40 },
    roleKey: { type: "string", maxLength: 40 },
    deAiPass: { type: "boolean" },
    allActs: { type: "boolean" },
    scriptGenerationMode: { type: "string", enum: ["structured", "narrative"] }
  }
};

export const deepseekPipelineMatrixTruthSchema = {
  params: worldIdParams,
  body: matrixPipelineBody
};

export const deepseekPipelineMatrixCharactersSchema = {
  params: worldIdParams,
  body: { ...matrixPipelineBody, required: ["truthBible"] }
};

export const deepseekPipelineMatrixCluesSchema = {
  params: worldIdParams,
  body: { ...matrixPipelineBody, required: ["truthBible", "characterArchives"] }
};

export const deepseekPipelineMatrixInfoSchema = {
  params: worldIdParams,
  body: { ...matrixPipelineBody, required: ["truthBible", "characterArchives", "clueNetwork"] }
};

export const deepseekPipelineMatrixHostSchema = {
  params: worldIdParams,
  body: { ...matrixPipelineBody, required: ["truthBible", "characterArchives", "clueNetwork", "infoMatrix"] }
};

export const deepseekPipelineMatrixPlayerScriptSchema = {
  params: worldIdParams,
  body: {
    ...matrixPipelineBody,
    required: ["truthBible", "characterArchives", "clueNetwork", "infoMatrix", "roleKey", "actKey"]
  }
};

export const deepseekPipelineMatrixEvaluateSchema = {
  params: worldIdParams,
  body: {
    ...matrixPipelineBody,
    required: ["truthBible", "characterArchives", "clueNetwork", "infoMatrix"]
  }
};

export const deepseekPipelineMatrixSyncPreviewSchema = {
  params: worldIdParams,
  body: {
    ...matrixPipelineBody,
    required: ["truthBible", "characterArchives", "clueNetwork", "infoMatrix"]
  }
};

/** 叙事优先流水线：逐章总剧情（承前启后） */
export const deepseekPipelineNarrativeChapterSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["chapterKey"],
    properties: {
      ...deepseekBriefBody.properties,
      ...creativePipelineFields,
      spec: deepseekJsonObject,
      chapterKey: { type: "string", minLength: 1, maxLength: 40 },
      previousChapters: {
        type: "array",
        maxItems: 12,
        items: deepseekJsonObject
      }
    }
  }
};

/** 从总剧情归纳角色元数据 */
export const deepseekPipelineNarrativeRolesMetaSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["chapters"],
    properties: {
      ...deepseekBriefBody.properties,
      ...creativePipelineFields,
      spec: deepseekJsonObject,
      chapters: { type: "array", minItems: 1, maxItems: 12, items: deepseekJsonObject }
    }
  }
};

/** 单角色私人剧本生成/改稿 */
export const deepseekPipelineNarrativeRoleScriptSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["roleKey", "role", "chapters"],
    properties: {
      ...deepseekBriefBody.properties,
      ...creativePipelineFields,
      spec: deepseekJsonObject,
      roleKey: { type: "string", minLength: 1, maxLength: 40 },
      role: deepseekJsonObject,
      chapters: { type: "array", minItems: 1, maxItems: 12, items: deepseekJsonObject },
      chapterKey: { type: "string", minLength: 1, maxLength: 40 },
      existingSections: { type: "array", maxItems: 12, items: deepseekJsonObject },
      revisionHint: { type: "string", maxLength: 2000 }
    }
  }
};

/** 叙事优先：从总剧情拆私人分幕 */
export const deepseekPipelineNarrativeRolesSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["spec", "roleMatrix", "chapters"],
    properties: {
      ...deepseekBriefBody.properties,
      spec: deepseekJsonObject,
      roleMatrix: deepseekJsonObject,
      proposal: deepseekJsonObject,
      chapters: { type: "array", minItems: 1, maxItems: 12, items: deepseekJsonObject }
    }
  }
};

/** 叙事优先：从总剧情抽取场景/线索/调查点 */
export const deepseekPipelineNarrativeExtractSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["chapters"],
    properties: {
      ...deepseekBriefBody.properties,
      ...creativePipelineFields,
      spec: deepseekJsonObject,
      chapters: { type: "array", minItems: 1, maxItems: 12, items: deepseekJsonObject },
      sectionsSample: { type: "array", maxItems: 6, items: deepseekJsonObject }
    }
  }
};

export const storyAssistantAnalyzeSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string", minLength: 1, maxLength: 500_000 }
    }
  }
};

export const storySpineAssembleSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      creatorInput: {
        type: "object",
        additionalProperties: false,
        properties: {
          logline: { type: "string", maxLength: 4000 },
          sparks: {
            type: "array",
            maxItems: 30,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text"],
              properties: {
                tag: { type: "string", maxLength: 80 },
                text: { type: "string", minLength: 1, maxLength: 800 }
              }
            }
          },
          sellingPoints: {
            type: "array",
            maxItems: 6,
            items: { type: "string", maxLength: 800 }
          },
          target: { type: "string", maxLength: 600 },
          duration: { type: "string", maxLength: 200 },
          type: { type: "string", maxLength: 400 },
          focus: { type: "string", maxLength: 2000 }
        }
      }
    }
  }
};

export const storyAssistantImportSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string", minLength: 1, maxLength: 500_000 }
    }
  }
};

export const deepseekProposeSchema = {
  params: worldIdParams,
  body: deepseekBriefBody
};

export const deepseekImportSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["proposal"],
    properties: {
      proposal: { type: "object", additionalProperties: true }
    }
  }
};

export const deepseekMysteryProposeSchema = {
  params: worldIdParams,
  body: deepseekBriefBody
};

export const deepseekMysteryImportSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["mystery"],
    properties: {
      mystery: {
        type: "object",
        additionalProperties: false,
        required: ["proposal", "package"],
        properties: {
          proposal: { type: "object", additionalProperties: true },
          package: { type: "object", additionalProperties: true }
        }
      }
    }
  }
};

export const aiPlaytestRunSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["profiles"],
    properties: {
      depth: { type: "string", enum: ["quick", "deep"] },
      focus: { type: "string", maxLength: 2000 },
      profiles: {
        type: "array",
        minItems: 2,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["roleSlotId", "archetype"],
          properties: {
            seatId: { type: "string", minLength: 1, maxLength: 80 },
            roleSlotId: uuid,
            archetype: {
              type: "string",
              enum: [
                "logical",
                "emotional",
                "social",
                "silent",
                "skeptic",
                "dominant",
                "secretive",
                "skimmer",
                "brute_force",
                "wanderer"
              ]
            },
            customBehavior: { type: "string", maxLength: 800 }
          }
        }
      }
    }
  }
};

export const worldSearchQuerySchema = {
  params: worldIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["q"],
    properties: {
      q: { type: "string", minLength: 1, maxLength: 120 },
      limit: { type: "integer", minimum: 1, maximum: 50 },
      type: {
        type: "string",
        enum: ["all", "role", "section", "scene", "clue", "investigation_point", "rule", "item", "knowledge"]
      }
    }
  }
};

export const storyManuscriptPutSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: {
      body: { type: "string", minLength: 1, maxLength: 2_000_000 }
    }
  }
};

export const storyManuscriptSyncToGraphSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: {
      body: { type: "string", minLength: 1, maxLength: 2_000_000 }
    }
  }
};

export const storyManuscriptSyncFromGraphSchema = {
  params: worldIdParams,
  response: {
    200: {
      type: "object",
      properties: {
        body: { type: "string" },
        last_sync_direction: { type: "string" },
        updated_at: { type: "string" }
      }
    }
  }
};
