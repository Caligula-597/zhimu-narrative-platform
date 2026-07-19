import { uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

export const createRoomSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 80 },
      inviteCode: { type: "string", minLength: 1, maxLength: 80, deprecated: true },
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
