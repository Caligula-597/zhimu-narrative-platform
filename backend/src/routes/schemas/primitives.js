export const uuid = {
  type: "string",
  minLength: 36,
  maxLength: 36,
  pattern: "^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$"
};
export const nonEmptyText = { type: "string", minLength: 1, maxLength: 1000 };

export function paramsSchema(properties) {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties
  };
}
