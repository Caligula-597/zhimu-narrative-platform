import { nonEmptyText, paramsSchema, uuid } from "./primitives.js";
import { roomIdParams } from "./player.js";
import { worldIdParams } from "./world.js";

const physicalTokenContentType = {
  type: "string",
  enum: ["clue", "item", "script_section", "event"]
};

const physicalTokenStatusFilter = {
  type: "string",
  enum: ["issued", "activated", "revoked"]
};

const tumpIntegrationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    provider: { type: "string", enum: ["tump"] },
    campaignId: { type: "string", maxLength: 120 },
    sku: { type: "string", maxLength: 120 },
    costAmount: { type: "number" },
    externalId: { type: "string", maxLength: 200 }
  }
};

const physicalTokenActivationRuleSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    oneTime: { type: "boolean" },
    requiredRoleSlotIds: { type: "array", maxItems: 20, items: uuid },
    eventMessage: { type: "string", maxLength: 500 },
    eventVisibility: { type: "string", enum: ["host", "public"] },
    externalGate: {
      type: "object",
      additionalProperties: false,
      properties: {
        provider: { type: "string", enum: ["tump"] },
        required: { type: "boolean" },
        minAmount: { type: "number" },
        sku: { type: "string", maxLength: 120 }
      }
    }
  }
};

const physicalTokenMetadataSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    integration: tumpIntegrationSchema,
    eventMessage: { type: "string", maxLength: 500 }
  }
};

const externalActivationProofSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    provider: { type: "string", enum: ["tump"] },
    transactionId: { type: "string", minLength: 1, maxLength: 200 },
    amount: { type: "number" },
    signature: { type: "string", maxLength: 500 }
  }
};

export const physicalTokenIdParams = paramsSchema({ worldId: uuid, tokenId: uuid });

export const listPhysicalTokensSchema = {
  params: worldIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: physicalTokenStatusFilter,
      contentType: physicalTokenContentType,
      limit: { type: "integer", minimum: 1, maximum: 500 },
      offset: { type: "integer", minimum: 0, maximum: 10000 }
    }
  }
};

export const createPhysicalTokensSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["contentType", "contentId"],
    properties: {
      contentType: physicalTokenContentType,
      contentId: uuid,
      count: { type: "integer", minimum: 1, maximum: 500 },
      label: { type: "string", maxLength: 200 },
      tokenCode: { type: "string", minLength: 12, maxLength: 32 },
      activationRule: physicalTokenActivationRuleSchema,
      metadata: physicalTokenMetadataSchema,
      expiresAt: { type: "string", format: "date-time" }
    }
  }
};

export const revokePhysicalTokenSchema = {
  params: physicalTokenIdParams
};

export const physicalTokenPreviewSchema = {
  params: paramsSchema({
    tokenCode: { type: "string", minLength: 12, maxLength: 32 }
  })
};

export const activatePhysicalTokenSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["tokenCode"],
    properties: {
      tokenCode: { type: "string", minLength: 12, maxLength: 32 },
      externalProof: externalActivationProofSchema
    }
  }
};

const wizardRoleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    goal: { type: "string", maxLength: 500 },
    publicProfile: { type: "string", maxLength: 4000 },
    privateProfile: { type: "string", maxLength: 8000 },
    scriptBody: { type: "string", maxLength: 100_000 },
    sectionTitle: { type: "string", maxLength: 200 },
    sectionBody: { type: "string", maxLength: 100_000 },
    sequence: { type: "integer", minimum: 1, maximum: 999 }
  }
};

export const bootstrapWorldWizardSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "roles"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      summary: { type: "string", maxLength: 4000 },
      settings: { type: "object", additionalProperties: true },
      chapter: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          summary: { type: "string", maxLength: 4000 }
        }
      },
      sectionDefaults: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", maxLength: 200 },
          body: { type: "string", maxLength: 100_000 }
        }
      },
      roles: { type: "array", minItems: 1, maxItems: 24, items: wizardRoleSchema },
      automationTemplates: {
        type: "object",
        additionalProperties: false,
        properties: {
          reading: { type: "boolean" },
          clue: { type: "boolean" },
          chapter: { type: "boolean" },
          hint: { type: "boolean" }
        }
      },
      includeStarterGraph: { type: "boolean" },
      createTestRoom: { type: "boolean" },
      roomName: { type: "string", minLength: 1, maxLength: 120 },
      inviteCode: { type: "string", minLength: 4, maxLength: 32 },
      sectionPublicationStatus: { type: "string", enum: ["draft", "testing", "published"] }
    }
  }
};

export const worldTemplateIdParams = paramsSchema({
  templateId: { type: "string", minLength: 1, maxLength: 64 }
});

export const createWorldFromTemplateSchema = {
  params: worldTemplateIdParams,
  body: {
    type: "object",
    additionalProperties: true,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      summary: { type: "string", maxLength: 4000 },
      createTestRoom: { type: "boolean" },
      includeStarterGraph: { type: "boolean" }
    }
  }
};

export const betaApplicationIdParams = paramsSchema({
  applicationId: uuid
});

export const submitBetaApplicationSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["email", "displayName", "useCase"],
    properties: {
      email: { type: "string", minLength: 3, maxLength: 320 },
      displayName: { type: "string", minLength: 2, maxLength: 40 },
      roleIntent: { type: "string", enum: ["creator", "host", "player", "mixed", "other"] },
      useCase: { type: "string", minLength: 16, maxLength: 4000 },
      referralSource: { type: "string", maxLength: 200 },
      contact: { type: "string", maxLength: 200 },
      companyWebsite: { type: "string", maxLength: 200 },
      website: { type: "string", maxLength: 200 }
    }
  }
};

export const listPlazaPostsSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      kind: { type: "string", enum: ["chat", "recruit"] },
      limit: { type: "integer", minimum: 1, maximum: 60 }
    }
  }
};

export const createPlazaPostSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: {
      kind: { type: "string", enum: ["chat", "recruit"] },
      body: { type: "string", minLength: 1, maxLength: 500 },
      inviteCode: { type: "string", minLength: 1, maxLength: 80 }
    }
  }
};

export function uuidParams(name) {
  return paramsSchema({ [name]: uuid });
}

export const listPlazaRepliesSchema = {
  params: paramsSchema({ postId: uuid }),
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 200 }
    }
  }
};

export const createPlazaReplySchema = {
  params: paramsSchema({ postId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: {
      body: { type: "string", minLength: 1, maxLength: 500 },
      parentReplyId: uuid
    }
  }
};

export const createPlazaReportSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["targetType", "targetId", "reason"],
    properties: {
      targetType: { type: "string", enum: ["post", "reply"] },
      targetId: uuid,
      reason: { type: "string", minLength: 4, maxLength: 200 }
    }
  }
};

export const playerSearchSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["q"],
    properties: {
      q: { type: "string", minLength: 2, maxLength: 40 },
      limit: { type: "integer", minimum: 1, maximum: 20 }
    }
  }
};

export const sendFriendRequestSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["targetUserId"],
    properties: {
      targetUserId: uuid
    }
  }
};

export const respondFriendSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["targetUserId", "accept"],
    properties: {
      targetUserId: uuid,
      accept: { type: "boolean" }
    }
  }
};

export const openDmSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["peerUserId"],
    properties: {
      peerUserId: uuid
    }
  }
};

export const sendDmMessageSchema = {
  params: paramsSchema({ conversationId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: {
      body: { type: "string", minLength: 1, maxLength: 1000 }
    }
  }
};

/** B-batch route param schemas */
export const roomPlayerTaskParams = paramsSchema({ roomId: uuid, taskId: uuid });
export const roomSuspicionTargetParams = paramsSchema({ roomId: uuid, targetRoleSlotId: uuid });
export const roomTestimonyIdParams = paramsSchema({ roomId: uuid, testimonyId: uuid });
export const roomSegmentRemedyParams = paramsSchema({ roomId: uuid, remedyId: uuid });
export const worldSegmentRemedyParams = paramsSchema({ worldId: uuid, remedyId: uuid });

export const upsertPlayerSuspicionSchema = {
  params: roomSuspicionTargetParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      level: { type: "integer", minimum: 0, maximum: 5 },
      reason: { type: "string", maxLength: 500 }
    }
  }
};

export const submitTestimonySchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: {
      actKey: { type: "string", maxLength: 40 },
      act_key: { type: "string", maxLength: 40 },
      body: { type: "string", minLength: 1, maxLength: 4000 }
    }
  }
};

export const reviewTestimonySchema = {
  params: roomTestimonyIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      hostFlag: { type: "string", enum: ["noted", "contradiction"] },
      host_flag: { type: "string", enum: ["noted", "contradiction"] },
      hostNote: { type: "string", maxLength: 1000 },
      host_note: { type: "string", maxLength: 1000 }
    }
  }
};

export const replaceWorldTagsSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      tags: {
        type: "array",
        maxItems: 50,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            tagKey: { type: "string", maxLength: 32 },
            tag_key: { type: "string", maxLength: 32 },
            key: { type: "string", maxLength: 32 },
            tagValue: { type: "string", maxLength: 64 },
            tag_value: { type: "string", maxLength: 64 },
            value: { type: "string", maxLength: 64 }
          }
        }
      }
    }
  }
};

export const createSegmentRemedySchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["segmentKey", "title", "hostScript"],
    properties: {
      segmentKey: { type: "string", minLength: 1, maxLength: 40 },
      segment_key: { type: "string", minLength: 1, maxLength: 40 },
      title: { type: "string", minLength: 1, maxLength: 200 },
      hostScript: { type: "string", minLength: 1, maxLength: 4000 },
      host_script: { type: "string", minLength: 1, maxLength: 4000 },
      triggerHint: { type: "string", maxLength: 500 },
      trigger_hint: { type: "string", maxLength: 500 },
      sequence: { type: "integer", minimum: 1, maximum: 999 }
    }
  }
};
