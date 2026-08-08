import assert from "node:assert/strict";
import test from "node:test";
import {
  oauthCallbackQuerySchema,
  oauthProviderErrorCode,
  oauthStartQuerySchema
} from "../src/oauth-request-policy.js";

test("OAuth provider errors are not reflected back to browser URLs", () => {
  assert.equal(oauthProviderErrorCode("access_denied"), "OAUTH_EXCHANGE_FAILED");
  assert.equal(oauthProviderErrorCode("<script>alert(1)</script>"), "OAUTH_EXCHANGE_FAILED");
  assert.equal(oauthProviderErrorCode(""), "");
});

test("OAuth callback and return-origin inputs have explicit bounds", () => {
  assert.equal(oauthStartQuerySchema.additionalProperties, false);
  assert.equal(oauthStartQuerySchema.properties.returnOrigin.maxLength, 200);
  assert.equal(oauthCallbackQuerySchema.properties.code.maxLength, 4096);
  assert.equal(oauthCallbackQuerySchema.properties.state.maxLength, 128);
  assert.equal(oauthCallbackQuerySchema.properties.error.maxLength, 80);
  assert.equal(oauthCallbackQuerySchema.additionalProperties.maxLength, 1000);
});
