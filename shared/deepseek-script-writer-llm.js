/**
 * Thin DeepSeek JSON LLM adapter for RealScriptWriter (ScriptWriterPort path).
 * Loads credentials from process.env; does not import backend credits/routes.
 */

export class DeepseekScriptWriterLlm {
  /**
   * @param {{
   *   apiKey?: string,
   *   baseUrl?: string,
   *   modelId?: string,
   *   timeoutMs?: number,
   *   adapterId?: string,
   * }} [opts]
   */
  constructor(opts = {}) {
    this.apiKey = opts.apiKey || process.env.DEEPSEEK_API_KEY || "";
    this.baseUrl = String(opts.baseUrl || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(
      /\/$/,
      "",
    );
    this.modelId = opts.modelId || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
    this.timeoutMs = Math.max(5000, Number(opts.timeoutMs || process.env.DEEPSEEK_TIMEOUT_MS) || 180000);
    this.adapterId = opts.adapterId || "deepseek-script-writer";
    this._calls = 0;
  }

  get configured() {
    return Boolean(this.apiKey);
  }

  async completeJson({ messages } = {}) {
    if (!this.configured) {
      throw new Error("DEEPSEEK_NOT_CONFIGURED");
    }
    this._calls += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelId,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 4096,
          thinking: { type: "disabled" },
        }),
        signal: controller.signal,
      });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(`deepseek_http_${res.status}:${raw.slice(0, 240)}`);
      }
      const data = JSON.parse(raw);
      const text = data?.choices?.[0]?.message?.content || "";
      return {
        text: String(text),
        modelId: this.modelId,
        adapterId: this.adapterId,
        callIndex: this._calls,
        usage: data?.usage || null,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
