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

export const hostUnlockSceneSchema = {
  params: paramsSchema({ roomId: uuid, sceneId: uuid })
};
