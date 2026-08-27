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
