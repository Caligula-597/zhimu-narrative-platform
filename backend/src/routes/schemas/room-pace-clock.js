import { paramsSchema, uuid } from "./primitives.js";

export const paceClockActionSchema = {
  params: paramsSchema({ roomId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["action", "expectedRevision"],
    properties: {
      action: {
        type: "string",
        enum: ["configure", "start", "pause", "reset", "extend", "set_visibility"],
      },
      expectedRevision: { type: "integer", minimum: 0 },
      mode: { type: "string", enum: ["countup", "countdown"] },
      durationMs: { type: "integer", minimum: 0, maximum: 86400000 },
      extendMs: { type: "integer", minimum: 1000, maximum: 86400000 },
      label: { type: "string", maxLength: 80 },
      visibleToPlayers: { type: "boolean" },
    },
  },
};
