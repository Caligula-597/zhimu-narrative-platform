import { formatApiError as sharedFormatApiError, COMMON_API_ERROR_MESSAGES } from "../../shared/api-error.js";

/** Host-specific error codes (auth comes from COMMON). */
const HOST_API_ERROR_MESSAGES = {
  HOST_ROLE_REQUIRED: "需要主持人或协主持权限。",
  ROOM_MEMBERSHIP_REQUIRED: "你不是该运行房的成员。",
  ROLE_SLOT_NOT_OCCUPIED: "该席位尚无玩家。",
  ROOM_NOT_FOUND: "房间不存在。",
  LIVEKIT_NOT_CONFIGURED: "语音服务未配置，仍可使用文字频道。"
};

const API_ERROR_MESSAGES = { ...COMMON_API_ERROR_MESSAGES, ...HOST_API_ERROR_MESSAGES };

/**
 * Host error formatter — preserves host's 403 behavior
 * (prefers backend-supplied message over generic FORBIDDEN copy).
 * @param {Error & {code?: string, status?: number}} error
 * @param {string} [fallback="操作失败"]
 */
function formatApiError(error, fallback = "操作失败") {
  if (error?.status === 403) return error?.message || COMMON_API_ERROR_MESSAGES.FORBIDDEN;
  return sharedFormatApiError(error, API_ERROR_MESSAGES, fallback);
}

export { formatApiError };
