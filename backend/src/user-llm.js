/**
 * User LLM connections (BYOK) + routing preferences + runtime resolution.
 */
import { query, transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import { fetchUserKind } from "./capabilities.js";
import { isUserEmailVerified, isEmailVerificationRequired } from "./email-verification-policy.js";
import { assertAiCredits, isCreditsSystemEnabled } from "./credits.js";
import { deepseekConfig } from "./deepseek.js";
import { platformLlmRuntime, bindLlmRuntime } from "./llm-runtime.js";
import { canEncryptSecrets, decryptSecret, encryptSecret, maskApiKeyHint } from "./secret-crypto.js";

export const LLM_PROVIDER_PRESETS = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat"
  },
  openai_compatible: {
    label: "OpenAI 兼容",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini"
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini"
  }
};

function normalizeBaseUrl(url) {
  const trimmed = String(url || "").trim().replace(/\/$/, "");
  if (!trimmed) throwErr("VALIDATION_ERROR", "baseUrl is required");
  if (!/^https:\/\//i.test(trimmed)) throwErr("VALIDATION_ERROR", "baseUrl must use HTTPS");
  return trimmed;
}

function normalizeModel(model) {
  const text = String(model || "").trim();
  if (!text || text.length > 120) throwErr("VALIDATION_ERROR", "model is required");
  return text;
}

function normalizeProvider(provider) {
  const value = String(provider || "openai_compatible").trim();
  if (!LLM_PROVIDER_PRESETS[value]) throwErr("VALIDATION_ERROR", "Invalid LLM provider");
  return value;
}

export function serializeConnection(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    baseUrl: row.base_url,
    model: row.model,
    apiKeyHint: row.api_key_hint,
    isActive: Boolean(row.is_active),
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function fetchUserLlmPreferences(userId) {
  const result = await query(
    `SELECT routing_mode, updated_at FROM user_llm_preferences WHERE user_id = $1`,
    [userId]
  );
  return {
    routingMode: result.rows[0]?.routing_mode ?? "prefer_own",
    updatedAt: result.rows[0]?.updated_at ?? null
  };
}

export async function upsertUserLlmPreferences(userId, { routingMode }) {
  const mode = String(routingMode || "prefer_own");
  if (!["prefer_own", "own_only", "platform_only"].includes(mode)) {
    throwErr("VALIDATION_ERROR", "Invalid routing mode");
  }
  await query(
    `INSERT INTO user_llm_preferences (user_id, routing_mode, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET routing_mode = EXCLUDED.routing_mode, updated_at = now()`,
    [userId, mode]
  );
  return fetchUserLlmPreferences(userId);
}

export async function listUserLlmConnections(userId) {
  const result = await query(
    `SELECT id, user_id, name, provider, base_url, model, api_key_hint, is_active, enabled, created_at, updated_at
     FROM user_llm_connections
     WHERE user_id = $1
     ORDER BY is_active DESC, updated_at DESC`,
    [userId]
  );
  return result.rows.map(serializeConnection);
}

async function fetchConnectionRow(userId, connectionId) {
  const result = await query(
    `SELECT * FROM user_llm_connections WHERE id = $1 AND user_id = $2`,
    [connectionId, userId]
  );
  return result.rows[0] ?? null;
}

async function fetchActiveConnectionRow(userId) {
  const result = await query(
    `SELECT * FROM user_llm_connections
     WHERE user_id = $1 AND enabled = true AND is_active = true
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function createUserLlmConnection(userId, input) {
  if (!canEncryptSecrets()) throwErr("LLM_CREDENTIALS_NOT_CONFIGURED");
  const kind = await fetchUserKind(userId);
  if (kind === "guest") throwErr("GUEST_ACCOUNT_RESTRICTED", "游客账号请先注册后再配置 API");

  const provider = normalizeProvider(input.provider);
  const preset = LLM_PROVIDER_PRESETS[provider];
  const name = String(input.name || "默认连接").trim().slice(0, 80) || "默认连接";
  const baseUrl = normalizeBaseUrl(input.baseUrl || preset.baseUrl);
  const model = normalizeModel(input.model || preset.defaultModel);
  const apiKey = String(input.apiKey || "").trim();
  if (apiKey.length < 8) throwErr("VALIDATION_ERROR", "API Key 过短");

  const ciphertext = encryptSecret(apiKey);
  const hint = maskApiKeyHint(apiKey);
  const makeActive = input.isActive !== false;

  return transaction(async (client) => {
    if (makeActive) {
      await client.query(`UPDATE user_llm_connections SET is_active = false, updated_at = now() WHERE user_id = $1`, [userId]);
    }
    const count = await client.query(`SELECT count(*)::int AS n FROM user_llm_connections WHERE user_id = $1`, [userId]);
    const isActive = makeActive || Number(count.rows[0]?.n ?? 0) === 0;
    const inserted = await client.query(
      `INSERT INTO user_llm_connections
         (user_id, name, provider, base_url, model, api_key_ciphertext, api_key_hint, is_active, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING id, user_id, name, provider, base_url, model, api_key_hint, is_active, enabled, created_at, updated_at`,
      [userId, name, provider, baseUrl, model, ciphertext, hint, isActive]
    );
    return serializeConnection(inserted.rows[0]);
  });
}

export async function updateUserLlmConnection(userId, connectionId, input) {
  const existing = await fetchConnectionRow(userId, connectionId);
  if (!existing) throwErr("NOT_FOUND", "LLM connection not found");

  const provider = input.provider !== undefined ? normalizeProvider(input.provider) : existing.provider;
  const preset = LLM_PROVIDER_PRESETS[provider];
  const name = input.name !== undefined ? String(input.name || "").trim().slice(0, 80) : existing.name;
  if (!name) throwErr("VALIDATION_ERROR", "name is required");
  const baseUrl = input.baseUrl !== undefined ? normalizeBaseUrl(input.baseUrl) : existing.base_url;
  const model = input.model !== undefined ? normalizeModel(input.model) : existing.model;
  const enabled = input.enabled !== undefined ? Boolean(input.enabled) : existing.enabled;

  let ciphertext = existing.api_key_ciphertext;
  let hint = existing.api_key_hint;
  if (input.apiKey !== undefined && String(input.apiKey).trim()) {
    if (!canEncryptSecrets()) throwErr("LLM_CREDENTIALS_NOT_CONFIGURED");
    const apiKey = String(input.apiKey).trim();
    if (apiKey.length < 8) throwErr("VALIDATION_ERROR", "API Key 过短");
    ciphertext = encryptSecret(apiKey);
    hint = maskApiKeyHint(apiKey);
  }

  const updated = await query(
    `UPDATE user_llm_connections
     SET name = $3, provider = $4, base_url = $5, model = $6,
         api_key_ciphertext = $7, api_key_hint = $8, enabled = $9, updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, name, provider, base_url, model, api_key_hint, is_active, enabled, created_at, updated_at`,
    [connectionId, userId, name, provider, baseUrl, model, ciphertext, hint, enabled]
  );
  return serializeConnection(updated.rows[0]);
}

export async function deleteUserLlmConnection(userId, connectionId) {
  const existing = await fetchConnectionRow(userId, connectionId);
  if (!existing) throwErr("NOT_FOUND", "LLM connection not found");
  await query(`DELETE FROM user_llm_connections WHERE id = $1 AND user_id = $2`, [connectionId, userId]);
  if (existing.is_active) {
    const next = await query(
      `SELECT id FROM user_llm_connections WHERE user_id = $1 AND enabled = true ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );
    if (next.rowCount) {
      await query(`UPDATE user_llm_connections SET is_active = true, updated_at = now() WHERE id = $1`, [next.rows[0].id]);
    }
  }
  return { deleted: true };
}

export async function activateUserLlmConnection(userId, connectionId) {
  const existing = await fetchConnectionRow(userId, connectionId);
  if (!existing) throwErr("NOT_FOUND", "LLM connection not found");
  return transaction(async (client) => {
    await client.query(`UPDATE user_llm_connections SET is_active = false, updated_at = now() WHERE user_id = $1`, [userId]);
    const updated = await client.query(
      `UPDATE user_llm_connections SET is_active = true, enabled = true, updated_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, name, provider, base_url, model, api_key_hint, is_active, enabled, created_at, updated_at`,
      [connectionId, userId]
    );
    return serializeConnection(updated.rows[0]);
  });
}

function runtimeFromConnection(userId, row) {
  return {
    configured: true,
    source: "user",
    provider: row.provider,
    baseUrl: row.base_url.replace(/\/$/, ""),
    model: row.model,
    apiKey: decryptSecret(row.api_key_ciphertext),
    timeoutMs: deepseekConfig().timeoutMs,
    billPlatform: false,
    connectionId: row.id,
    connectionName: row.name,
    userId
  };
}

async function assertPlatformPoolAccess(userId) {
  if (isEmailVerificationRequired()) {
    const verified = await isUserEmailVerified(userId);
    if (!verified) {
      throwErr("EMAIL_NOT_VERIFIED", "使用平台 AI 额度需要先验证邮箱，或配置您自己的 API Key");
    }
  }
  await assertAiCredits(userId);
}

export async function resolveLlmRuntime(userId) {
  const platform = platformLlmRuntime();
  platform.userId = userId;
  if (!userId) return { ...platform, configured: platform.configured, source: platform.configured ? "platform" : "none" };

  const [prefs, active] = await Promise.all([
    fetchUserLlmPreferences(userId),
    fetchActiveConnectionRow(userId)
  ]);

  const ownReady = Boolean(active?.enabled && active?.api_key_ciphertext);
  const platformReady = platform.configured;

  if (prefs.routingMode === "platform_only") {
    if (!platformReady) throwErr("DEEPSEEK_NOT_CONFIGURED", "平台 AI 未配置，请联系 support 或改用自备 API");
    await assertPlatformPoolAccess(userId);
    return { ...platform, source: "platform", billPlatform: true, userId };
  }

  if (prefs.routingMode === "own_only") {
    if (!ownReady) throwErr("LLM_USER_NOT_CONFIGURED", "请先在账号设置中配置 AI API 连接");
    return runtimeFromConnection(userId, active);
  }

  // prefer_own
  if (ownReady) return runtimeFromConnection(userId, active);
  if (platformReady) {
    await assertPlatformPoolAccess(userId);
    return { ...platform, source: "platform", billPlatform: true, userId };
  }
  throwErr("LLM_NOT_AVAILABLE", "请配置自备 API，或等待平台 AI 额度开放");
}

export async function bindUserLlmContext(userId) {
  const runtime = await resolveLlmRuntime(userId);
  bindLlmRuntime(runtime);
  return runtime;
}

export async function testUserLlmConnection(userId, connectionId) {
  const row = await fetchConnectionRow(userId, connectionId);
  if (!row) throwErr("NOT_FOUND", "LLM connection not found");
  const runtime = runtimeFromConnection(userId, row);
  const { probeLlmConnection } = await import("./llm-probe.js");
  return probeLlmConnection(runtime);
}

export async function buildLlmAccountPayload(userId) {
  const [connections, preferences, platform] = await Promise.all([
    listUserLlmConnections(userId),
    fetchUserLlmPreferences(userId),
    Promise.resolve(deepseekConfig())
  ]);
  const active = connections.find((c) => c.isActive && c.enabled) ?? null;
  return {
    encryptionReady: canEncryptSecrets(),
    presets: LLM_PROVIDER_PRESETS,
    preferences,
    connections,
    activeConnectionId: active?.id ?? null,
    platform: {
      available: platform.configured && isCreditsSystemEnabled(),
      model: platform.model,
      note: "未配置自备 API 时，将消耗织幕积分使用平台额度（首月体验不扣费）"
    }
  };
}
