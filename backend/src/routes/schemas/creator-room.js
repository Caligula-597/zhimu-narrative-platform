import { uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";
import { worldReleaseSummarySchema } from "./world-release.js";

export const createRoomSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 80, pattern: "\\S" },
      inviteCode: { type: "string", minLength: 1, maxLength: 80, deprecated: true },
      publicListing: { type: "boolean" },
      releaseId: { anyOf: [uuid, { type: "null" }] }
    }
  }
};

export const roomContentBindingSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "mode",
    "runtimeSource",
    "isFrozen",
    "compatibilityStatus",
    "release",
    "currentDraftRevision",
    "hasNewerDraft"
  ],
  properties: {
    mode: { type: "string", enum: ["live_draft", "release"] },
    runtimeSource: { type: "string", enum: ["live_draft", "release_snapshot"] },
    isFrozen: { type: "boolean" },
    compatibilityStatus: {
      type: "string",
      enum: ["legacy_live_draft", "awaiting_release_reader", "frozen_release"]
    },
    release: {
      anyOf: [{
        type: "object",
        additionalProperties: false,
        required: ["id", "releaseNumber", "label", "sourceRevision", "createdAt"],
        properties: {
          id: uuid,
          releaseNumber: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
          label: { type: "string", maxLength: 120 },
          sourceRevision: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
          createdAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] }
        }
      }, { type: "null" }]
    },
    currentDraftRevision: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
    hasNewerDraft: { type: "boolean" }
  }
};

export const listCreatorRoomsSchema = {
  params: worldIdParams
};

export const roomContentPolicySchema = {
  params: worldIdParams,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: [
        "defaultMode",
        "defaultReleaseEnabled",
        "publicListingRequiresRelease",
        "allowExplicitLiveDraft"
      ],
      properties: {
        defaultMode: { type: "string", enum: ["live_draft", "latest_release"] },
        defaultReleaseEnabled: { type: "boolean" },
        publicListingRequiresRelease: { type: "boolean" },
        allowExplicitLiveDraft: { type: "boolean" }
      }
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

const roomReleaseParams = {
  type: "object",
  additionalProperties: false,
  required: ["worldId", "roomId"],
  properties: {
    worldId: uuid,
    roomId: uuid
  }
};

const sha256 = { type: "string", pattern: "^[0-9a-f]{64}$" };

const releaseDiffItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 200 },
    label: { type: "string", maxLength: 500 },
    fields: {
      type: "array",
      maxItems: 40,
      items: { type: "string", maxLength: 100 }
    }
  }
};

const releaseDomainDiffSchema = {
  type: "object",
  additionalProperties: false,
  required: ["counts", "added", "removed", "changed", "truncated"],
  properties: {
    counts: {
      type: "object",
      additionalProperties: false,
      required: ["added", "removed", "changed"],
      properties: {
        added: { type: "integer", minimum: 0 },
        removed: { type: "integer", minimum: 0 },
        changed: { type: "integer", minimum: 0 }
      }
    },
    added: { type: "array", maxItems: 100, items: releaseDiffItemSchema },
    removed: { type: "array", maxItems: 100, items: releaseDiffItemSchema },
    changed: { type: "array", maxItems: 100, items: releaseDiffItemSchema },
    truncated: { type: "boolean" }
  }
};

const releaseImpactIssueSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "message"],
  properties: {
    code: { type: "string", minLength: 1, maxLength: 100 },
    message: { type: "string", minLength: 1, maxLength: 500 },
    objectIds: {
      type: "array",
      maxItems: 200,
      items: { type: "string", minLength: 1, maxLength: 200 }
    }
  }
};

export const roomReleaseImpactResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "roomId",
    "currentBinding",
    "source",
    "targetRelease",
    "direction",
    "allowed",
    "fingerprint",
    "comparison",
    "runtimeImpact",
    "generatedAt"
  ],
  properties: {
    roomId: uuid,
    currentBinding: roomContentBindingSchema,
    source: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "release", "sourceRevision"],
      properties: {
        mode: { type: "string", enum: ["live_draft", "release"] },
        release: { anyOf: [worldReleaseSummarySchema, { type: "null" }] },
        sourceRevision: { type: "integer", minimum: 1 }
      }
    },
    targetRelease: worldReleaseSummarySchema,
    direction: { type: "string", enum: ["bind", "upgrade", "downgrade", "same"] },
    allowed: { type: "boolean" },
    fingerprint: sha256,
    comparison: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "world", "coreTrick", "domains"],
      properties: {
        summary: {
          type: "object",
          additionalProperties: false,
          required: ["added", "removed", "changed"],
          properties: {
            added: { type: "integer", minimum: 0 },
            removed: { type: "integer", minimum: 0 },
            changed: { type: "integer", minimum: 0 }
          }
        },
        world: {
          type: "object",
          additionalProperties: false,
          required: ["changed", "fields"],
          properties: {
            changed: { type: "boolean" },
            fields: { type: "array", maxItems: 40, items: { type: "string" } }
          }
        },
        coreTrick: {
          type: "object",
          additionalProperties: false,
          required: ["changed", "fields"],
          properties: {
            changed: { type: "boolean" },
            fields: { type: "array", maxItems: 40, items: { type: "string" } }
          }
        },
        domains: {
          type: "object",
          additionalProperties: releaseDomainDiffSchema
        }
      }
    },
    runtimeImpact: {
      type: "object",
      additionalProperties: false,
      required: [
        "hasStarted",
        "runtimeActivityCount",
        "assignedRoleIds",
        "missingAssignedRoleIds",
        "evidence",
        "blockers",
        "warnings"
      ],
      properties: {
        hasStarted: { type: "boolean" },
        runtimeActivityCount: { type: "integer", minimum: 0 },
        assignedRoleIds: { type: "array", maxItems: 500, items: uuid },
        missingAssignedRoleIds: { type: "array", maxItems: 500, items: uuid },
        evidence: {
          type: "object",
          additionalProperties: { type: "integer", minimum: 0 }
        },
        blockers: { type: "array", maxItems: 100, items: releaseImpactIssueSchema },
        warnings: { type: "array", maxItems: 100, items: releaseImpactIssueSchema }
      }
    },
    generatedAt: { type: "string", format: "date-time" }
  }
};

export const previewRoomReleaseImpactSchema = {
  params: roomReleaseParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["releaseId"],
    properties: { releaseId: uuid }
  },
  response: { 200: roomReleaseImpactResponseSchema }
};

export const applyRoomReleaseSchema = {
  params: roomReleaseParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: [
      "releaseId",
      "expectedCurrentReleaseId",
      "targetContentSha256",
      "impactFingerprint"
    ],
    properties: {
      releaseId: uuid,
      expectedCurrentReleaseId: { anyOf: [uuid, { type: "null" }] },
      targetContentSha256: sha256,
      impactFingerprint: sha256
    }
  }
};
