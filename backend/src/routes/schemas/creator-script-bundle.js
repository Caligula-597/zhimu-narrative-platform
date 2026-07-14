import { worldIdParams } from "./world.js";

const publicationStatus = { type: "string", enum: ["draft", "testing", "published"] };
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
