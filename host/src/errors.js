const API_ERROR_MESSAGES = {
  HOST_ROLE_REQUIRED: "需要主持人或协主持权限。",
  ROOM_MEMBERSHIP_REQUIRED: "你不是该运行房的成员。",
  ROLE_SLOT_NOT_OCCUPIED: "该席位尚无玩家。",
  ROOM_NOT_FOUND: "房间不存在。",
  AUTH_REQUIRED: "请先登录后再操作。",
  LIVEKIT_NOT_CONFIGURED: "语音服务未配置，仍可使用文字频道。"
};

export function formatApiError(error, fallback = "操作失败") {
  if (error?.code && API_ERROR_MESSAGES[error.code]) return API_ERROR_MESSAGES[error.code];
  if (error?.name === "AbortError" || error?.code === "REQUEST_TIMEOUT") {
    return "请求超时，请检查网络连接后重试。";
  }
  if (error?.code === "NETWORK_ERROR") return "无法连接服务器，请检查网络或稍后再试。";
  const status = error?.status;
  if (status === 503) return API_ERROR_MESSAGES[error.code] || "服务暂时不可用，请稍后再试。";
  if (status >= 500) return "服务器繁忙，请稍后再试。";
  if (status === 401) return API_ERROR_MESSAGES.AUTH_REQUIRED;
  if (status === 403) return error?.message || "无权执行此操作。";
  const raw = error?.message || "";
  if (/^请求失败 \(\d+\)$/.test(raw)) return fallback;
  return raw || fallback;
}
