const uuid = { type: "string", minLength: 36, maxLength: 36 };
const nonEmptyText = { type: "string", minLength: 1, maxLength: 1000 };

export function paramsSchema(properties) {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties
  };
}

export const roomIdParams = paramsSchema({ roomId: uuid });
export const voiceRoomIdParams = paramsSchema({ voiceRoomId: uuid });

export const inviteLookupSchema = {
  params: paramsSchema({
    inviteCode: { type: "string", minLength: 1, maxLength: 80 }
  })
};

export const joinRoomSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["inviteCode", "roleSlotId"],
    properties: {
      inviteCode: { type: "string", minLength: 1, maxLength: 80 },
      roleSlotId: uuid
    }
  }
};

export const createVoiceRoomSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 80 },
      roomType: { type: "string", enum: ["public", "role_private", "invite_private"] },
      inviteUserIds: { type: "array", maxItems: 20, items: uuid }
    }
  }
};

export const appendVoiceMembersSchema = {
  params: voiceRoomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["inviteUserIds"],
    properties: {
      inviteUserIds: { type: "array", minItems: 1, maxItems: 20, items: uuid }
    }
  }
};

export const sendVoiceMessageSchema = {
  params: voiceRoomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: { body: nonEmptyText }
  }
};

export const completeSectionSchema = {
  params: paramsSchema({ roomId: uuid, sectionId: uuid })
};

export const notebookEntrySchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["sourceType", "title", "body"],
    properties: {
      sourceType: { type: "string", minLength: 1, maxLength: 40 },
      sourceId: { anyOf: [uuid, { type: "null" }] },
      title: { type: "string", minLength: 1, maxLength: 120 },
      body: { type: "string", minLength: 1, maxLength: 5000 }
    }
  }
};

export const deleteNotebookEntrySchema = {
  params: paramsSchema({ roomId: uuid, entryId: uuid })
};

export const investigatePointSchema = {
  params: paramsSchema({ roomId: uuid, pointId: uuid })
};

export const readClueSchema = {
  params: paramsSchema({ roomId: uuid, clueId: uuid })
};

export const cluePlayerNoteSchema = {
  params: paramsSchema({ roomId: uuid, clueId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["note"],
    properties: {
      note: { type: "string", maxLength: 2000 }
    }
  }
};

export const clueShareRoomSchema = {
  params: paramsSchema({ roomId: uuid, clueId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      shared: { type: "boolean" }
    }
  }
};

export const clueShareRolesSchema = {
  params: paramsSchema({ roomId: uuid, clueId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["roleSlotIds"],
    properties: {
      roleSlotIds: {
        type: "array",
        items: uuid,
        maxItems: 20
      }
    }
  }
};

export const hostClueNoteSchema = {
  params: paramsSchema({ roomId: uuid, clueId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["roleSlotId", "hostNote"],
    properties: {
      roleSlotId: uuid,
      hostNote: { type: "string", maxLength: 2000 }
    }
  }
};

export const hostEventSchema = {
  params: paramsSchema({ roomId: uuid, eventId: uuid })
};

export const hostEventDelaySchema = {
  params: paramsSchema({ roomId: uuid, eventId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["delayMinutes"],
    properties: {
      delayMinutes: { type: "integer", minimum: 1, maximum: 1440 }
    }
  }
};

export const hostEventBatchSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["action", "eventIds"],
    properties: {
      action: { type: "string", enum: ["execute", "dismiss"] },
      eventIds: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        items: uuid
      }
    }
  }
};

export const roleSlotRoomParams = paramsSchema({ roomId: uuid, roleSlotId: uuid });

export const hostGrantClueSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["clueId"],
    properties: {
      roleSlotId: uuid,
      roleSlotIds: {
        type: "array",
        items: uuid,
        minItems: 1,
        maxItems: 20
      },
      clueId: uuid,
      message: { type: "string", maxLength: 500 }
    }
  }
};

export const hostGrantItemSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["roleSlotId", "itemId"],
    properties: {
      roleSlotId: uuid,
      itemId: uuid,
      quantity: { type: "integer", minimum: 1, maximum: 99 },
      message: { type: "string", maxLength: 500 }
    }
  }
};

export const hostUnlockSectionSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["roleSlotId", "scriptSectionId"],
    properties: {
      roleSlotId: uuid,
      scriptSectionId: uuid,
      message: { type: "string", maxLength: 500 }
    }
  }
};

export const hostLogSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["message"],
    properties: {
      message: nonEmptyText,
      eventType: { type: "string", maxLength: 40 },
      roleSlotId: uuid
    }
  }
};

export const hostNudgeWaitingSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      message: { type: "string", maxLength: 500 },
      roleSlotIds: { type: "array", items: uuid, maxItems: 32 }
    }
  }
};

export const hostNotesSchema = {
  params: roleSlotRoomParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["notes"],
    properties: {
      notes: { type: "string", maxLength: 2000 }
    }
  }
};

export const checkpointIdParams = paramsSchema({
  roomId: uuid,
  checkpointId: uuid
});

export const createRecapSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 120 },
      description: { type: "string", maxLength: 2000 }
    }
  }
};

export const recapIdParams = paramsSchema({
  roomId: uuid,
  recapId: uuid
});

export const createCheckpointSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 120 },
      description: { type: "string", maxLength: 2000 }
    }
  }
};

export const restoreCheckpointSchema = {
  params: checkpointIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      scope: {
        type: "object",
        additionalProperties: false,
        properties: {
          readingProgress: { type: "boolean" },
          clueOwnership: { type: "boolean" },
          inventory: { type: "boolean" },
          contentUnlocks: { type: "boolean" },
          pendingHostEvents: { type: "boolean" },
          investigationRecords: { type: "boolean" },
          playerStates: { type: "boolean" },
          ruleExecutions: { type: "boolean" },
          timelineLogs: { type: "boolean" }
        }
      }
    }
  }
};

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

const segmentPayload = {
  type: "object",
  additionalProperties: false,
  required: ["segmentKey", "title"],
  properties: {
    segmentKey: { type: "string", minLength: 1, maxLength: 120 },
    title: { type: "string", minLength: 1, maxLength: 200 },
    sequence: { type: "integer", minimum: 1, maximum: 999 },
    chapterId: contentOptionalUuid,
    story: contentMetadataObject,
    mechanics: contentMetadataObject,
    operations: contentMetadataObject,
    quality: contentMetadataObject,
    metadata: contentMetadataObject,
    refs: {
      type: "array",
      maxItems: 200,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["refType", "refId"],
        properties: {
          refType: { type: "string", enum: ["chapter", "script_section", "scene", "clue", "item", "rule", "truth_claim"] },
          refId: uuid,
          roleSlotId: contentOptionalUuid,
          metadata: contentMetadataObject
        }
      }
    }
  }
};

export const createSegmentSchema = {
  params: worldIdParams,
  body: segmentPayload
};

export const segmentIdParams = paramsSchema({ worldId: uuid, segmentId: uuid });

export const updateSegmentSchema = {
  params: segmentIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      segmentKey: { type: "string", minLength: 1, maxLength: 120 },
      title: { type: "string", minLength: 1, maxLength: 200 },
      sequence: { type: "integer", minimum: 1, maximum: 999 },
      chapterId: contentOptionalUuid,
      story: contentMetadataObject,
      mechanics: contentMetadataObject,
      operations: contentMetadataObject,
      quality: contentMetadataObject,
      metadata: contentMetadataObject,
      refs: segmentPayload.properties.refs
    }
  }
};

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

export const createPrivateActionSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["actionType", "title"],
    properties: {
      segmentId: contentOptionalUuid,
      targetRoleSlotId: contentOptionalUuid,
      actionType: { type: "string", enum: ["ask_host", "secret_action", "trade", "promise", "accusation_note"] },
      title: { type: "string", minLength: 1, maxLength: 200 },
      body: { type: "string", maxLength: 4000 },
      payload: contentMetadataObject,
      visibility: { type: "string", enum: ["actor_host", "actor_target_host", "host_only", "postgame"] }
    }
  }
};

export const privateActionIdParams = paramsSchema({ roomId: uuid, actionId: uuid });

export const updatePrivateActionSchema = {
  params: privateActionIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["seen", "accepted", "rejected", "resolved", "cancelled"] },
      hostResponse: { type: "string", maxLength: 4000 }
    }
  }
};

export const updateRoleStateSchema = {
  params: roleSlotRoomParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      factionKey: { type: "string", maxLength: 120 },
      publicAlias: { type: "string", maxLength: 120 },
      hiddenIdentity: { type: "string", maxLength: 500 },
      variables: contentMetadataObject
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

export const submitMiniGameSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["roomId", "answer"],
    properties: {
      roomId: uuid,
      instanceId: uuid,
      instance_id: uuid,
      gameId: uuid,
      game_id: uuid,
      answer: { type: "string", minLength: 1, maxLength: 64 }
    }
  }
};

export const roomRuleIdParams = paramsSchema({ roomId: uuid, ruleId: uuid });

export const triggerManualRuleSchema = {
  params: roomRuleIdParams
};

export const roomRulesPreviewSchema = {
  params: roomIdParams
};

export const createWorldSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      summary: { type: "string", maxLength: 4000 },
      settings: { type: "object", additionalProperties: true }
    }
  }
};

export const assetIdParams = paramsSchema({ assetId: uuid });

export const assetUploadUrlSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["worldId", "filename", "contentType", "byteSize"],
    properties: {
      worldId: uuid,
      roomId: { anyOf: [uuid, { type: "null" }] },
      filename: { type: "string", minLength: 1, maxLength: 255 },
      contentType: { type: "string", minLength: 3, maxLength: 120 },
      byteSize: { type: "integer", minimum: 1, maximum: 31_457_280 },
      visibility: { type: "string", enum: ["author", "host", "role", "public"] },
      roleSlotId: { anyOf: [uuid, { type: "null" }] }
    }
  }
};

export const confirmAssetSchema = {
  params: assetIdParams
};

export const deleteAssetSchema = {
  params: assetIdParams
};

export const restoreAssetSchema = {
  params: assetIdParams
};

const metadataObject = { type: "object", additionalProperties: true };
const optionalUuid = { anyOf: [uuid, { type: "null" }] };
const publicationStatus = { type: "string", enum: ["draft", "testing", "published"] };
const clueVisibility = { type: "string", enum: ["author", "host", "role", "faction", "public", "postgame"] };
const studioNodeType = { type: "string", enum: ["chapter", "scene", "clue", "investigation_point", "item"] };
const graphNodeType = { type: "string", enum: ["chapter", "scene", "clue", "investigation_point", "item"] };
const studioLayoutMode = {
  type: "string",
  enum: ["scene-tree", "columns", "flow-horizontal", "flow-vertical", "chapter-groups"]
};
const storyEdgeNodeType = { type: "string", enum: ["chapter", "scene", "clue", "investigation_point"] };
const relationType = { type: "string", enum: ["mainline", "parallel", "extension"] };
const ruleMode = { type: "string", enum: ["automatic", "host_confirm", "manual"] };

export const sceneIdParams = paramsSchema({ worldId: uuid, sceneId: uuid });
export const clueIdParams = paramsSchema({ worldId: uuid, clueId: uuid });
export const investigationPointIdParams = paramsSchema({ worldId: uuid, pointId: uuid });
export const itemIdParams = paramsSchema({ worldId: uuid, itemId: uuid });
export const roleSlotIdParams = paramsSchema({ worldId: uuid, roleSlotId: uuid });
export const chapterIdParams = paramsSchema({ worldId: uuid, chapterId: uuid });
export const sectionIdParams = paramsSchema({ worldId: uuid, roleSlotId: uuid, sectionId: uuid });
export const contentVersionIdParams = paramsSchema({ worldId: uuid, versionId: uuid });
export const storyEdgeIdParams = paramsSchema({ worldId: uuid, edgeId: uuid });
export const ruleIdParams = paramsSchema({ worldId: uuid, ruleId: uuid });
export const studioNodeParams = paramsSchema({ worldId: uuid, nodeType: graphNodeType, nodeId: uuid });

export const createSceneSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 20_000 },
      hostText: { type: "string", maxLength: 20_000 },
      chapterId: optionalUuid,
      metadata: metadataObject
    }
  }
};

export const createClueSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 20_000 },
      hostText: { type: "string", maxLength: 20_000 },
      visibility: clueVisibility,
      metadata: metadataObject
    }
  }
};

export const patchSceneSchema = {
  params: sceneIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 20_000 },
      hostText: { type: "string", maxLength: 20_000 },
      chapterId: optionalUuid,
      metadata: metadataObject
    }
  }
};

export const patchClueSchema = {
  params: clueIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 20_000 },
      hostText: { type: "string", maxLength: 20_000 },
      visibility: clueVisibility,
      metadata: metadataObject
    }
  }
};

export const patchInvestigationPointSchema = {
  params: investigationPointIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      description: { type: "string", maxLength: 10_000 },
      interactionText: { type: "string", maxLength: 10_000 },
      resultText: { type: "string", maxLength: 10_000 },
      sceneId: uuid,
      clueId: optionalUuid,
      requiredItemId: optionalUuid,
      requiredRoleSlotId: optionalUuid,
      sequence: { type: "integer", minimum: 0, maximum: 9999 },
      metadata: metadataObject
    }
  }
};

export const createInvestigationPointSchema = {
  params: sceneIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      description: { type: "string", maxLength: 10_000 },
      interactionText: { type: "string", maxLength: 10_000 },
      resultText: { type: "string", maxLength: 10_000 },
      clueId: optionalUuid,
      requiredItemId: optionalUuid,
      requiredRoleSlotId: optionalUuid,
      sequence: { type: "integer", minimum: 0, maximum: 9999 },
      metadata: metadataObject
    }
  }
};

export const createItemSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 10_000 },
      hostText: { type: "string", maxLength: 10_000 },
      unique: { type: "boolean" },
      consumable: { type: "boolean" },
      assetId: optionalUuid,
      metadata: metadataObject
    }
  }
};

export const patchItemSchema = {
  params: itemIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicText: { type: "string", maxLength: 10_000 },
      hostText: { type: "string", maxLength: 10_000 },
      unique: { type: "boolean" },
      consumable: { type: "boolean" },
      assetId: optionalUuid,
      metadata: metadataObject
    }
  }
};

export const deleteItemSchema = { params: itemIdParams };

export const createContentVersionSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      label: { type: "string", minLength: 1, maxLength: 120 }
    }
  }
};

export const restoreContentVersionSchema = { params: contentVersionIdParams };
export const deleteContentVersionSchema = { params: contentVersionIdParams };

export const createStoryEdgeSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["fromType", "fromId", "toType", "toId"],
    properties: {
      fromType: storyEdgeNodeType,
      fromId: uuid,
      toType: storyEdgeNodeType,
      toId: uuid,
      relationType,
      label: { type: "string", maxLength: 200 }
    }
  }
};

export const deleteStoryEdgeSchema = { params: storyEdgeIdParams };

export const deleteStudioNodeSchema = {
  params: paramsSchema({ worldId: uuid, nodeType: studioNodeType, nodeId: uuid })
};

export const studioNodeReferencesSchema = {
  params: paramsSchema({ worldId: uuid, nodeType: studioNodeType, nodeId: uuid })
};

export const updateNodePositionSchema = {
  params: studioNodeParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["x", "y"],
    properties: {
      x: { type: "number" },
      y: { type: "number" }
    }
  }
};

export const updateNodeAnchorsSchema = {
  params: studioNodeParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["anchors"],
    properties: {
      anchors: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "x", "y"],
          properties: {
            id: { type: "string", minLength: 1, maxLength: 80 },
            x: { type: "number" },
            y: { type: "number" }
          }
        }
      }
    }
  }
};

export const updateStoryLayoutSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["positions"],
    properties: {
      positions: {
        type: "array",
        maxItems: 1000,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "id", "x", "y"],
          properties: {
            type: graphNodeType,
            id: uuid,
            x: { type: "number" },
            y: { type: "number" }
          }
        }
      }
    }
  }
};

export const autoStoryLayoutSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      mode: { ...studioLayoutMode, default: "columns" }
    }
  }
};

export const parseDocumentSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["filename"],
    properties: {
      filename: { type: "string", minLength: 1, maxLength: 255 },
      contentType: { type: "string", minLength: 3, maxLength: 120 },
      dataBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
      contentBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
      parseMode: { type: "string", enum: ["auto", "pages", "text"] },
      allowOcr: { type: "boolean" }
    },
    anyOf: [{ required: ["dataBase64"] }, { required: ["contentBase64"] }]
  }
};

export const importDocumentPagesSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["filename", "roleSlotId"],
    properties: {
      filename: { type: "string", minLength: 1, maxLength: 255 },
      contentType: { type: "string", minLength: 3, maxLength: 120 },
      dataBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
      contentBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
      roleSlotId: uuid,
      title: { type: "string", maxLength: 200 },
      layout: { type: "string", enum: ["single_section", "one_section_per_page"] },
      publicationStatus,
      parseMode: { type: "string", enum: ["auto", "pages", "text"] },
      allowOcr: { type: "boolean" }
    },
    anyOf: [{ required: ["dataBase64"] }, { required: ["contentBase64"] }]
  }
};

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

export const importDocumentSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["target", "document"],
    properties: {
      target: { type: "string", enum: ["manuscript", "role_script"] },
      roleSlotId: optionalUuid,
      document: {
        type: "object",
        additionalProperties: false,
        required: ["text", "sections"],
        properties: {
          text: { type: "string", maxLength: 2_000_000 },
          filename: { type: "string", maxLength: 255 },
          sections: {
            type: "array",
            maxItems: 500,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "body"],
              properties: {
                title: { type: "string", minLength: 1, maxLength: 200 },
                body: { type: "string", maxLength: 200_000 }
              }
            }
          }
        }
      }
    }
  }
};

export const createRoleSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "sequence"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicProfile: { type: "string", maxLength: 4000 },
      privateProfile: { type: "string", maxLength: 20_000 },
      sequence: { type: "integer", minimum: 0, maximum: 9999 }
    }
  }
};

export const updateRoleSchema = {
  params: roleSlotIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "sequence"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicProfile: { type: "string", maxLength: 4000 },
      privateProfile: { type: "string", maxLength: 20_000 },
      sequence: { type: "integer", minimum: 0, maximum: 9999 }
    }
  }
};

export const deleteRoleSchema = { params: roleSlotIdParams };

export const createChapterSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "sequence"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      summary: { type: "string", maxLength: 4000 },
      sequence: { type: "integer", minimum: 0, maximum: 9999 }
    }
  }
};

export const updateChapterSchema = {
  params: chapterIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      summary: { type: "string", maxLength: 4000 },
      publicationStatus,
      unlockRules: metadataObject,
      metadata: metadataObject
    }
  }
};

export const createSectionSchema = {
  params: roleSlotIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "body", "sequence"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      body: { type: "string", minLength: 1, maxLength: 500_000 },
      sequence: { type: "integer", minimum: 0, maximum: 9999 },
      chapterId: optionalUuid,
      publicationStatus
    }
  }
};

export const updateSectionSchema = {
  params: sectionIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "body"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      body: { type: "string", minLength: 1, maxLength: 500_000 },
      chapterId: optionalUuid,
      publicationStatus
    }
  }
};

export const deleteSectionSchema = { params: sectionIdParams };

export const createRoomSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "inviteCode"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 80 },
      inviteCode: { type: "string", minLength: 1, maxLength: 80 },
      publicListing: { type: "boolean" }
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

const ruleJsonObject = { type: "object", additionalProperties: true };
const ruleActionType = {
  type: "string",
  enum: ["unlock_script_section", "unlock_scene", "grant_clue", "grant_item", "timeline_log"]
};
const ruleActionItem = {
  type: "object",
  additionalProperties: true,
  required: ["type"],
  properties: {
    type: ruleActionType,
    roleSlotId: optionalUuid,
    scriptSectionId: uuid,
    sceneId: uuid,
    clueId: uuid,
    itemId: uuid,
    investigationPointId: uuid,
    quantity: { type: "integer", minimum: 1, maximum: 99 },
    message: { type: "string", maxLength: 2000 },
    source: { type: "string", maxLength: 80 },
    key: { type: "string", maxLength: 120 },
    operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte"] },
    value: {},
    metadata: metadataObject
  }
};
const ruleActionsArray = {
  type: "array",
  minItems: 1,
  maxItems: 50,
  items: ruleActionItem
};

export const createRuleSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "conditions", "actions"],
    properties: {
      roomId: optionalUuid,
      name: { type: "string", minLength: 1, maxLength: 120 },
      mode: ruleMode,
      priority: { type: "integer", minimum: 0, maximum: 9999 },
      enabled: { type: "boolean" },
      conditions: ruleJsonObject,
      actions: ruleActionsArray
    }
  }
};

export const updateRuleSchema = {
  params: ruleIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "conditions", "actions"],
    properties: {
      roomId: optionalUuid,
      name: { type: "string", minLength: 1, maxLength: 120 },
      mode: ruleMode,
      priority: { type: "integer", minimum: 0, maximum: 9999 },
      enabled: { type: "boolean" },
      conditions: ruleJsonObject,
      actions: ruleActionsArray
    }
  }
};

export const deleteRuleSchema = { params: ruleIdParams };

export const validateRuleBodySchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["conditions", "actions"],
    properties: {
      conditions: ruleJsonObject,
      actions: ruleActionsArray
    }
  }
};

export const validateRulesSchema = { params: worldIdParams };

export const contentPackageEnvelopeSchema = {
  body: {
    type: "object",
    additionalProperties: true,
    required: ["format", "version", "data"],
    properties: {
      format: { type: "string", minLength: 1, maxLength: 80 },
      version: { type: "integer", minimum: 1, maximum: 99 },
      data: { type: "object", additionalProperties: true }
    }
  }
};

export const createWorldFromPackageSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      summary: { type: "string", maxLength: 4000 },
      data: { type: "object", additionalProperties: true },
      format: { type: "string", maxLength: 80 },
      version: { type: "integer", minimum: 1, maximum: 99 }
    }
  }
};

const deepseekBriefBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: 120 },
    premise: { type: "string", maxLength: 4000 },
    conflicts: { type: "string", maxLength: 3000 },
    wordsPerChapter: { type: "integer", minimum: 2000, maximum: 12_000 },
    style: { type: "string", maxLength: 800 },
    audience: { type: "string", maxLength: 400 },
    requirements: { type: "string", maxLength: 3000 },
    roleRequirements: { type: "string", maxLength: 3000 },
    evaluationFocus: { type: "string", maxLength: 3000 },
    existingManuscript: { type: "string", maxLength: 12_000 },
    playerCount: { type: "integer", minimum: 4, maximum: 8 },
    targetWordCount: { type: "integer", minimum: 500, maximum: 20_000 },
    chapterCount: { type: "integer", minimum: 1, maximum: 12 },
    sceneCount: { type: "integer", minimum: 1, maximum: 40 },
    investigationPointCount: { type: "integer", minimum: 1, maximum: 80 },
    clueCount: { type: "integer", minimum: 1, maximum: 80 },
    skipOutline: { type: "boolean" }
  }
};

const deepseekJsonObject = { type: "object", additionalProperties: true };
const optionalNullableJsonObject = { anyOf: [deepseekJsonObject, { type: "null" }] };

const creativeSettingBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    theme: { type: "string", maxLength: 120 },
    playerCount: { type: "integer", minimum: 4, maximum: 8 },
    chapterCount: { type: "integer", minimum: 3, maximum: 5 },
    wordsPerChapter: { type: "integer", minimum: 2000, maximum: 12_000 },
    extraConflicts: { type: "string", maxLength: 3000 },
    tone: { type: "string", maxLength: 800 },
    volumeTier: { type: "string", enum: ["demo", "standard", "epic"] },
    pov: { type: "string", enum: ["second", "first"] },
    styleAnchor: { type: "string", maxLength: 2000 },
    forbiddenPhrases: { type: "string", maxLength: 1000 }
  }
};

const creativeSynopsisBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    body: { type: "string", maxLength: 12_000 },
    charactersSketch: { type: "string", maxLength: 4000 },
    truthSketch: { type: "string", maxLength: 4000 },
    redHerringsSketch: { type: "string", maxLength: 2000 }
  }
};

const creativePipelineFields = {
  setting: creativeSettingBody,
  synopsis: creativeSynopsisBody,
  config: deepseekJsonObject
};

export const deepseekPipelineSpecSchema = {
  params: worldIdParams,
  body: deepseekBriefBody
};

export const deepseekPipelineOutlineSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...deepseekBriefBody.properties,
      spec: deepseekJsonObject
    }
  }
};

export const deepseekPipelineStructureSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...deepseekBriefBody.properties,
      spec: deepseekJsonObject,
      outline: deepseekJsonObject
    }
  }
};

export const deepseekPipelineRoleMatrixSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["spec", "proposal"],
    properties: {
      ...deepseekBriefBody.properties,
      spec: deepseekJsonObject,
      outline: deepseekJsonObject,
      proposal: deepseekJsonObject
    }
  }
};

export const deepseekPipelineSectionSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["spec", "proposal", "roleMatrix", "roleKey", "chapterKey"],
    properties: {
      ...deepseekBriefBody.properties,
      spec: deepseekJsonObject,
      outline: deepseekJsonObject,
      proposal: deepseekJsonObject,
      roleMatrix: deepseekJsonObject,
      roleKey: { type: "string", minLength: 1, maxLength: 40 },
      chapterKey: { type: "string", minLength: 1, maxLength: 40 }
    }
  }
};

export const deepseekPipelineManuscriptSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["spec", "proposal"],
    properties: {
      ...deepseekBriefBody.properties,
      spec: deepseekJsonObject,
      outline: deepseekJsonObject,
      proposal: deepseekJsonObject,
      roleMatrix: deepseekJsonObject
    }
  }
};

export const deepseekPipelineImportSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["pipeline"],
    properties: {
      pipeline: {
        type: "object",
        additionalProperties: true,
        required: ["proposal"],
        properties: {
          proposal: deepseekJsonObject,
          roleMatrix: deepseekJsonObject,
          sections: deepseekJsonObject,
          synopsis: deepseekJsonObject,
          package: deepseekJsonObject
        }
      }
    }
  }
};

export const deepseekPipelineEvaluateSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...deepseekBriefBody.properties,
      ...creativePipelineFields,
      evaluationFocus: { type: "string", maxLength: 3000 },
      spec: optionalNullableJsonObject,
      outline: optionalNullableJsonObject,
      proposal: optionalNullableJsonObject,
      roleMatrix: optionalNullableJsonObject,
      rolesMeta: optionalNullableJsonObject,
      sections: optionalNullableJsonObject,
      sampleSection: optionalNullableJsonObject,
      narrativeChapters: { type: "array", maxItems: 12, items: deepseekJsonObject },
      truthBible: optionalNullableJsonObject,
      characterArchives: optionalNullableJsonObject,
      infoMatrix: optionalNullableJsonObject,
      scripts: optionalNullableJsonObject,
      hostRunbooks: optionalNullableJsonObject
    }
  }
};

const matrixPipelineBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...creativePipelineFields,
    truthBible: optionalNullableJsonObject,
    characterArchives: optionalNullableJsonObject,
    infoMatrix: optionalNullableJsonObject,
    scripts: optionalNullableJsonObject,
    hostRunbooks: optionalNullableJsonObject,
    actKey: { type: "string", maxLength: 40 },
    roleKey: { type: "string", maxLength: 40 },
    deAiPass: { type: "boolean" }
  }
};

export const deepseekPipelineMatrixTruthSchema = {
  params: worldIdParams,
  body: matrixPipelineBody
};

export const deepseekPipelineMatrixCharactersSchema = {
  params: worldIdParams,
  body: { ...matrixPipelineBody, required: ["truthBible"] }
};

export const deepseekPipelineMatrixInfoSchema = {
  params: worldIdParams,
  body: { ...matrixPipelineBody, required: ["truthBible", "characterArchives"] }
};

export const deepseekPipelineMatrixHostSchema = {
  params: worldIdParams,
  body: { ...matrixPipelineBody, required: ["truthBible", "infoMatrix"] }
};

export const deepseekPipelineMatrixPlayerScriptSchema = {
  params: worldIdParams,
  body: {
    ...matrixPipelineBody,
    required: ["truthBible", "characterArchives", "infoMatrix", "roleKey", "actKey"]
  }
};

export const deepseekPipelineMatrixEvaluateSchema = {
  params: worldIdParams,
  body: {
    ...matrixPipelineBody,
    required: ["truthBible", "infoMatrix"]
  }
};

export const deepseekPipelineMatrixSyncPreviewSchema = {
  params: worldIdParams,
  body: {
    ...matrixPipelineBody,
    required: ["truthBible", "characterArchives", "infoMatrix"]
  }
};

/** 叙事优先流水线：逐章总剧情（承前启后） */
export const deepseekPipelineNarrativeChapterSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["chapterKey"],
    properties: {
      ...deepseekBriefBody.properties,
      ...creativePipelineFields,
      spec: deepseekJsonObject,
      chapterKey: { type: "string", minLength: 1, maxLength: 40 },
      previousChapters: {
        type: "array",
        maxItems: 12,
        items: deepseekJsonObject
      }
    }
  }
};

/** 从总剧情归纳角色元数据 */
export const deepseekPipelineNarrativeRolesMetaSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["chapters"],
    properties: {
      ...deepseekBriefBody.properties,
      ...creativePipelineFields,
      spec: deepseekJsonObject,
      chapters: { type: "array", minItems: 1, maxItems: 12, items: deepseekJsonObject }
    }
  }
};

/** 单角色私人剧本生成/改稿 */
export const deepseekPipelineNarrativeRoleScriptSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["roleKey", "role", "chapters"],
    properties: {
      ...deepseekBriefBody.properties,
      ...creativePipelineFields,
      spec: deepseekJsonObject,
      roleKey: { type: "string", minLength: 1, maxLength: 40 },
      role: deepseekJsonObject,
      chapters: { type: "array", minItems: 1, maxItems: 12, items: deepseekJsonObject },
      chapterKey: { type: "string", minLength: 1, maxLength: 40 },
      existingSections: { type: "array", maxItems: 12, items: deepseekJsonObject },
      revisionHint: { type: "string", maxLength: 2000 }
    }
  }
};

/** 叙事优先：从总剧情拆私人分幕 */
export const deepseekPipelineNarrativeRolesSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["spec", "roleMatrix", "chapters"],
    properties: {
      ...deepseekBriefBody.properties,
      spec: deepseekJsonObject,
      roleMatrix: deepseekJsonObject,
      proposal: deepseekJsonObject,
      chapters: { type: "array", minItems: 1, maxItems: 12, items: deepseekJsonObject }
    }
  }
};

/** 叙事优先：从总剧情抽取场景/线索/调查点 */
export const deepseekPipelineNarrativeExtractSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["chapters"],
    properties: {
      ...deepseekBriefBody.properties,
      ...creativePipelineFields,
      spec: deepseekJsonObject,
      chapters: { type: "array", minItems: 1, maxItems: 12, items: deepseekJsonObject },
      sectionsSample: { type: "array", maxItems: 6, items: deepseekJsonObject }
    }
  }
};

export const storyAssistantAnalyzeSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string", minLength: 1, maxLength: 500_000 }
    }
  }
};

export const storyAssistantImportSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string", minLength: 1, maxLength: 500_000 }
    }
  }
};

export const deepseekProposeSchema = {
  params: worldIdParams,
  body: deepseekBriefBody
};

export const deepseekImportSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["proposal"],
    properties: {
      proposal: { type: "object", additionalProperties: true }
    }
  }
};

export const deepseekMysteryProposeSchema = {
  params: worldIdParams,
  body: deepseekBriefBody
};

export const deepseekMysteryImportSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["mystery"],
    properties: {
      mystery: {
        type: "object",
        additionalProperties: false,
        required: ["proposal", "package"],
        properties: {
          proposal: { type: "object", additionalProperties: true },
          package: { type: "object", additionalProperties: true }
        }
      }
    }
  }
};

export const worldSearchQuerySchema = {
  params: worldIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["q"],
    properties: {
      q: { type: "string", minLength: 1, maxLength: 120 },
      limit: { type: "integer", minimum: 1, maximum: 50 },
      type: {
        type: "string",
        enum: ["all", "role", "section", "scene", "clue", "investigation_point", "rule", "item"]
      }
    }
  }
};

export const storyManuscriptPutSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: {
      body: { type: "string", minLength: 1, maxLength: 2_000_000 }
    }
  }
};

export const storyManuscriptSyncToGraphSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: {
      body: { type: "string", minLength: 1, maxLength: 2_000_000 }
    }
  }
};

export const storyManuscriptSyncFromGraphSchema = {
  params: worldIdParams,
  response: {
    200: {
      type: "object",
      properties: {
        body: { type: "string" },
        last_sync_direction: { type: "string" },
        updated_at: { type: "string" }
      }
    }
  }
};

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
