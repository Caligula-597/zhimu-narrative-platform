import { paramsSchema, uuid } from "./primitives.js";
import { roomIdParams, roleSlotRoomParams } from "./player.js";

const worldIdParams = paramsSchema({ worldId: uuid });
const metadataObject = { type: "object", additionalProperties: true };
const optionalUuid = { anyOf: [uuid, { type: "null" }] };
const contentVisibility = {
  type: "string",
  enum: ["author", "host", "role", "faction", "public", "postgame"]
};

const segmentPayload = {
  type: "object",
  additionalProperties: false,
  required: ["segmentKey", "title"],
  properties: {
    segmentKey: { type: "string", minLength: 1, maxLength: 120 },
    title: { type: "string", minLength: 1, maxLength: 200 },
    sequence: { type: "integer", minimum: 1, maximum: 999 },
    chapterId: optionalUuid,
    story: metadataObject,
    mechanics: metadataObject,
    operations: metadataObject,
    quality: metadataObject,
    metadata: metadataObject,
    refs: {
      type: "array",
      maxItems: 200,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["refType", "refId"],
        properties: {
          refType: {
            type: "string",
            enum: ["chapter", "script_section", "scene", "clue", "item", "rule", "truth_claim"]
          },
          refId: uuid,
          roleSlotId: optionalUuid,
          metadata: metadataObject
        }
      }
    }
  }
};

export const createSegmentSchema = {
  params: worldIdParams,
  body: segmentPayload
};

export const updateSegmentSchema = {
  params: paramsSchema({ worldId: uuid, segmentId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      segmentKey: { type: "string", minLength: 1, maxLength: 120 },
      title: { type: "string", minLength: 1, maxLength: 200 },
      sequence: { type: "integer", minimum: 1, maximum: 999 },
      chapterId: optionalUuid,
      story: metadataObject,
      mechanics: metadataObject,
      operations: metadataObject,
      quality: metadataObject,
      metadata: metadataObject,
      refs: segmentPayload.properties.refs
    }
  }
};

export const createRoleRelationshipSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["fromRoleSlotId", "toRoleSlotId"],
    properties: {
      fromRoleSlotId: uuid,
      toRoleSlotId: uuid,
      relationType: { type: "string", minLength: 1, maxLength: 80 },
      label: { type: "string", maxLength: 200 },
      strength: { type: "integer", minimum: -10, maximum: 10 },
      visibility: contentVisibility,
      metadata: metadataObject
    }
  }
};

export const roleRelationshipIdParams = paramsSchema({
  worldId: uuid,
  relationshipId: uuid
});

export const createPrivateActionSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["actionType", "title"],
    properties: {
      segmentId: optionalUuid,
      targetRoleSlotId: optionalUuid,
      actionType: {
        type: "string",
        enum: ["ask_host", "secret_action", "trade", "promise", "accusation_note"]
      },
      title: { type: "string", minLength: 1, maxLength: 200 },
      body: { type: "string", maxLength: 4000 },
      payload: metadataObject,
      visibility: {
        type: "string",
        enum: ["actor_host", "actor_target_host", "host_only", "postgame"]
      }
    }
  }
};

export const privateActionListSchema = {
  params: roomIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 200, default: 100 },
      offset: { type: "integer", minimum: 0, maximum: 10000, default: 0 }
    }
  }
};

export const updatePrivateActionSchema = {
  params: paramsSchema({ roomId: uuid, actionId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: {
      status: {
        type: "string",
        enum: ["seen", "accepted", "rejected", "resolved", "cancelled"]
      },
      hostResponse: { type: "string", maxLength: 4000 }
    }
  }
};

export const updateRoleStateSchema = {
  params: roleSlotRoomParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      factionKey: { type: "string", maxLength: 120 },
      publicAlias: { type: "string", maxLength: 120 },
      hiddenIdentity: { type: "string", maxLength: 500 },
      variables: metadataObject
    }
  }
};
