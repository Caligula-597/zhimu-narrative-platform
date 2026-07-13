import { throwErr } from "./api-errors.js";
import { chargeAiCredits, isCreditsDebitAiEnabled, isCreditsSystemEnabled } from "./credits.js";
import { deepseekConfig } from "./deepseek-config.js";
import { getLlmRuntime } from "./llm-runtime.js";

function throwNotConfigured(runtime) {
  if (runtime.source === "user") throwErr("LLM_USER_NOT_CONFIGURED");
  if (runtime.source === "platform") throwErr("DEEPSEEK_NOT_CONFIGURED");
  throwErr("LLM_NOT_AVAILABLE");
}

export function buildChatCompletionBody(runtime, { messages, maxTokens, temperature }) {
  const body = {
    model: runtime.model,
    messages,
    response_format: { type: "json_object" },
    temperature,
    max_tokens: maxTokens
  };
  if (runtime.provider === "deepseek" || String(runtime.baseUrl).includes("deepseek")) {
    body.thinking = { type: "disabled" };
  }
  return body;
}

export async function requestDeepseekJson(messages, {
  maxTokens = 8000,
  temperature = 0.5,
  timeoutMs,
  phase,
  context = {},
  retryOnJsonParse = true,
  idempotencyKey = null
} = {}) {
  const runtime = getLlmRuntime();
  if (!runtime.configured || !runtime.apiKey) throwNotConfigured(runtime);
  const callTimeoutMs = timeoutMs ?? runtime.timeoutMs ?? deepseekConfig().timeoutMs;
  const attempts = retryOnJsonParse ? 2 : 1;
  let lastSyntaxError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), callTimeoutMs);
    try {
      const response = await fetch(`${runtime.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${runtime.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(buildChatCompletionBody(runtime, { messages, maxTokens, temperature })),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const status = response.status;
        const upstreamMsg = payload.error?.message || `HTTP ${status}`;
        if (status === 429) {
          throwErr("RATE_LIMITED", `AI 服务请求过于频繁，请稍后再试。（${upstreamMsg}）`, { phase, attempt, ...context });
        }
        throwErr("DEEPSEEK_API_ERROR", `AI 服务请求失败：${upstreamMsg}`, {
          phase, attempt, status, source: runtime.source, ...context
        });
      }
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throwErr("DEEPSEEK_RESPONSE_INVALID", "AI 返回了空内容，请重试。", { phase, attempt, ...context });
      }
      if (runtime.billPlatform && runtime.userId && isCreditsSystemEnabled() && isCreditsDebitAiEnabled()) {
        await chargeAiCredits(runtime.userId, {
          refType: "ai",
          refId: phase || null,
          idempotencyKey: idempotencyKey || (phase ? `ai:${runtime.userId}:${phase}:${attempt}` : null)
        });
      }
      return { model: runtime.model, provider: runtime.source, value: JSON.parse(content) };
    } catch (error) {
      if (error.name === "AbortError") {
        throwErr("GATEWAY_TIMEOUT", `AI 请求超时（已等待 ${Math.round(callTimeoutMs / 1000)} 秒），请稍后重试。`, {
          phase, attempt, timeoutMs: callTimeoutMs, ...context
        });
      }
      if (error instanceof SyntaxError) {
        lastSyntaxError = error;
        if (attempt < attempts) continue;
        throwErr("DEEPSEEK_RESPONSE_INVALID", "AI 返回了无法解析的 JSON，请重试。", { phase, attempt, ...context });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throwErr("DEEPSEEK_RESPONSE_INVALID", "AI 返回了无法解析的 JSON，请重试。", {
    phase, attempt: attempts, ...context, cause: lastSyntaxError?.message
  });
}
