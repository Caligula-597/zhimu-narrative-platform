import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChatCompletionBody,
  readDeepseekSseCompletion
} from "../src/deepseek-client.js";
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

test("streaming JSON requests include SSE usage and isolated user id", () => {
  const body = buildChatCompletionBody(
    { provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash" },
    {
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 1200,
      temperature: 0.2,
      stream: true,
      userId: "outline-01"
    }
  );
  assert.equal(body.stream, true);
  assert.deepEqual(body.stream_options, { include_usage: true });
  assert.equal(body.user_id, "outline-01");
});

test("DeepSeek SSE reader ignores keep-alives and joins streamed JSON deltas", async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": keep-alive\n\n"));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"{\\"ok\\""},"finish_reason":null}],"usage":null}\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":":true}"},"finish_reason":"stop"}],"usage":null}\n'));
      controller.enqueue(encoder.encode('data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":4,"total_tokens":14}}\n'));
      controller.enqueue(encoder.encode("data: [DONE]\n"));
      controller.close();
    }
  });
  const response = new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" }
  });
  const deltas = [];
  const result = await readDeepseekSseCompletion(response, {
    maxResponseBytes: 64 * 1024,
    onStreamDelta: async ({ delta }) => deltas.push(delta)
  });
  assert.equal(result.content, '{"ok":true}');
  assert.equal(result.finishReason, "stop");
  assert.deepEqual(result.usage, {
    promptTokens: 10,
    completionTokens: 4,
    totalTokens: 14
  });
  assert.deepEqual(deltas, ['{"ok"', ":true}"]);
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
