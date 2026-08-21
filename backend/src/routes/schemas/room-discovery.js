import { paramsSchema, uuid } from "./primitives.js";

export const discoveryActionSchema = {
  params: paramsSchema({
    roomId: uuid,
    locationId: { type: "string", minLength: 1, maxLength: 160 }
  }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["action", "expectedRevision"],
    properties: {
      action: {
        type: "string",
        enum: ["scan_started", "scan_ready", "clue_drawn", "reshuffle"]
      },
      expectedRevision: { type: "integer", minimum: 0 }
    }
  }
};
