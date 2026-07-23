import { uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

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
