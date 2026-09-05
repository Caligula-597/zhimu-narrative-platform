/**
 * P9.3 injectable LLM port for RealScriptWriter (no backend import required).
 */

export class MockScriptWriterLlm {
  /**
   * @param {{
   *   handler?: (messages: object[], opts: object) => Promise<string>|string,
   *   failFirstParse?: boolean,
   *   modelId?: string,
   *   adapterId?: string,
   * }} [opts]
   */
  constructor(opts = {}) {
    this.handler = opts.handler || null;
    this.failFirstParse = Boolean(opts.failFirstParse);
    this._calls = 0;
    this.modelId = opts.modelId || "mock-script-writer";
    this.adapterId = opts.adapterId || "mock";
  }

  async completeJson({ messages, responseFormat = "json_object" } = {}) {
    this._calls += 1;
    const text =
      typeof this.handler === "function"
        ? await this.handler(messages, { responseFormat, callIndex: this._calls })
        : "{}";
    return {
      text: String(text ?? ""),
      modelId: this.modelId,
      adapterId: this.adapterId,
      callIndex: this._calls,
    };
  }
}

/** Extract first JSON object from model text (fences tolerated). */
export function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("empty_model_output");
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json_object");
  return JSON.parse(body.slice(start, end + 1));
}
