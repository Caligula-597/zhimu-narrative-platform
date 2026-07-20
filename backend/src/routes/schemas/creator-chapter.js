import { paramsSchema, uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const metadataObject = { type: "object", additionalProperties: true };
const publicationStatus = { type: "string", enum: ["draft", "testing", "published"] };

export const chapterIdParams = paramsSchema({ worldId: uuid, chapterId: uuid });

export const createChapterSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title", "sequence"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 200, pattern: "\\S" },
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
      title: { type: "string", minLength: 1, maxLength: 200, pattern: "\\S" },
      summary: { type: "string", maxLength: 4000 },
      publicationStatus,
      unlockRules: metadataObject,
      metadata: metadataObject
    }
  }
};
