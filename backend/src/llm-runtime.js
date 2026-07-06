/**
 * Per-request LLM runtime (user BYOK vs platform pool) via AsyncLocalStorage.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { deepseekConfig } from "./deepseek.js";

export const llmRuntimeStorage = new AsyncLocalStorage();

export function platformLlmRuntime() {
  const config = deepseekConfig();
  return {
    configured: config.configured,
    source: "platform",
    provider: "deepseek",
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    timeoutMs: config.timeoutMs,
    billPlatform: true,
    connectionId: null,
    connectionName: null,
    userId: null
  };
}

export function getLlmRuntime() {
  return llmRuntimeStorage.getStore() ?? platformLlmRuntime();
}

export function bindLlmRuntime(runtime) {
  llmRuntimeStorage.enterWith(runtime);
}

export async function runWithLlmRuntime(runtime, work) {
  return llmRuntimeStorage.run(runtime, work);
}
