import { nonEmptyText, paramsSchema, uuid } from "./primitives.js";

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

export const sectionProgressResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    startedAt: { type: "string", format: "date-time" },
    completedAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] }
  },
  required: ["startedAt"]
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
