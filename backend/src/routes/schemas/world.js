import { nonEmptyText, paramsSchema, uuid } from "./primitives.js";
import { roomIdParams, roleSlotRoomParams } from "./player.js";
import { worldSettingsSchema } from "./world-settings.js";

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
      settings: worldSettingsSchema
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

const collaborationRole = { type: "string", enum: ["editor", "reviewer", "host", "viewer"] };

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

export const listWorldLogsSchema = {
  params: worldIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      roomId: uuid,
      eventType: {
        type: "string",
        maxLength: 80,
        pattern: "^[A-Za-z0-9_.:-]*$"
      },
      keyword: { type: "string", maxLength: 120 },
      limit: { type: "integer", minimum: 1, maximum: 200, default: 80 }
    }
  },
  response: {
    200: {
      type: "array",
      maxItems: 200,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "room_id", "room_name", "event_type", "message", "visibility", "metadata", "created_at"],
        properties: {
          id: { anyOf: [{ type: "string" }, { type: "integer" }] },
          room_id: uuid,
          room_name: { type: "string" },
          event_type: { type: "string" },
          message: { type: "string" },
          visibility: { type: "string", enum: ["author", "host", "role", "faction", "public", "postgame"] },
          metadata: { type: "object", additionalProperties: true },
          created_at: { type: "string" },
          actor_name: { anyOf: [{ type: "string" }, { type: "null" }] }
        }
      }
    }
  }
};

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
          defaultRunMode: { type: "string", enum: ["automatic", "host_confirm", "manual"] },
          runtimePresentation: {
            type: "object",
            additionalProperties: false,
            required: ["activeSegmentKey", "activeLocationId", "revealedLocationIds", "mapVisible", "updatedAt"],
            properties: {
              activeSegmentKey: { type: "string", maxLength: 120 },
              activeLocationId: { type: "string", maxLength: 80 },
              revealedLocationIds: {
                type: "array",
                maxItems: 24,
                uniqueItems: true,
                items: { type: "string", maxLength: 80 }
              },
              mapVisible: { type: "boolean" },
              activeCheck: {
                anyOf: [
                  { type: "null" },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "id", "templateId", "locationId", "label", "instruction", "target", "bonus",
                      "rollMode", "dice", "status", "result", "successText", "failureText",
                      "outcomeText", "startedAt", "resolvedAt"
                    ],
                    properties: {
                      id: { type: "string", minLength: 1, maxLength: 80 },
                      templateId: { type: "string", maxLength: 80 },
                      locationId: { type: "string", maxLength: 80 },
                      label: { type: "string", minLength: 1, maxLength: 80 },
                      instruction: { type: "string", maxLength: 240 },
                      target: { type: "integer", minimum: -9999, maximum: 9999 },
                      bonus: { type: "integer", minimum: -999, maximum: 999 },
                      rollMode: { type: "string", enum: ["normal", "advantage", "disadvantage"] },
                      dice: {
                        type: "object",
                        additionalProperties: false,
                        required: ["count", "sides", "modifier", "defaultTarget"],
                        properties: {
                          count: { type: "integer", minimum: 1, maximum: 10 },
                          sides: { type: "integer", minimum: 2, maximum: 1000 },
                          modifier: { type: "integer", minimum: -999, maximum: 999 },
                          defaultTarget: { type: "integer", minimum: -9999, maximum: 9999 }
                        }
                      },
                      status: { type: "string", enum: ["pending", "resolved"] },
                      result: {
                        anyOf: [
                          { type: "null" },
                          {
                            type: "object",
                            additionalProperties: false,
                            required: ["label", "rollMode", "attempts", "rolls", "rawTotal", "total", "target", "success", "criticalSuccess", "criticalFailure", "margin", "degree", "degreeLabel", "degreeRank"],
                            properties: {
                              label: { type: "string", maxLength: 80 },
                              rollMode: { type: "string", enum: ["normal", "advantage", "disadvantage"] },
                              attempts: { type: "array", maxItems: 2, items: { type: "array", maxItems: 10, items: { type: "integer", minimum: 1, maximum: 1000 } } },
                              rolls: { type: "array", minItems: 1, maxItems: 10, items: { type: "integer", minimum: 1, maximum: 1000 } },
                              rawTotal: { type: "integer", minimum: -9999, maximum: 9999 },
                              total: { type: "integer", minimum: -9999, maximum: 9999 },
                              target: { type: "integer", minimum: -9999, maximum: 9999 },
                              success: { type: "boolean" },
                              criticalSuccess: { type: "boolean" },
                              criticalFailure: { type: "boolean" },
                              margin: { type: "integer", minimum: -9999, maximum: 9999 },
                              degree: { type: "string", maxLength: 40 },
                              degreeLabel: { type: "string", maxLength: 40 },
                              degreeRank: { type: "integer", minimum: -9, maximum: 9 }
                            }
                          }
                        ]
                      },
                      successText: { type: "string", maxLength: 240 },
                      failureText: { type: "string", maxLength: 240 },
                      outcomeText: { type: "string", maxLength: 240 },
                      startedAt: { type: "string", maxLength: 40 },
                      resolvedAt: { type: "string", maxLength: 40 }
                    }
                  }
                ]
              },
              activeEncounter: {
                anyOf: [
                  { type: "null" },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["locationId", "npcIds", "status", "startedAt"],
                    properties: {
                      locationId: { type: "string", minLength: 1, maxLength: 80 },
                      npcIds: {
                        type: "array",
                        minItems: 1,
                        maxItems: 12,
                        uniqueItems: true,
                        items: { type: "string", minLength: 1, maxLength: 80 }
                      },
                      status: { type: "string", enum: ["active"] },
                      startedAt: { type: "string", format: "date-time" }
                    }
                  }
                ]
              },
              updatedAt: { type: "string", format: "date-time" }
            }
          }
        },
        minProperties: 1
      }
    }
  }
};

const contentMetadataObject = { type: "object", additionalProperties: true };
const contentOptionalUuid = { anyOf: [uuid, { type: "null" }] };
const contentVisibility = { type: "string", enum: ["author", "host", "role", "faction", "public", "postgame"] };

export const bibleRoleSlotParams = paramsSchema({ worldId: uuid, roleSlotId: uuid });
export const bibleBeatIdParams = paramsSchema({ worldId: uuid, beatId: uuid });
export const bibleEventIdParams = paramsSchema({ worldId: uuid, eventId: uuid });

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
