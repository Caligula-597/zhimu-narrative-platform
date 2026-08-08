import assert from "node:assert/strict";
import test from "node:test";
import {
  canEncryptSecrets,
  decryptSecret,
  encryptSecret
} from "../src/secret-crypto.js";
import {
  llmProbeFailureMessage,
  llmRequestFailureMessage
} from "../src/llm-upstream-error-policy.js";

function restoreEnvironment(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("production BYOK encryption never reuses the operations token", () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    LLM_CREDENTIALS_SECRET: process.env.LLM_CREDENTIALS_SECRET,
    OPS_API_TOKEN: process.env.OPS_API_TOKEN
  };
  try {
    process.env.NODE_ENV = "production";
    delete process.env.LLM_CREDENTIALS_SECRET;
    process.env.OPS_API_TOKEN = "operations-token-that-must-not-encrypt-user-secrets";
    assert.equal(canEncryptSecrets(), false);
    assert.throws(() => encryptSecret("sk-private"), (error) => (
      error.code === "LLM_CREDENTIALS_NOT_CONFIGURED"
    ));

    process.env.LLM_CREDENTIALS_SECRET = "dedicated-llm-credential-secret-32-characters-minimum";
    assert.equal(canEncryptSecrets(), true);
    const encrypted = encryptSecret("sk-private");
    assert.notEqual(encrypted.includes("sk-private"), true);
    assert.equal(decryptSecret(encrypted), "sk-private");
  } finally {
    restoreEnvironment(previous);
  }
});

test("provider-controlled error text is never reflected into public LLM errors", () => {
  const attackerText = "invalid key sk-secret-value from provider";
  for (const message of [llmProbeFailureMessage(401), llmRequestFailureMessage(502)]) {
    assert.equal(message.includes(attackerText), false);
    assert.equal(message.includes("sk-secret-value"), false);
  }
  assert.match(llmProbeFailureMessage(401), /HTTP 401/u);
  assert.match(llmRequestFailureMessage(502), /HTTP 502/u);
  assert.doesNotMatch(llmRequestFailureMessage(attackerText), /secret-value/u);
});
