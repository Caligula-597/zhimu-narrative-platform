import {
  CREATION_TYPES,
  LEGACY_WORLD_MODES,
  NARRATIVE_PROFILE_VERSION,
  ROLE_MODES,
  RULESET_MODES,
  RUN_FORMATS
} from "../../../../shared/narrative-profile.js";
import {
  CREATIVE_CONSTITUTION_VERSION,
  SUPERNATURAL_POLICIES
} from "../../../../shared/creative-constitution.js";

const constitutionTextListSchema = {
  type: "array",
  maxItems: 20,
  items: { type: "string", minLength: 1, maxLength: 600 }
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
    "fairness"
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
          promise: { type: "string", maxLength: 1200 }
        }
      }
    },
    fairness: {
      type: "object",
      additionalProperties: false,
      required: ["minimumEvidence", "requireIndependentPaths"],
      properties: {
        minimumEvidence: { type: "integer", minimum: 1, maximum: 5 },
        requireIndependentPaths: { type: "boolean" }
      }
    }
  }
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
    selfReviewStatus: { type: "string", enum: ["not_started", "in_review", "passed", "needs_changes"] },
    selfReviewNotes: { type: "string", maxLength: 4000 },
    materialChangeDate: { type: "string", pattern: "^(?:|\\d{4}-\\d{2}-\\d{2})$" },
    filingUpdatedDate: { type: "string", pattern: "^(?:|\\d{4}-\\d{2}-\\d{2})$" }
  }
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
        diceNotation: { type: "string", maxLength: 80 }
      }
    }
  }
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
    creativeConstitution: creativeConstitutionSchema
  }
};
