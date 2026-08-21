import { uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const deepseekJsonObject = { type: "object", additionalProperties: true };

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
    generationContract: deepseekJsonObject,
    spec: deepseekJsonObject
  }
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
      spec: deepseekJsonObject,
      blueprint: deepseekJsonObject,
      blueprintAttempts: { type: "integer", minimum: 1, maximum: 5 },
      assemblyAttempts: { type: "integer", minimum: 1, maximum: 5 }
    }
  }
};

export const boardGameAiDraftSchema = {
  params: worldIdParams,
  body: { type: "object", additionalProperties: false, required: ["currentDesign", "scope", "currentSection"], properties: {
    currentDesign: deepseekJsonObject,
    scope: { type: "string", enum: ["patch", "missing", "current", "full"] },
    currentSection: { type: "string", enum: ["components", "seats", "mechanisms", "engine", "rulebook"] },
    instructions: { type: "string", maxLength: 3000 }, seed: { type: "string", maxLength: 120 }
  } }
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
