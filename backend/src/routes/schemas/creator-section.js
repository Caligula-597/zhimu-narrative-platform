import { paramsSchema, uuid } from "./primitives.js";
import { roleSlotIdParams } from "./creator-role.js";

const optionalUuid = { anyOf: [uuid, { type: "null" }] };
const publicationStatus = { type: "string", enum: ["draft", "testing", "published"] };

export const sectionIdParams = paramsSchema({ worldId: uuid, roleSlotId: uuid, sectionId: uuid });

export const createSectionSchema = {
  params: roleSlotIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "body", "sequence"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200, pattern: "\\S" },
      body: { type: "string", minLength: 1, maxLength: 500_000, pattern: "\\S" },
      sequence: { type: "integer", minimum: 1, maximum: 9999 },
      chapterId: optionalUuid,
      publicationStatus
    }
  }
};

export const updateSectionSchema = {
  params: sectionIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "body"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200, pattern: "\\S" },
      body: { type: "string", minLength: 1, maxLength: 500_000, pattern: "\\S" },
      chapterId: optionalUuid,
      publicationStatus
    }
  }
};

export const deleteSectionSchema = { params: sectionIdParams };
