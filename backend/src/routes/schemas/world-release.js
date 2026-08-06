import { narrativeProfileSchema } from "./world-settings.js";
import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });

const readinessSummarySchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    errorCount: { type: "integer", minimum: 0 },
    warningCount: { type: "integer", minimum: 0 },
    successCount: { type: "integer", minimum: 0 },
    readyForPlaytest: { type: "boolean" },
    readyForCatalog: { type: "boolean" },
    counts: { type: "object", additionalProperties: { type: "integer", minimum: 0 } }
  }
};

const contentSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["counts", "hasCoreTrick", "hasMechanismPackage", "totalObjects"],
  properties: {
    counts: { type: "object", additionalProperties: { type: "integer", minimum: 0 } },
    hasCoreTrick: { type: "boolean" },
    hasMechanismPackage: { type: "boolean" },
    totalObjects: { type: "integer", minimum: 0 }
  }
};

export const worldReleaseSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "worldId",
    "releaseNumber",
    "label",
    "sourceRevision",
    "snapshotSchemaVersion",
    "narrativeProfile",
    "readinessSummary",
    "contentSummary",
    "contentSha256",
    "snapshotBytes",
    "createdAt"
  ],
  properties: {
    id: uuid,
    worldId: uuid,
    releaseNumber: { type: "integer", minimum: 1 },
    label: { type: "string", minLength: 1, maxLength: 120 },
    sourceRevision: { type: "integer", minimum: 1 },
    snapshotSchemaVersion: { type: "integer", minimum: 1 },
    narrativeProfile: narrativeProfileSchema,
    readinessSummary: readinessSummarySchema,
    contentSummary: contentSummarySchema,
    contentSha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
    snapshotBytes: { type: "integer", minimum: 1 },
    createdByUserId: { anyOf: [uuid, { type: "null" }] },
    createdByName: { anyOf: [{ type: "string", maxLength: 120 }, { type: "null" }] },
    createdAt: { type: "string", format: "date-time" },
    replayed: { type: "boolean" },
    content_revision: { type: "integer", minimum: 1 }
  }
};

export const createWorldReleaseSchema = {
  params: worldIdParams,
  headers: {
    type: "object",
    required: ["idempotency-key", "if-match"],
    properties: {
      "idempotency-key": { type: "string", minLength: 1, maxLength: 128 },
      "if-match": { type: "string", pattern: "^(?:W/)?\"?[1-9][0-9]*\"?$" }
    }
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      label: { type: "string", minLength: 1, maxLength: 120, pattern: "\\S" }
    }
  },
  response: {
    201: worldReleaseSummarySchema
  }
};

export const listWorldReleasesSchema = {
  params: worldIdParams,
  response: {
    200: {
      type: "array",
      maxItems: 200,
      items: worldReleaseSummarySchema
    }
  }
};
