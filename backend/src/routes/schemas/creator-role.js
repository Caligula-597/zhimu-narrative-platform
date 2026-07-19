import { paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const metadataObject = { type: "object", additionalProperties: true };
const optionalUuid = { anyOf: [uuid, { type: "null" }] };
const publicationStatus = { type: "string", enum: ["draft", "testing", "published"] };

export const roleSlotIdParams = paramsSchema({ worldId: uuid, roleSlotId: uuid });
export const chapterIdParams = paramsSchema({ worldId: uuid, chapterId: uuid });
export const sectionIdParams = paramsSchema({ worldId: uuid, roleSlotId: uuid, sectionId: uuid });

export const createRoleSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "sequence"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
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
      name: { type: "string", minLength: 1, maxLength: 120 },
      publicProfile: { type: "string", maxLength: 4000 },
      privateProfile: { type: "string", maxLength: 20_000 },
      sequence: { type: "integer", minimum: 1, maximum: 9999 }
    }
  }
};

export const deleteRoleSchema = { params: roleSlotIdParams };

export const createChapterSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "sequence"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      summary: { type: "string", maxLength: 4000 },
      sequence: { type: "integer", minimum: 1, maximum: 9999 }
    }
  }
};

export const updateChapterSchema = {
  params: chapterIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      summary: { type: "string", maxLength: 4000 },
      publicationStatus,
      unlockRules: metadataObject,
      metadata: metadataObject
    }
  }
};

export const createSectionSchema = {
  params: roleSlotIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "body", "sequence"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200 },
      body: { type: "string", minLength: 1, maxLength: 500_000 },
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
      title: { type: "string", minLength: 1, maxLength: 200 },
      body: { type: "string", minLength: 1, maxLength: 500_000 },
      chapterId: optionalUuid,
      publicationStatus
    }
  }
};

export const deleteSectionSchema = { params: sectionIdParams };
