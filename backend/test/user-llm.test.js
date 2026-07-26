import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../src/db.js";
import {
  buildLlmAccountPayload,
  createUserLlmConnection,
  fetchUserLlmPreferences,
  LLM_PROVIDER_PRESETS,
  listUserLlmConnections,
  resolveLlmRuntime,
  upsertUserLlmPreferences
} from "../src/user-llm.js";
import { bindLlmRuntime, platformLlmRuntime, runWithLlmRuntime } from "../src/llm-runtime.js";

async function createTestUser() {
  const email = `llm-${Date.now()}-${Math.random().toString(36).slice(2)}@zhimu.local`;
  const row = await query(
    `INSERT INTO users (email, display_name, password_hash, password_salt, email_verified_at)
     VALUES ($1, 'LLM Test', 'x', 'y', now()) RETURNING id`,
    [email]
  );
  return row.rows[0].id;
}

async function cleanupUser(userId) {
  await query(`DELETE FROM user_llm_connections WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM user_llm_preferences WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM users WHERE id = $1`, [userId]);
}

test("createUserLlmConnection stores encrypted connection and resolves BYOK runtime", async (context) => {
  process.env.LLM_CREDENTIALS_SECRET = process.env.LLM_CREDENTIALS_SECRET || "test-llm-secret-key";
  const userId = await createTestUser();
  context.after(async () => cleanupUser(userId));

  const connection = await createUserLlmConnection(userId, {
    name: "测试 DeepSeek",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    apiKey: "sk-test-key-12345678"
  });
  assert.equal(connection.isActive, true);
  assert.match(connection.apiKeyHint, /5678$/);

  const runtime = await resolveLlmRuntime(userId);
  assert.equal(runtime.source, "user");
  assert.equal(runtime.model, "deepseek-v4-flash");
  assert.equal(runtime.apiKey, "sk-test-key-12345678");
  assert.equal(runtime.billPlatform, false);
});

test("upsertUserLlmPreferences own_only requires user connection", async (context) => {
  process.env.LLM_CREDENTIALS_SECRET = process.env.LLM_CREDENTIALS_SECRET || "test-llm-secret-key";
  const userId = await createTestUser();
  context.after(async () => cleanupUser(userId));

  await upsertUserLlmPreferences(userId, { routingMode: "own_only" });
  const prefs = await fetchUserLlmPreferences(userId);
  assert.equal(prefs.routingMode, "own_only");

  await assert.rejects(() => resolveLlmRuntime(userId), (error) => error.code === "LLM_USER_NOT_CONFIGURED");
});

test("platform key is excluded from the user pool unless explicitly enabled", async (context) => {
  const previousPlatformAccess = process.env.PLATFORM_LLM_USER_ACCESS;
  const previousPlatformKey = process.env.DEEPSEEK_API_KEY;
  process.env.PLATFORM_LLM_USER_ACCESS = "false";
  process.env.DEEPSEEK_API_KEY = "sk-platform-must-not-be-used";
  const userId = await createTestUser();
  context.after(async () => {
    await cleanupUser(userId);
    if (previousPlatformAccess === undefined) delete process.env.PLATFORM_LLM_USER_ACCESS;
    else process.env.PLATFORM_LLM_USER_ACCESS = previousPlatformAccess;
    if (previousPlatformKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousPlatformKey;
  });

  const prefs = await fetchUserLlmPreferences(userId);
  assert.equal(prefs.routingMode, "own_only");
  await assert.rejects(
    () => upsertUserLlmPreferences(userId, { routingMode: "platform_only" }),
    (error) => error.code === "LLM_PLATFORM_DISABLED"
  );
  await assert.rejects(
    () => resolveLlmRuntime(userId),
    (error) => error.code === "LLM_USER_NOT_CONFIGURED"
  );

  const payload = await buildLlmAccountPayload(userId);
  assert.equal(payload.platform.available, false);
  assert.equal(payload.platform.model, null);
});

test("provider presets expose supported OpenAI-compatible endpoints and model choices", () => {
  assert.deepEqual(Object.keys(LLM_PROVIDER_PRESETS), [
    "deepseek",
    "openai",
    "openrouter",
    "qwen",
    "zhipu",
    "siliconflow",
    "openai_compatible"
  ]);
  for (const [provider, preset] of Object.entries(LLM_PROVIDER_PRESETS)) {
    assert.match(preset.baseUrl, /^https:\/\//, provider);
    assert.ok(Array.isArray(preset.models), provider);
  }
  assert.equal(LLM_PROVIDER_PRESETS.qwen.defaultModel, "qwen-plus");
  assert.equal(LLM_PROVIDER_PRESETS.zhipu.defaultModel, "glm-5.2");
});

test("system jobs retain the platform runtime while user pool access is disabled", () => {
  const previousPlatformAccess = process.env.PLATFORM_LLM_USER_ACCESS;
  const previousPlatformKey = process.env.DEEPSEEK_API_KEY;
  process.env.PLATFORM_LLM_USER_ACCESS = "false";
  process.env.DEEPSEEK_API_KEY = "sk-system-job-only";
  try {
    const runtime = platformLlmRuntime();
    assert.equal(runtime.configured, true);
    assert.equal(runtime.source, "platform");
    assert.equal(runtime.apiKey, "sk-system-job-only");
  } finally {
    if (previousPlatformAccess === undefined) delete process.env.PLATFORM_LLM_USER_ACCESS;
    else process.env.PLATFORM_LLM_USER_ACCESS = previousPlatformAccess;
    if (previousPlatformKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousPlatformKey;
  }
});

test("named OpenAI-compatible providers can be saved and selected", async (context) => {
  process.env.LLM_CREDENTIALS_SECRET = process.env.LLM_CREDENTIALS_SECRET || "test-llm-secret-key";
  const userId = await createTestUser();
  context.after(async () => cleanupUser(userId));

  const connection = await createUserLlmConnection(userId, {
    name: "我的千问",
    provider: "qwen",
    baseUrl: LLM_PROVIDER_PRESETS.qwen.baseUrl,
    model: LLM_PROVIDER_PRESETS.qwen.defaultModel,
    apiKey: "sk-qwen-test-key"
  });
  assert.equal(connection.provider, "qwen");
  const runtime = await resolveLlmRuntime(userId);
  assert.equal(runtime.source, "user");
  assert.equal(runtime.provider, "qwen");
  assert.equal(runtime.baseUrl, LLM_PROVIDER_PRESETS.qwen.baseUrl);
  assert.equal(runtime.billPlatform, false);
});

test("listUserLlmConnections returns sanitized rows without ciphertext", async (context) => {
  process.env.LLM_CREDENTIALS_SECRET = process.env.LLM_CREDENTIALS_SECRET || "test-llm-secret-key";
  const userId = await createTestUser();
  context.after(async () => cleanupUser(userId));

  await createUserLlmConnection(userId, {
    name: "A",
    provider: "openai_compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKey: "sk-openai-test-key"
  });
  const rows = await listUserLlmConnections(userId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "A");
  assert.ok(!("api_key_ciphertext" in rows[0]));
});

test("runWithLlmRuntime binds per-request runtime for deepseek layer", async () => {
  const runtime = {
    configured: true,
    source: "user",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    apiKey: "sk-bound",
    timeoutMs: 1000,
    billPlatform: false
  };
  await runWithLlmRuntime(runtime, async () => {
    const { getLlmRuntime } = await import("../src/llm-runtime.js");
    assert.equal(getLlmRuntime().apiKey, "sk-bound");
  });
  bindLlmRuntime(runtime);
  const { getLlmRuntime } = await import("../src/llm-runtime.js");
  assert.equal(getLlmRuntime().apiKey, "sk-bound");
});
