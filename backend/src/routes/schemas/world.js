import { nonEmptyText, paramsSchema, uuid } from "./primitives.js";
import { roomIdParams, roleSlotRoomParams } from "./player.js";

export const worldIdParams = paramsSchema({ worldId: uuid });

export const updateWorldSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      summary: { type: "string", maxLength: 4000 },
      settings: { type: "object", additionalProperties: true }
    }
  }
};

export const deleteWorldSchema = { params: worldIdParams };

export const updateWorldCatalogSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["catalogPublic"],
    properties: {
      catalogPublic: { type: "boolean" }
    }
  }
};

export const requestCatalogReviewSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["playtestNotes", "themeNotes", "agreed"],
    properties: {
      playtestNotes: { type: "string", minLength: 8, maxLength: 4000 },
      themeNotes: { type: "string", minLength: 8, maxLength: 4000 },
      sampleNotes: { type: "string", maxLength: 2000 },
      contact: { type: "string", maxLength: 200 },
      agreed: { type: "boolean" }
    }
  }
};

export const joinWorldCatalogSchema = { params: worldIdParams };

export const worldMemberUserIdParams = paramsSchema({ worldId: uuid, userId: uuid });

const collaborationRole = { type: "string", enum: ["editor", "host", "viewer"] };

export const addWorldMemberSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["email", "role"],
    properties: {
      email: { type: "string", minLength: 3, maxLength: 254 },
      role: collaborationRole
    }
  }
};

export const updateWorldMemberSchema = {
  params: worldMemberUserIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["role"],
    properties: {
      role: collaborationRole
    }
  }
};

export const deleteWorldMemberSchema = { params: worldMemberUserIdParams };

export const updateRoomSettingsSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["settings"],
    properties: {
      settings: {
        type: "object",
        additionalProperties: false,
        properties: {
          hostVoiceListen: { type: "boolean" },
          defaultRunMode: { type: "string", enum: ["automatic", "host_confirm", "manual"] }
        },
        minProperties: 1
      }
    }
  }
};

const contentMetadataObject = { type: "object", additionalProperties: true };
const contentOptionalUuid = { anyOf: [uuid, { type: "null" }] };
const contentVisibility = { type: "string", enum: ["author", "host", "role", "faction", "public", "postgame"] };

export const createTruthClaimSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "claim"],
    properties: {
      claimKey: { type: "string", maxLength: 120 },
      title: { type: "string", minLength: 1, maxLength: 200 },
      claim: { type: "string", minLength: 1, maxLength: 12000 },
      revealStage: { type: "string", maxLength: 120 },
      confidence: { type: "string", enum: ["canon", "inferred", "misdirection", "unknown"] },
      evidence: { type: "array", maxItems: 100, items: contentMetadataObject },
      contradictions: { type: "array", maxItems: 100, items: contentMetadataObject },
      roleVisibility: contentMetadataObject,
      metadata: contentMetadataObject
    }
  }
};

export const bibleRoleSlotParams = paramsSchema({ worldId: uuid, roleSlotId: uuid });
export const bibleBeatIdParams = paramsSchema({ worldId: uuid, beatId: uuid });
export const bibleEventIdParams = paramsSchema({ worldId: uuid, eventId: uuid });
export const truthClaimIdParams = paramsSchema({ worldId: uuid, claimId: uuid });

export const patchCoreTrickSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string", maxLength: 12000 },
      killerRoleSlotId: contentOptionalUuid,
      method: { type: "string", maxLength: 12000 },
      motive: { type: "string", maxLength: 12000 },
      victim: { type: "string", maxLength: 500 },
      hostNotes: { type: "string", maxLength: 12000 },
      metadata: contentMetadataObject
    }
  }
};

export const patchRoleArchiveSchema = {
  params: bibleRoleSlotParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      publicIdentity: { type: "string", maxLength: 4000 },
      hiddenIdentity: { type: "string", maxLength: 8000 },
      externalGoal: { type: "string", maxLength: 4000 },
      internalNeed: { type: "string", maxLength: 4000 },
      secret: { type: "string", maxLength: 8000 },
      actionLine: { type: "string", maxLength: 8000 },
      innerConflict: { type: "string", maxLength: 4000 },
      voiceHints: { type: "string", maxLength: 4000 },
      arc: contentMetadataObject,
      lies: { type: "array", maxItems: 12, items: { type: "string", maxLength: 2000 } },
      actTasks: { type: "array", maxItems: 24, items: contentMetadataObject },
      metadata: contentMetadataObject
    }
  }
};

export const postForeshadowBeatSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string", maxLength: 200 },
      plantSummary: { type: "string", maxLength: 4000 },
      surfaceMeaning: { type: "string", maxLength: 4000 },
      trueMeaning: { type: "string", maxLength: 4000 },
      payoffSummary: { type: "string", maxLength: 4000 },
      sequence: { type: "integer", minimum: 1, maximum: 999 },
      plantChapterId: contentOptionalUuid,
      payoffChapterId: contentOptionalUuid,
      plantSectionId: contentOptionalUuid,
      payoffSectionId: contentOptionalUuid,
      clueId: contentOptionalUuid,
      metadata: contentMetadataObject
    }
  }
};

export const patchForeshadowBeatSchema = {
  params: bibleBeatIdParams,
  body: postForeshadowBeatSchema.body
};

export const postTimelineEventSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      timeLabel: { type: "string", maxLength: 120 },
      eventSummary: { type: "string", maxLength: 4000 },
      sequence: { type: "integer", minimum: 1, maximum: 999 },
      chapterId: contentOptionalUuid,
      sceneId: contentOptionalUuid,
      participantRoleIds: { type: "array", maxItems: 16, items: uuid },
      alibiNotes: { type: "string", maxLength: 4000 },
      metadata: contentMetadataObject
    }
  }
};

export const patchTimelineEventSchema = {
  params: bibleEventIdParams,
  body: postTimelineEventSchema.body
};

export const patchTruthClaimSchema = {
  params: truthClaimIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      claimKey: { type: "string", maxLength: 120 },
      title: { type: "string", minLength: 1, maxLength: 200 },
      claim: { type: "string", minLength: 1, maxLength: 12000 },
      revealStage: { type: "string", maxLength: 120 },
      confidence: { type: "string", enum: ["canon", "inferred", "misdirection", "unknown"] },
      evidence: { type: "array", maxItems: 100, items: contentMetadataObject },
      contradictions: { type: "array", maxItems: 100, items: contentMetadataObject },
      roleVisibility: contentMetadataObject,
      metadata: contentMetadataObject
    }
  }
};

export const createQualityReportSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      source: { type: "string", enum: ["manual", "matrix", "publish_readiness", "playtest"] },
      promptVersion: { type: "string", maxLength: 80 },
      report: contentMetadataObject,
      issueCount: { type: "integer", minimum: 0, maximum: 9999 },
      score: { type: "number", minimum: 0, maximum: 100 }
    }
  }
};

export const createRoomVoteSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      segmentId: contentOptionalUuid,
      title: { type: "string", minLength: 1, maxLength: 200 },
      prompt: { type: "string", maxLength: 2000 },
      voteType: { type: "string", enum: ["accusation", "choice", "rating", "custom"] },
      visibility: { type: "string", enum: ["secret", "public", "secret_until_published"] },
      settings: contentMetadataObject,
      options: {
        type: "array",
        minItems: 1,
        maxItems: 80,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label"],
          properties: {
            roleSlotId: contentOptionalUuid,
            label: { type: "string", minLength: 1, maxLength: 200 },
            description: { type: "string", maxLength: 2000 },
            sequence: { type: "integer", minimum: 1, maximum: 999 },
            metadata: contentMetadataObject
          }
        }
      }
    }
  }
};

export const voteIdParams = paramsSchema({ roomId: uuid, voteId: uuid });

export const submitVoteBallotSchema = {
  params: voteIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      optionId: contentOptionalUuid,
      freeText: { type: "string", maxLength: 2000 },
      evidence: { type: "array", maxItems: 50, items: contentMetadataObject },
      metadata: contentMetadataObject
    }
  }
};

export const updateRoomVoteStatusSchema = {
  params: voteIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["open", "closed", "published", "cancelled"] }
    }
  }
};

export const updateSuspicionSchema = {
  params: paramsSchema({ roomId: uuid, targetRoleSlotId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["level"],
    properties: {
      level: { type: "integer", minimum: 0, maximum: 5 },
      reason: { type: "string", maxLength: 2000 },
      evidence: { type: "array", maxItems: 50, items: contentMetadataObject }
    }
  }
};

export const startMiniGameSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["answer"],
    properties: {
      gameType: { type: "string", enum: ["zhimu_lock"] },
      title: { type: "string", maxLength: 120 },
      prompt: { type: "string", maxLength: 500 },
      hint: { type: "string", maxLength: 500 },
      answer: { type: "string", minLength: 1, maxLength: 32 },
      length: { type: "integer", minimum: 1, maximum: 12 },
      maxAttempts: { type: "integer", minimum: 1, maximum: 12 },
      max_attempts: { type: "integer", minimum: 1, maximum: 12 }
    }
  }
};

export const forceCompleteMiniGameSchema = {
  params: paramsSchema({ roomId: uuid, gameId: uuid })
};

export const roomRuleIdParams = paramsSchema({ roomId: uuid, ruleId: uuid });

export const triggerManualRuleSchema = {
  params: roomRuleIdParams
};

export const roomRulesPreviewSchema = {
  params: roomIdParams
};

export {
  createPrivateActionSchema,
  createRoleRelationshipSchema,
  createSegmentSchema,
  roleRelationshipIdParams,
  privateActionListSchema,
  updatePrivateActionSchema,
  updateRoleStateSchema,
  updateSegmentSchema
} from "./content-platform.js";
