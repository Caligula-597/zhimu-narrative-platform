import { clampInteger } from "./prompts/shared.js";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";

export function deepseekConfig() {
  return {
    configured: Boolean(process.env.DEEPSEEK_API_KEY),
    baseUrl: (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
    timeoutMs: clampInteger(process.env.DEEPSEEK_TIMEOUT_MS, 5000, 240000, 180000)
  };
}
