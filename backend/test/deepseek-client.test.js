import assert from "node:assert/strict";
import test from "node:test";
import { buildChatCompletionBody } from "../src/deepseek-client.js";
import { deepseekConfig } from "../src/deepseek-config.js";

test("deepseek request body disables thinking for JSON contracts", () => {
  const body = buildChatCompletionBody(
    { provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash" },
    { messages: [{ role: "user", content: "hello" }], maxTokens: 1200, temperature: 0.2 }
  );
  assert.deepEqual(body.thinking, { type: "disabled" });
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(body.max_tokens, 1200);
});

test("non-deepseek compatible provider does not receive vendor thinking field", () => {
  const body = buildChatCompletionBody(
    { provider: "openai-compatible", baseUrl: "https://llm.example.com", model: "model-a" },
    { messages: [], maxTokens: 800, temperature: 0.5 }
  );
  assert.equal("thinking" in body, false);
});

test("deepseek config clamps timeout and strips trailing slash", () => {
  const previous = {
    key: process.env.DEEPSEEK_API_KEY,
    base: process.env.DEEPSEEK_BASE_URL,
    timeout: process.env.DEEPSEEK_TIMEOUT_MS
  };
  process.env.DEEPSEEK_API_KEY = "test-key";
  process.env.DEEPSEEK_BASE_URL = "https://gateway.example.com/";
  process.env.DEEPSEEK_TIMEOUT_MS = "999999";
  try {
    const config = deepseekConfig();
    assert.equal(config.configured, true);
    assert.equal(config.baseUrl, "https://gateway.example.com");
    assert.equal(config.timeoutMs, 240000);
  } finally {
    if (previous.key === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previous.key;
    if (previous.base === undefined) delete process.env.DEEPSEEK_BASE_URL;
    else process.env.DEEPSEEK_BASE_URL = previous.base;
    if (previous.timeout === undefined) delete process.env.DEEPSEEK_TIMEOUT_MS;
    else process.env.DEEPSEEK_TIMEOUT_MS = previous.timeout;
  }
});
