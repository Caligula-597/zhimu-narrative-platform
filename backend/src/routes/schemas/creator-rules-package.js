export const contentPackageEnvelopeSchema = {
  body: {
    type: "object",
    additionalProperties: true,
    required: ["format", "version", "data"],
    properties: {
      format: { type: "string", minLength: 1, maxLength: 80 },
      version: { type: "integer", minimum: 1, maximum: 99 },
      data: { type: "object", additionalProperties: true }
    }
  }
};

export const createWorldFromPackageSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      summary: { type: "string", maxLength: 4000 },
      data: { type: "object", additionalProperties: true },
      format: { type: "string", maxLength: 80 },
      version: { type: "integer", minimum: 1, maximum: 99 }
    }
  }
};
