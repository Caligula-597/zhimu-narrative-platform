import { paramsSchema, uuid } from "./primitives.js";
import { roomIdParams } from "./player.js";

export const listRoomRelationshipsSchema = { params: roomIdParams };

export const updateRoomRelationshipSchema = {
  params: paramsSchema({ roomId: uuid, relationshipId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["expectedRevision"],
    minProperties: 2,
    properties: {
      expectedRevision: { type: "integer", minimum: 0 },
      currentStrength: { type: "integer", minimum: -10, maximum: 10 },
      status: { type: "string", enum: ["unknown", "allied", "trusted", "strained", "hostile", "broken"] },
      disclosure: { type: "string", enum: ["hidden", "involved", "public"] },
      publicLabel: { type: "string", maxLength: 200 },
      publicNote: { type: "string", maxLength: 1000 },
      hostNote: { type: "string", maxLength: 2000 },
    },
  },
};
