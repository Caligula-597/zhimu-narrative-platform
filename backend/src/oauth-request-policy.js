export const oauthStartQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    returnOrigin: { type: "string", minLength: 8, maxLength: 200 }
  }
};

export const oauthCallbackQuerySchema = {
  type: "object",
  // Providers occasionally add harmless diagnostic fields. Preserve
  // compatibility, but never accept an unbounded query value.
  additionalProperties: { type: "string", maxLength: 1000 },
  properties: {
    code: { type: "string", minLength: 1, maxLength: 4096 },
    state: { type: "string", minLength: 16, maxLength: 128, pattern: "^[A-Za-z0-9_-]+$" },
    error: { type: "string", minLength: 1, maxLength: 80 },
    error_description: { type: "string", maxLength: 500 },
    error_uri: { type: "string", maxLength: 500 },
    scope: { type: "string", maxLength: 1000 },
    authuser: { type: "string", maxLength: 40 },
    prompt: { type: "string", maxLength: 40 },
    iss: { type: "string", maxLength: 200 },
    hd: { type: "string", maxLength: 255 }
  }
};

export function oauthProviderErrorCode(value) {
  return String(value || "").trim() ? "OAUTH_EXCHANGE_FAILED" : "";
}
