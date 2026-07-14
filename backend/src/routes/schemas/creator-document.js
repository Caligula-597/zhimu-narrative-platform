import { uuid } from "./primitives.js";
import { worldIdParams } from "./world.js";

const optionalUuid = { anyOf: [uuid, { type: "null" }] };
const publicationStatus = { type: "string", enum: ["draft", "testing", "published"] };

export const parseDocumentSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["filename"],
    properties: {
      filename: { type: "string", minLength: 1, maxLength: 255 },
      contentType: { type: "string", minLength: 3, maxLength: 120 },
      dataBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
      contentBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
      parseMode: { type: "string", enum: ["auto", "pages", "text"] },
      allowOcr: { type: "boolean" }
    },
    anyOf: [{ required: ["dataBase64"] }, { required: ["contentBase64"] }]
  }
};

export const importDocumentPagesSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["filename", "roleSlotId"],
    properties: {
      filename: { type: "string", minLength: 1, maxLength: 255 },
      contentType: { type: "string", minLength: 3, maxLength: 120 },
      dataBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
      contentBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
      roleSlotId: uuid,
      title: { type: "string", maxLength: 200 },
      layout: { type: "string", enum: ["single_section", "one_section_per_page"] },
      publicationStatus,
      parseMode: { type: "string", enum: ["auto", "pages", "text"] },
      allowOcr: { type: "boolean" }
    },
    anyOf: [{ required: ["dataBase64"] }, { required: ["contentBase64"] }]
  }
};

export const importDocumentSchema = {
  params: worldIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["target", "document"],
    properties: {
      target: { type: "string", enum: ["manuscript", "role_script"] },
      roleSlotId: optionalUuid,
      document: {
        type: "object",
        additionalProperties: false,
        required: ["text", "sections"],
        properties: {
          text: { type: "string", maxLength: 2_000_000 },
          filename: { type: "string", maxLength: 255 },
          sections: {
            type: "array",
            maxItems: 500,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "body"],
              properties: {
                title: { type: "string", minLength: 1, maxLength: 200 },
                body: { type: "string", maxLength: 200_000 }
              }
            }
          }
        }
      }
    }
  }
};
