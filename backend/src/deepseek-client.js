import { throwErr } from "./api-errors.js";
import { chargeAiCredits, isCreditsDebitAiEnabled, isCreditsSystemEnabled } from "./credits.js";
import { deepseekConfig } from "./deepseek-config.js";
import { getLlmRuntime } from "./llm-runtime.js";
import { clampInteger } from "./prompts/shared.js";
import {
  fetchPinnedOutboundJson,
  withPinnedOutboundResponse
} from "./pinned-outbound-fetch.js";
import { llmRequestFailureMessage } from "./llm-upstream-error-policy.js";

function throwNotConfigured(runtime) {
  if (runtime.source === "user") throwErr("LLM_USER_NOT_CONFIGURED");
  if (runtime.source === "platform") throwErr("DEEPSEEK_NOT_CONFIGURED");
  throwErr("LLM_NOT_AVAILABLE");
}

export function buildChatCompletionBody(runtime, {
  messages,
  maxTokens,
  temperature,
  stream = false,
  userId = null
}) {
  const body = {
    model: runtime.model,
    messages,
    response_format: { type: "json_object" },
    temperature,
    max_tokens: maxTokens
  };
  if (stream) {
    body.stream = true;
    body.stream_options = { include_usage: true };
  }
  const safeUserId = String(userId || "").trim();
  if (/^[a-zA-Z0-9\-_]{1,512}$/.test(safeUserId)) body.user_id = safeUserId;
  if (runtime.provider === "deepseek" || String(runtime.baseUrl).includes("deepseek")) {
    body.thinking = { type: "disabled" };
  }
  return body;
}

function normalizeUsage(value) {
  return value && typeof value === "object"
    ? {
        promptTokens: Number(value.prompt_tokens) || 0,
        completionTokens: Number(value.completion_tokens) || 0,
        totalTokens: Number(value.total_tokens) || 0
      }
    : null;
}

async function readBoundedText(response, maxBytes) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throwErr("LLM_RESPONSE_TOO_LARGE");
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let content = "";
  if (response.body) {
    for await (const chunk of response.body) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxBytes) throwErr("LLM_RESPONSE_TOO_LARGE");
      content += decoder.decode(buffer, { stream: true });
    }
  }
  content += decoder.decode();
  return content;
}

export async function readDeepseekSseCompletion(response, {
  maxResponseBytes,
  onStreamDelta
}) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxResponseBytes) throwErr("LLM_RESPONSE_TOO_LARGE");
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let pending = "";
  let content = "";
  let finishReason = null;
  let usage = null;

  const consumeLine = async (rawLine) => {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) return;
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trimStart();
    if (!data || data === "[DONE]") return;
    let payload;
    try {
      payload = JSON.parse(data);
    } catch (error) {
      throwErr("DEEPSEEK_RESPONSE_INVALID", "AI 流式响应包含无法解析的 SSE 数据。", {
        cause: error.message
      });
    }
    if (payload.usage) usage = normalizeUsage(payload.usage);
    const choice = payload.choices?.[0];
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta) {
      content += delta;
      if (typeof onStreamDelta === "function") {
        await onStreamDelta({
          delta,
          totalCharacters: content.length,
          model: payload.model || null,
          id: payload.id || null
        });
      }
    }
  };

  if (response.body) {
    for await (const chunk of response.body) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxResponseBytes) throwErr("LLM_RESPONSE_TOO_LARGE");
      pending += decoder.decode(buffer, { stream: true });
      let newlineIndex = pending.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = pending.slice(0, newlineIndex);
        pending = pending.slice(newlineIndex + 1);
        await consumeLine(line);
        newlineIndex = pending.indexOf("\n");
      }
    }
  }
  pending += decoder.decode();
  if (pending) await consumeLine(pending);
  return { content, finishReason, usage, totalBytes };
}

function retryableTransportError(error) {
  if (error?.code === "RATE_LIMITED" || error?.code === "GATEWAY_TIMEOUT") return true;
  return error?.code === "DEEPSEEK_API_ERROR"
    && [500, 502, 503, 504].includes(Number(error.details?.status));
}

function retryDelayMs(attempt) {
  return Math.min(8000, 500 * (2 ** Math.max(0, attempt - 1))) + Math.floor(Math.random() * 250);
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveDeepseekTimeoutMs(value, fallback = 180_000) {
  return clampInteger(value, 5_000, 240_000, fallback);
}

export async function requestDeepseekJson(messages, {
  maxTokens = 8000,
  temperature = 0.5,
  timeoutMs,
  phase,
  context = {},
  retryOnJsonParse = true,
  idempotencyKey = null,
  stream = false,
  onStreamDelta = null,
  userId = null,
  transportRetries = 2,
  maxResponseBytes
} = {}) {
  const runtime = getLlmRuntime();
  if (!runtime.configured || !runtime.apiKey) throwNotConfigured(runtime);
  const callTimeoutMs = resolveDeepseekTimeoutMs(
    timeoutMs ?? runtime.timeoutMs,
    deepseekConfig().timeoutMs
  );
  if (callTimeoutMs < 5_000 || callTimeoutMs > 240_000) {
    throw new RangeError("DeepSeek timeout escaped its bounded range");
  }
  const attempts = Math.max(
    retryOnJsonParse ? 2 : 1,
    Math.max(0, Math.min(5, Number(transportRetries) || 0)) + 1
  );
  let lastSyntaxError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), callTimeoutMs);
    try {
      const requestInit = {
        method: "POST",
        headers: { authorization: `Bearer ${runtime.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(buildChatCompletionBody(runtime, {
          messages,
          maxTokens,
          temperature,
          stream,
          userId
        })),
        signal: controller.signal
      };
      const response = stream
        ? await withPinnedOutboundResponse(
            `${runtime.baseUrl.replace(/\/$/, "")}/chat/completions`,
            requestInit,
            async (upstreamResponse, { maxResponseBytes }) => {
              if (!upstreamResponse.ok) {
                const rawError = await readBoundedText(upstreamResponse, maxResponseBytes);
                let payload = {};
                try {
                  payload = JSON.parse(rawError);
                } catch {
                  payload = {};
                }
                return { ok: false, status: upstreamResponse.status, payload };
              }
              return {
                ok: true,
                status: upstreamResponse.status,
                ...(await readDeepseekSseCompletion(upstreamResponse, {
                  maxResponseBytes,
                  onStreamDelta
                }))
              };
            },
            { maxResponseBytes }
          )
        : await fetchPinnedOutboundJson(
            `${runtime.baseUrl.replace(/\/$/, "")}/chat/completions`,
            requestInit,
            { maxResponseBytes }
          );
      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          throwErr("RATE_LIMITED", "AI 服务请求过于频繁，请稍后再试。", {
            phase,
            attempt,
            providerStatus: status,
            ...context
          });
        }
        throwErr("DEEPSEEK_API_ERROR", llmRequestFailureMessage(status), {
          phase, attempt, status, source: runtime.source, ...context
        });
      }
      const payload = response.payload || {};
      const content = stream ? response.content : payload.choices?.[0]?.message?.content;
      const finishReason = stream
        ? response.finishReason
        : (payload.choices?.[0]?.finish_reason || null);
      const usage = stream ? response.usage : normalizeUsage(payload.usage);
      if (!content) {
        throwErr("DEEPSEEK_RESPONSE_INVALID", "AI 返回了空内容，请重试。", { phase, attempt, ...context });
      }
      if (finishReason === "length") {
        throwErr("DEEPSEEK_RESPONSE_TRUNCATED", "AI 输出达到 token 上限而被截断，请拆分生成或提高输出预算。", {
          phase,
          attempt,
          maxTokens,
          finishReason,
          usage,
          ...context
        });
      }
      if (runtime.billPlatform && runtime.userId && isCreditsSystemEnabled() && isCreditsDebitAiEnabled()) {
        await chargeAiCredits(runtime.userId, {
          refType: "ai",
          refId: phase || null,
          idempotencyKey: idempotencyKey || (phase ? `ai:${runtime.userId}:${phase}:${attempt}` : null)
        });
      }
      return {
        model: runtime.model,
        provider: runtime.source,
        value: JSON.parse(content),
        rawContent: content,
        finishReason,
        usage
      };
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
      if (retryableTransportError(error) && attempt < attempts) {
        await wait(retryDelayMs(attempt));
        continue;
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
