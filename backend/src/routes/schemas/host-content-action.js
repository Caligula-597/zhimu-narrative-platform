import { paramsSchema, uuid } from "./primitives.js";

const roomIdParams = paramsSchema({ roomId: uuid });

export const hostGrantClueSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["clueId"],
    anyOf: [{ required: ["roleSlotId"] }, { required: ["roleSlotIds"] }],
    properties: {
      roleSlotId: uuid,
      roleSlotIds: {
        type: "array",
        items: uuid,
        minItems: 1,
        maxItems: 20,
        uniqueItems: true
      },
      clueId: uuid,
      message: { type: "string", maxLength: 500 }
    }
  }
};

export const hostGrantBookletSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["bookletId"],
    anyOf: [{ required: ["roleSlotId"] }, { required: ["roleSlotIds"] }],
    properties: {
      roleSlotId: uuid,
      roleSlotIds: {
        type: "array",
        items: uuid,
        minItems: 1,
        maxItems: 20,
        uniqueItems: true
      },
      bookletId: uuid,
      message: { type: "string", maxLength: 500 }
    }
  }
};

export const hostListMaterialBookletsSchema = {
  params: roomIdParams
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

export const hostUnlockActSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    anyOf: [{ required: ["actKey"] }, { required: ["sequence"] }],
    properties: {
      actKey: { type: "string", minLength: 1, maxLength: 120 },
      sequence: { type: "integer", minimum: 1, maximum: 99 },
      message: { type: "string", maxLength: 500 }
    }
  }
};

export const hostUnlockActScenesSchema = {
  params: roomIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    anyOf: [
      { required: ["actKey"] },
      { required: ["sequence"] },
      { required: ["chapterId"] },
      { required: ["sceneIds"] }
    ],
    properties: {
      actKey: { type: "string", minLength: 1, maxLength: 120 },
      sequence: { type: "integer", minimum: 1, maximum: 99 },
      chapterId: uuid,
      sceneIds: {
        type: "array",
        items: uuid,
        minItems: 1,
        maxItems: 50,
        uniqueItems: true
      },
      message: { type: "string", maxLength: 500 }
    }
  }
};

const hostSingleClueActionBody = {
  type: "object",
  additionalProperties: false,
  required: ["roleSlotId", "clueId"],
  properties: {
    roleSlotId: uuid,
    clueId: uuid,
    message: { type: "string", maxLength: 500 }
  }
};

export const hostRevokeClueSchema = {
  params: roomIdParams,
  body: hostSingleClueActionBody
};

export const hostResendClueSchema = {
  params: roomIdParams,
  body: hostSingleClueActionBody
};

const hostSectionOverrideBody = {
  type: "object",
  additionalProperties: false,
  required: ["roleSlotId", "scriptSectionId"],
  properties: {
    roleSlotId: uuid,
    scriptSectionId: uuid,
    message: { type: "string", maxLength: 500 }
  }
};

export const hostRelockSectionSchema = {
  params: roomIdParams,
  body: hostSectionOverrideBody
};

export const hostSkipSectionSchema = {
  params: roomIdParams,
  body: hostSectionOverrideBody
};

export const hostUnlockSceneSchema = {
  params: paramsSchema({ roomId: uuid, sceneId: uuid })
};
