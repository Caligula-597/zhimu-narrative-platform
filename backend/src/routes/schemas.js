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

export const investigatePointSchema = {
  params: paramsSchema({ roomId: uuid, pointId: uuid })
};

export const readClueSchema = {
  params: paramsSchema({ roomId: uuid, clueId: uuid })
};

export const hostEventSchema = {
  params: paramsSchema({ roomId: uuid, eventId: uuid })
};

export const roleSlotRoomParams = paramsSchema({ roomId: uuid, roleSlotId: uuid });

export const hostGrantClueSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["roleSlotId", "clueId"],
    properties: {
      roleSlotId: uuid,
      clueId: uuid,
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
