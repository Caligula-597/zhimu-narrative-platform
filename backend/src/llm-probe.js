/**
 * Lightweight LLM connectivity probe for account settings.
 */
import { throwErr } from "./api-errors.js";
import { fetchPinnedOutboundJson } from "./pinned-outbound-fetch.js";

export async function probeLlmConnection(runtime) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(runtime.timeoutMs || 30000, 30000));
  try {
    const url = `${runtime.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetchPinnedOutboundJson(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${runtime.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: runtime.model,
        messages: [{ role: "user", content: "Reply with JSON: {\"ok\":true}" }],
        max_tokens: 16,
        temperature: 0
      }),
      signal: controller.signal
    });
    const payload = response.payload;
    if (!response.ok) {
      const msg = payload.error?.message || `HTTP ${response.status}`;
      throwErr("LLM_PROBE_FAILED", `连接测试失败：${msg}`, { status: response.status });
    }
    return {
      ok: true,
      model: runtime.model,
      provider: runtime.provider,
      message: "连接成功"
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throwErr("GATEWAY_TIMEOUT", "连接测试超时，请检查 baseUrl 与网络");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
