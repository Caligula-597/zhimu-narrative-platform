import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });

const fileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["filename", "contentBase64"],
  properties: {
    filename: { type: "string", minLength: 1, maxLength: 260 },
    contentBase64: { type: "string", minLength: 1 },
    roleName: { type: "string", maxLength: 120 }
  }
};

export const runCompilerV2Schema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["rightsConfirmed", "hostHandbook"],
    properties: {
      rightsConfirmed: { type: "boolean" },
      creationType: {
        type: "string",
        enum: ["murder_mystery", "tabletop_rpg", "board_game"]
      },
      hostHandbook: fileSchema,
      roleScripts: {
        type: "array",
        maxItems: 24,
        items: fileSchema
      },
      clueTextDoc: fileSchema,
      mechanismDoc: fileSchema,
      sceneDocs: {
        type: "array",
        maxItems: 24,
        items: fileSchema
      },
      notes: { type: "string", maxLength: 5000 }
    }
  }
};

export const compilerV2JobQuerySchema = {
  params: worldIdParams,
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["jobId"],
    properties: {
      jobId: uuid
    }
  }
};

export const commitCompilerV2Schema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["jobId", "confirmCommit"],
    properties: {
      jobId: uuid,
      confirmCommit: { type: "boolean" }
    }
  }
};

export const confirmCompilerV2StageSchemaSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["jobId", "decision"],
    properties: {
      jobId: uuid,
      decision: {
        type: "string",
        enum: ["confirm", "reject", "manual"]
      },
      items: {
        type: "array",
        maxItems: 24,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: {
            order: { type: "integer", minimum: 1, maximum: 99 },
            name: { type: "string", minLength: 1, maxLength: 80 }
          }
        }
      }
    }
  }
};
