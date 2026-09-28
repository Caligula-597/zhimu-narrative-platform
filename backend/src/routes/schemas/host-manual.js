// Host Manual Compiler — route schemas

import { paramsSchema, uuid } from "./primitives.js";

const worldIdParams = paramsSchema({ worldId: uuid });

const sectionIdParams = paramsSchema({ worldId: uuid, sectionId: uuid });

const versionParams = paramsSchema({ worldId: uuid, version: { type: "integer", minimum: 1, maximum: 10000 } });

export const listVersionsSchema = { params: worldIdParams };

export const getLatestSchema = { params: worldIdParams };

export const getVersionSchema = { params: versionParams };

export const compileSchema = { params: worldIdParams };

export const updateSectionSchema = {
  params: sectionIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string", maxLength: 300 },
      body: { type: "string", maxLength: 200000 }
    }
  }
};

export const addSectionSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 300 },
      sectionKey: { type: "string", maxLength: 120 },
      body: { type: "string", maxLength: 200000 }
    }
  }
};

export const deleteSectionSchema = { params: sectionIdParams };