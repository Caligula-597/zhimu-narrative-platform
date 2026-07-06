import assert from "node:assert/strict";
import test from "node:test";
import { query } from "../src/db.js";
import {
  createUserLlmConnection,
  fetchUserLlmPreferences,
  listUserLlmConnections,
  resolveLlmRuntime,
  upsertUserLlmPreferences
} from "../src/user-llm.js";
import { bindLlmRuntime, runWithLlmRuntime } from "../src/llm-runtime.js";

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

test("createUserLlmConnection stores encrypted connection and resolves prefer_own runtime", async (context) => {
  process.env.LLM_CREDENTIALS_SECRET = process.env.LLM_CREDENTIALS_SECRET || "test-llm-secret-key";
  const userId = await createTestUser();
  context.after(async () => cleanupUser(userId));

  const connection = await createUserLlmConnection(userId, {
    name: "测试 DeepSeek",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    apiKey: "sk-test-key-12345678"
  });
  assert.equal(connection.isActive, true);
  assert.match(connection.apiKeyHint, /5678$/);

  const runtime = await resolveLlmRuntime(userId);
  assert.equal(runtime.source, "user");
  assert.equal(runtime.model, "deepseek-chat");
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
    model: "deepseek-chat",
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
