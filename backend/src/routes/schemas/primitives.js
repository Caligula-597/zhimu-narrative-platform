export const uuid = { type: "string", minLength: 36, maxLength: 36 };
export const nonEmptyText = { type: "string", minLength: 1, maxLength: 1000 };

export function paramsSchema(properties) {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties
  };
}
