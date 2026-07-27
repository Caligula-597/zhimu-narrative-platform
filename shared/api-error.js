/**
 * Shared API error formatting — common codes + generic formatter.
 *
 * Used by play/src/errors.js and host/src/errors.js.
 * The main app keeps its own friendlyApiError superset (payload-driven,
 * with quota/validation/details formatting) in src/utils/user-messages.js.
 */

/** Common error codes shared across clients. */
export const COMMON_API_ERROR_MESSAGES = {
  AUTH_REQUIRED: "请先登录后再操作。",
  FORBIDDEN: "无权执行此操作。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  DATABASE_BUSY: "服务连接繁忙，请稍后重试。",
  EMAIL_ALREADY_REGISTERED: "该邮箱已注册并完成验证，请直接登录。",
  EMAIL_VERIFICATION_PENDING: "该账号已创建，但邮箱尚未验证。请检查首次验证邮件；如未收到，请先登录后重新发送。"
};

/**
 * Format an API error into a user-facing Chinese string.
 *
 * @param {Error & {code?: string, status?: number, message?: string}} error
 * @param {Record<string, string>} messages - code → 文案 map (caller merges COMMON + domain-specific).
 * @param {string} [fallback="操作失败"]
 * @returns {string}
 */
export function formatApiError(error, messages = {}, fallback = "操作失败") {
  if (error?.code && messages[error.code]) return messages[error.code];
  if (error?.name === "AbortError" || error?.code === "REQUEST_TIMEOUT") {
    return "请求超时，请检查网络连接后重试。";
  }
  if (error?.code === "NETWORK_ERROR") {
    return "无法连接服务器，请检查网络或稍后再试。";
  }
  const status = error?.status;
  if (status === 503) return messages[error.code] || "服务暂时不可用，请稍后再试。";
  if (status === 502 || status === 504) return "网关超时，请稍后再试。";
  if (status >= 500) return "服务器繁忙，请稍后再试。";
  if (status === 401) return messages.AUTH_REQUIRED;
  if (status === 403) return messages.FORBIDDEN;
  if (status === 429) return messages.RATE_LIMITED;
  const raw = error?.message || "";
  if (/^请求失败 \(\d+\)$/.test(raw)) return fallback;
  return raw || fallback;
}
