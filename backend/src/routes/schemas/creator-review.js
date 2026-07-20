import { paramsSchema, uuid } from "./primitives.js";

const targetType = {
  type: "string",
  enum: ["world", "manuscript", "role", "chapter", "script_section", "scene", "clue", "rule", "truth_claim", "segment"]
};
const kind = { type: "string", enum: ["comment", "suggestion", "change_request"] };
const status = { type: "string", enum: ["open", "resolved", "dismissed"] };
const severity = { type: "string", enum: ["note", "minor", "major", "blocking"] };
const jsonObject = { type: "object", additionalProperties: true, maxProperties: 100 };

export const creatorReviewListSchema = {
  params: paramsSchema({ worldId: uuid }),
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      status,
      targetType,
      limit: { type: "integer", minimum: 1, maximum: 200, default: 100 }
    }
  }
};

export const creatorReviewCreateSchema = {
  params: paramsSchema({ worldId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["targetType", "body"],
    properties: {
      targetType,
      targetId: uuid,
      targetLabel: { type: "string", maxLength: 300 },
      anchor: jsonObject,
      kind,
      severity,
      title: { type: "string", maxLength: 300 },
      body: { type: "string", minLength: 1, maxLength: 10000 },
      suggestedPatch: jsonObject
    },
    allOf: [
      {
        if: { properties: { targetType: { enum: ["world", "manuscript"] } }, required: ["targetType"] },
        then: { not: { required: ["targetId"] } },
        else: { required: ["targetId"] }
      }
    ]
  }
};

export const creatorReviewPatchSchema = {
  params: paramsSchema({ worldId: uuid, reviewId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      kind,
      status,
      severity,
      title: { type: "string", maxLength: 300 },
      body: { type: "string", minLength: 1, maxLength: 10000 },
      suggestedPatch: jsonObject
    }
  }
};

export const creatorReviewReplySchema = {
  params: paramsSchema({ worldId: uuid, reviewId: uuid }),
  body: {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: { body: { type: "string", minLength: 1, maxLength: 10000 } }
  }
};

export const creatorVersionCompareSchema = {
  params: paramsSchema({ worldId: uuid }),
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["baseVersionId"],
    properties: {
      baseVersionId: uuid,
      headVersionId: uuid
    }
  }
};
