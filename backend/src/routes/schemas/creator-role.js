import { paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

export const roleSlotIdParams = paramsSchema({ worldId: uuid, roleSlotId: uuid });

export const createRoleSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "sequence"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120, pattern: "\\S" },
      publicProfile: { type: "string", maxLength: 4000 },
      privateProfile: { type: "string", maxLength: 20_000 },
      sequence: { type: "integer", minimum: 1, maximum: 9999 }
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
      name: { type: "string", minLength: 1, maxLength: 120, pattern: "\\S" },
      publicProfile: { type: "string", maxLength: 4000 },
      privateProfile: { type: "string", maxLength: 20_000 },
      sequence: { type: "integer", minimum: 1, maximum: 9999 }
    }
  }
};

export const deleteRoleSchema = { params: roleSlotIdParams };
