export const opsAuditLogQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    roomId: { type: "string", format: "uuid" },
    action: { type: "string", minLength: 1, maxLength: 80 },
    limit: { type: "integer", minimum: 1, maximum: 200 },
    offset: { type: "integer", minimum: 0, maximum: 100_000 }
  }
};
