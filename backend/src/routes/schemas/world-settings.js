import {
  CREATION_TYPES,
  LEGACY_WORLD_MODES,
  NARRATIVE_PROFILE_VERSION,
  ROLE_MODES,
  RULESET_MODES,
  RUN_FORMATS,
} from "../../../../shared/narrative-profile.js";
import {
  CREATIVE_CONSTITUTION_VERSION,
  SUPERNATURAL_POLICIES,
} from "../../../../shared/creative-constitution.js";
import {
  STORY_SPINE_STATUSES,
  STORY_SPINE_VERSION,
} from "../../../../shared/story-spine.js";
import {
  MECHANISM_DESIGN_STATUSES,
  MECHANISM_DESIGN_VERSION,
} from "../../../../shared/mechanism-design.js";
import {
  BOARD_GAME_COMPONENT_TYPES,
  BOARD_GAME_DESIGN_VERSION,
} from "../../../../shared/board-game-design.js";

const constitutionTextListSchema = {
  type: "array",
  maxItems: 20,
  items: { type: "string", minLength: 1, maxLength: 600 },
};

export const creativeConstitutionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "theme",
    "intendedEmotion",
    "experiencePromise",
    "revealEmotion",
    "inviolablePrinciples",
    "fairPuzzlePromises",
    "pacingPrinciples",
    "voicePrinciples",
    "forbiddenTropes",
    "supernaturalPolicy",
    "supernaturalRules",
    "desiredDebates",
    "avoidMisunderstandings",
    "roleHighlights",
    "fairness",
  ],
  properties: {
    version: { type: "integer", const: CREATIVE_CONSTITUTION_VERSION },
    theme: { type: "string", maxLength: 1200 },
    intendedEmotion: { type: "string", maxLength: 1200 },
    experiencePromise: { type: "string", maxLength: 4000 },
    revealEmotion: { type: "string", maxLength: 1200 },
    inviolablePrinciples: constitutionTextListSchema,
    fairPuzzlePromises: constitutionTextListSchema,
    pacingPrinciples: constitutionTextListSchema,
    voicePrinciples: constitutionTextListSchema,
    forbiddenTropes: constitutionTextListSchema,
    supernaturalPolicy: { type: "string", enum: [...SUPERNATURAL_POLICIES] },
    supernaturalRules: { type: "string", maxLength: 2400 },
    desiredDebates: { type: "string", maxLength: 2400 },
    avoidMisunderstandings: { type: "string", maxLength: 2400 },
    roleHighlights: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["roleId", "promise"],
        properties: {
          roleId: { type: "string", minLength: 1, maxLength: 120 },
          promise: { type: "string", maxLength: 1200 },
        },
      },
    },
    fairness: {
      type: "object",
      additionalProperties: false,
      required: ["minimumEvidence", "requireIndependentPaths"],
      properties: {
        minimumEvidence: { type: "integer", minimum: 1, maximum: 5 },
        requireIndependentPaths: { type: "boolean" },
      },
    },
  },
};

const storySpineSourceRefsSchema = {
  type: "array",
  maxItems: 30,
  items: { type: "string", minLength: 1, maxLength: 180 },
};

const storySpineStatusSchema = {
  type: "string",
  enum: [...STORY_SPINE_STATUSES],
};

const storySpineBlockSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "status", "sourceRefs"],
  properties: {
    text: { type: "string", maxLength: 12_000 },
    status: storySpineStatusSchema,
    sourceRefs: storySpineSourceRefsSchema,
  },
};

export const storySpineSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "title",
    "logline",
    "overview",
    "openingState",
    "incitingIncident",
    "centralConflict",
    "playerPremise",
    "mechanismLoop",
    "truthAndReversal",
    "roleFunctions",
    "chapterArc",
    "endingDirections",
    "unresolvedQuestions",
    "assumptions",
    "provenance",
  ],
  properties: {
    version: { type: "integer", const: STORY_SPINE_VERSION },
    title: { type: "string", maxLength: 200 },
    logline: storySpineBlockSchema,
    overview: storySpineBlockSchema,
    openingState: storySpineBlockSchema,
    incitingIncident: storySpineBlockSchema,
    centralConflict: storySpineBlockSchema,
    playerPremise: storySpineBlockSchema,
    mechanismLoop: storySpineBlockSchema,
    truthAndReversal: storySpineBlockSchema,
    roleFunctions: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "roleId",
          "roleName",
          "storyFunction",
          "goal",
          "pressure",
          "status",
          "sourceRefs",
        ],
        properties: {
          roleId: { type: "string", minLength: 1, maxLength: 120 },
          roleName: { type: "string", minLength: 1, maxLength: 120 },
          storyFunction: { type: "string", maxLength: 2400 },
          goal: { type: "string", maxLength: 2400 },
          pressure: { type: "string", maxLength: 2400 },
          status: storySpineStatusSchema,
          sourceRefs: storySpineSourceRefsSchema,
        },
      },
    },
    chapterArc: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "chapterId",
          "sequence",
          "title",
          "cause",
          "playerAction",
          "turn",
          "consequence",
          "status",
          "sourceRefs",
        ],
        properties: {
          chapterId: { type: "string", minLength: 1, maxLength: 120 },
          sequence: { type: "integer", minimum: 1, maximum: 99 },
          title: { type: "string", minLength: 1, maxLength: 200 },
          cause: { type: "string", maxLength: 3000 },
          playerAction: { type: "string", maxLength: 3000 },
          turn: { type: "string", maxLength: 3000 },
          consequence: { type: "string", maxLength: 3000 },
          status: storySpineStatusSchema,
          sourceRefs: storySpineSourceRefsSchema,
        },
      },
    },
    endingDirections: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "key",
          "title",
          "requirements",
          "consequence",
          "status",
          "sourceRefs",
        ],
        properties: {
          key: { type: "string", minLength: 1, maxLength: 100 },
          title: { type: "string", minLength: 1, maxLength: 200 },
          requirements: { type: "string", maxLength: 3000 },
          consequence: { type: "string", maxLength: 3000 },
          status: storySpineStatusSchema,
          sourceRefs: storySpineSourceRefsSchema,
        },
      },
    },
    unresolvedQuestions: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "question", "whyItMatters", "sourceRefs"],
        properties: {
          key: { type: "string", minLength: 1, maxLength: 100 },
          question: { type: "string", minLength: 1, maxLength: 3000 },
          whyItMatters: { type: "string", maxLength: 3000 },
          sourceRefs: storySpineSourceRefsSchema,
        },
      },
    },
    assumptions: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "text", "impact", "sourceRefs"],
        properties: {
          key: { type: "string", minLength: 1, maxLength: 100 },
          text: { type: "string", minLength: 1, maxLength: 3000 },
          impact: { type: "string", maxLength: 3000 },
          sourceRefs: storySpineSourceRefsSchema,
        },
      },
    },
    provenance: {
      type: "object",
      additionalProperties: false,
      required: ["promptVersion", "model", "generatedAt", "sourceRevision"],
      properties: {
        promptVersion: { type: "string", maxLength: 80 },
        model: { type: "string", maxLength: 160 },
        generatedAt: { type: "string", maxLength: 80 },
        sourceRevision: {
          anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
        },
      },
    },
  },
};

export const commercialProfileSchema = {
  type: "object",
  additionalProperties: false,
  maxProperties: 12,
  properties: {
    authorName: { type: "string", maxLength: 300 },
    copyrightSource: { type: "string", maxLength: 2000 },
    registrationNumber: { type: "string", maxLength: 300 },
    theme: { type: "string", maxLength: 300 },
    category: { type: "string", maxLength: 300 },
    versionLabel: { type: "string", maxLength: 200 },
    ageRating: { type: "string", enum: ["", "12+", "16+", "18+"] },
    selfReviewStatus: {
      type: "string",
      enum: ["not_started", "in_review", "passed", "needs_changes"],
    },
    selfReviewNotes: { type: "string", maxLength: 4000 },
    materialChangeDate: {
      type: "string",
      pattern: "^(?:|\\d{4}-\\d{2}-\\d{2})$",
    },
    filingUpdatedDate: {
      type: "string",
      pattern: "^(?:|\\d{4}-\\d{2}-\\d{2})$",
    },
  },
};

export const narrativeProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "creationType", "runFormat", "roleMode", "ruleset"],
  properties: {
    version: { type: "integer", const: NARRATIVE_PROFILE_VERSION },
    creationType: { type: "string", enum: [...CREATION_TYPES] },
    runFormat: { type: "string", enum: [...RUN_FORMATS] },
    roleMode: { type: "string", enum: [...ROLE_MODES] },
    ruleset: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "key", "diceNotation"],
      properties: {
        mode: { type: "string", enum: [...RULESET_MODES] },
        key: { type: "string", maxLength: 80 },
        diceNotation: { type: "string", maxLength: 80 },
      },
    },
  },
};

export const mechanismDesignSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "interactionKind",
    "allocationTotal",
    "allocationUnitLabel",
    "title",
    "summary",
    "recurringAction",
    "conflictReason",
    "limitedResource",
    "immediateFeedback",
    "failureAdvance",
    "genreSpecificity",
    "endingCausality",
    "authorNotes",
    "status",
    "updatedAt",
  ],
  properties: {
    version: { type: "integer", const: MECHANISM_DESIGN_VERSION },
    interactionKind: {
      type: "string",
      enum: [
        "group_choice",
        "resource_tradeoff",
        "evidence_selection",
        "sequence_reconstruction",
        "timed_crisis",
        "role_commitment",
        "secret_ballot",
        "free_ranking",
        "numeric_allocation",
      ],
    },
    allocationTotal: { type: "integer", minimum: 1, maximum: 10000 },
    allocationUnitLabel: { type: "string", minLength: 1, maxLength: 40 },
    title: { type: "string", maxLength: 160 },
    summary: { type: "string", maxLength: 1200 },
    recurringAction: { type: "string", maxLength: 2400 },
    conflictReason: { type: "string", maxLength: 2400 },
    limitedResource: { type: "string", maxLength: 2400 },
    immediateFeedback: { type: "string", maxLength: 2400 },
    failureAdvance: { type: "string", maxLength: 2400 },
    genreSpecificity: { type: "string", maxLength: 2400 },
    endingCausality: { type: "string", maxLength: 2400 },
    authorNotes: { type: "string", maxLength: 4000 },
    status: { type: "string", enum: [...MECHANISM_DESIGN_STATUSES] },
    updatedAt: { type: "string", maxLength: 80 },
  },
};

const communicationTemplateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "key", "kind", "enabled", "title", "privacyNotice", "placeholder", "deadlineMinutes"],
  properties: {
    version: { type: "integer", const: 1 },
    key: { type: "string", enum: ["testimony", "public_statement", "secret_action", "ask_host"] },
    kind: { type: "string", enum: ["testimony", "public_statement", "secret_action", "ask_host"] },
    enabled: { type: "boolean" },
    title: { type: "string", minLength: 1, maxLength: 120 },
    privacyNotice: { type: "string", minLength: 1, maxLength: 500 },
    placeholder: { type: "string", minLength: 1, maxLength: 300 },
    deadlineMinutes: { type: "integer", minimum: 0, maximum: 1440 },
  },
};

const miniGameTemplateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "protocolVersion", "pluginKey", "gameType", "title", "prompt", "hint",
    "answer", "length", "maxAttempts", "timeoutSeconds", "allowRecovery",
    "successText", "failureText", "recapLabel"
  ],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    protocolVersion: { type: "integer", const: 1 },
    pluginKey: { type: "string", enum: ["zhimu_lock"] },
    gameType: { type: "string", enum: ["zhimu_lock"] },
    title: { type: "string", minLength: 1, maxLength: 120 },
    prompt: { type: "string", minLength: 1, maxLength: 500 },
    hint: { type: "string", maxLength: 500 },
    answer: { type: "string", minLength: 1, maxLength: 32 },
    length: { type: "integer", minimum: 1, maximum: 12 },
    maxAttempts: { type: "integer", minimum: 1, maximum: 12 },
    timeoutSeconds: { type: "integer", minimum: 0, maximum: 86400 },
    allowRecovery: { type: "boolean" },
    successText: { type: "string", minLength: 1, maxLength: 1000 },
    failureText: { type: "string", minLength: 1, maxLength: 1000 },
    recapLabel: { type: "string", minLength: 1, maxLength: 160 },
    status: { type: "string", enum: ["test"] }
  }
};

const boardGameStateFieldSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "key", "initialValue"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    label: { type: "string", minLength: 1, maxLength: 80 },
    key: { type: "string", minLength: 1, maxLength: 80 },
    initialValue: { type: "string", maxLength: 300 },
  },
};

const boardGameAssetSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "assetId", "fileName", "kind", "caption"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    assetId: { type: "string", maxLength: 120 },
    fileName: { type: "string", minLength: 1, maxLength: 240 },
    kind: { type: "string", enum: ["image", "document"] },
    caption: { type: "string", maxLength: 1200 },
  },
};

const boardGameEntrySchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "description", "quantity"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    name: { type: "string", minLength: 1, maxLength: 160 },
    description: { type: "string", maxLength: 1600 },
    quantity: { type: "integer", minimum: 1, maximum: 9999 },
  },
};

const boardGameComponentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "name", "quantity", "description", "playerAction", "stateFields", "assets", "entries", "notes"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    type: { type: "string", enum: [...BOARD_GAME_COMPONENT_TYPES] },
    name: { type: "string", minLength: 1, maxLength: 120 },
    quantity: { type: "integer", minimum: 1, maximum: 9999 },
    description: { type: "string", maxLength: 1600 },
    playerAction: { type: "string", maxLength: 1600 },
    stateFields: { type: "array", maxItems: 40, items: boardGameStateFieldSchema },
    assets: { type: "array", maxItems: 100, items: boardGameAssetSchema },
    entries: { type: "array", maxItems: 2000, items: boardGameEntrySchema },
    notes: { type: "string", maxLength: 2400 },
  },
};

const boardGameVariableSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "scope", "initialValue", "min", "max"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    label: { type: "string", minLength: 1, maxLength: 100 },
    scope: { type: "string", enum: ["global", "player", "component"] },
    initialValue: { type: "number", minimum: -1000000000, maximum: 1000000000 },
    min: { type: "number", minimum: -1000000000, maximum: 1000000000 },
    max: { type: "number", minimum: -1000000000, maximum: 1000000000 },
  },
};

const boardGameConditionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "sourceKey", "operator", "value"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    sourceKey: { type: "string", maxLength: 80 },
    operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "contains"] },
    value: { type: "string", maxLength: 300 },
  },
};

const boardGameEffectSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "targetKey", "operation", "value"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    targetKey: { type: "string", maxLength: 80 },
    operation: { type: "string", enum: ["set", "add", "subtract", "multiply", "min", "max", "toggle"] },
    value: { type: "string", maxLength: 300 },
  },
};

const boardGameMechanismSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "templateKey", "name", "sourceComponentId", "trigger", "conditionMode", "conditions", "effects", "notes"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    templateKey: { type: "string", minLength: 1, maxLength: 80 },
    name: { type: "string", minLength: 1, maxLength: 160 },
    sourceComponentId: { type: "string", maxLength: 80 },
    trigger: { type: "string", minLength: 1, maxLength: 160 },
    conditionMode: { type: "string", enum: ["all", "any"] },
    conditions: { type: "array", maxItems: 40, items: boardGameConditionSchema },
    effects: { type: "array", maxItems: 40, items: boardGameEffectSchema },
    notes: { type: "string", maxLength: 2400 },
  },
};

const boardGameRulebookSchema = {
  type: "object",
  additionalProperties: false,
  required: ["objective", "setup", "turnStructure", "playerActions", "endCondition", "tieBreak", "notes"],
  properties: {
    objective: { type: "string", maxLength: 4000 },
    setup: { type: "string", maxLength: 8000 },
    turnStructure: { type: "string", maxLength: 8000 },
    playerActions: { type: "string", maxLength: 8000 },
    endCondition: { type: "string", maxLength: 4000 },
    tieBreak: { type: "string", maxLength: 2400 },
    notes: { type: "string", maxLength: 8000 },
  },
};

export const boardGameDesignSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "title", "designGoal", "playerCount", "playTimeMinutes", "components", "variables", "mechanisms", "rulebook", "updatedAt"],
  properties: {
    version: { type: "integer", const: BOARD_GAME_DESIGN_VERSION },
    title: { type: "string", maxLength: 120 },
    designGoal: { type: "string", maxLength: 2400 },
    playerCount: {
      type: "object",
      additionalProperties: false,
      required: ["min", "max"],
      properties: {
        min: { type: "integer", minimum: 1, maximum: 99 },
        max: { type: "integer", minimum: 1, maximum: 99 },
      },
    },
    playTimeMinutes: { type: "integer", minimum: 1, maximum: 10080 },
    components: { type: "array", maxItems: 300, items: boardGameComponentSchema },
    variables: { type: "array", maxItems: 300, items: boardGameVariableSchema },
    mechanisms: { type: "array", maxItems: 300, items: boardGameMechanismSchema },
    rulebook: boardGameRulebookSchema,
    updatedAt: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
  },
};

export const worldSettingsSchema = {
  type: "object",
  additionalProperties: true,
  maxProperties: 100,
  properties: {
    recapTruthSummary: { type: "string", maxLength: 20000 },
    creationType: { type: "string", enum: [...CREATION_TYPES] },
    worldMode: { type: "string", enum: [...LEGACY_WORLD_MODES] },
    narrativeProfile: narrativeProfileSchema,
    commercialProfile: commercialProfileSchema,
    creativeConstitution: creativeConstitutionSchema,
    storySpine: storySpineSchema,
    mechanismDesign: mechanismDesignSchema,
    boardGameDesign: boardGameDesignSchema,
    communicationTemplates: { type: "array", maxItems: 4, items: communicationTemplateSchema },
    miniGameTemplates: { type: "array", maxItems: 50, items: miniGameTemplateSchema },
  },
};
