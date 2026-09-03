import { worldIdParams } from "./world.js";

const creationType = { type: "string", const: "murder_mystery" };

const openingPackageFileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["filename", "contentBase64"],
  properties: {
    filename: { type: "string", minLength: 1, maxLength: 255 },
    contentBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
    roleName: { type: "string", maxLength: 120 }
  }
};

const openingPackageBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["creationType", "rightsConfirmed"],
  properties: {
    creationType,
    rightsConfirmed: { type: "boolean", const: true },
    hostHandbook: openingPackageFileSchema,
    roleScripts: {
      type: "array",
      maxItems: 24,
      items: openingPackageFileSchema
    },
    clueTextDoc: openingPackageFileSchema,
    clueImages: {
      type: "array",
      maxItems: 80,
      items: openingPackageFileSchema
    },
    stageSchemaDecision: {
      type: "string",
      enum: ["confirm", "reject", "manual"]
    },
    stageSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        source: {
          type: "string",
          enum: ["USER_CONFIRMED", "REJECTED_AS_HEADINGS", "MANUAL"]
        },
        label: { type: "string", maxLength: 500 },
        items: {
          type: "array",
          maxItems: 24,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name"],
            properties: {
              order: { type: "integer", minimum: 1, maximum: 99 },
              name: { type: "string", minLength: 1, maxLength: 80 }
            }
          }
        }
      }
    }
  }
};

export const previewOpeningPackageSchema = {
  params: worldIdParams,
  body: {
    ...openingPackageBodySchema,
    required: ["creationType", "rightsConfirmed", "hostHandbook"]
  }
};

export const commitOpeningPackageSchema = {
  params: worldIdParams,
  body: {
    ...openingPackageBodySchema,
    required: ["creationType", "rightsConfirmed", "hostHandbook"]
  }
};
