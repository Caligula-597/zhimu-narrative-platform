const API_ERROR_MESSAGES = {
  ROLE_SLOT_OCCUPIED: "该角色席位已被其他玩家占用，请选择其他角色。",
  ROLE_ALREADY_BOUND: "你已在该运行房绑定角色，不可更换席位。如需换角请联系主持人。",
  ROLE_SLOT_WORLD_MISMATCH: "所选角色不属于当前房间。",
  ROOM_NOT_FOUND: "邀请码无效或房间不存在。",
  INVITE_FIELDS_REQUIRED: "请填写邀请码并选择角色席位。",
  PLAYER_ROLE_REQUIRED: "需要选择角色后才能进入房间。",
  PLAZA_POST_INVALID: "发言内容需为 1～500 字。",
  PLAZA_POST_REJECTED: "帖子未通过审核，请根据提示修改后重试。",
  PLAZA_POST_NOT_FOUND: "帖子不存在或已删除。",
  PLAZA_REPLY_INVALID: "评论内容需为 1～500 字。",
  PLAZA_REPLY_NOT_FOUND: "评论不存在或已删除。",
  PLAZA_REPORT_INVALID: "举报说明需 4～200 字。",
  PLAZA_REPORT_SELF: "不能举报自己的内容。",
  FRIEND_SELF: "不能添加自己为好友。",
  FRIEND_ALREADY: "你们已经是好友。",
  FRIEND_REQUEST_EXISTS: "好友请求已存在。",
  FRIEND_REQUEST_NOT_FOUND: "没有待处理的好友请求。",
  DM_FRIEND_REQUIRED: "仅好友之间可以私聊。",
  DM_NOT_FOUND: "会话不存在。",
  DM_MESSAGE_INVALID: "私信内容需为 1～1000 字。",
  PLAY_CONTENT_FORBIDDEN: "内容包含违禁词，无法发布。请修改后重试。",
  PLAY_CONTENT_AD: "禁止发布广告、外链、联系方式引流或推广信息。",
  USER_NOT_FOUND: "找不到该玩家。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  AUTH_REQUIRED: "请先登录后再操作。",
  GUEST_ACCOUNT_RESTRICTED: "游客账号无法使用社区功能，请先注册登录。",
  EMAIL_NOT_VERIFIED: "请先验证邮箱后再使用社区功能。",
  PLAY_SOCIAL_ACCOUNT_TOO_NEW: "新注册账号需稍等片刻后才能发帖或私聊。",
  FORBIDDEN: "无权执行此操作。",
  RECAP_NOT_GENERATED: "主持人尚未生成复盘报告。",
  EMAIL_NOT_CONFIGURED: "邮件服务未配置，暂无法发送验证或重置邮件。",
  PASSWORD_RESET_INVALID: "重置链接无效或已过期，请重新申请。",
  EMAIL_VERIFICATION_INVALID: "验证链接无效或已过期。"
};

export function formatApiError(error, fallback = "操作失败") {
  if (error?.code && API_ERROR_MESSAGES[error.code]) return API_ERROR_MESSAGES[error.code];
  if (error?.name === "AbortError" || error?.code === "REQUEST_TIMEOUT") {
    return "请求超时，请检查网络连接后重试。";
  }
  if (error?.code === "NETWORK_ERROR") {
    return "无法连接服务器，请检查网络或稍后再试。";
  }
  const status = error?.status;
  if (status === 503) return "服务暂时不可用，请稍后再试。";
  if (status === 502 || status === 504) return "网关超时，请稍后再试。";
  if (status >= 500) return "服务器繁忙，请稍后再试。若持续出现请联系主持人。";
  if (status === 401) return API_ERROR_MESSAGES.AUTH_REQUIRED;
  if (status === 403) return API_ERROR_MESSAGES.FORBIDDEN;
  if (status === 429) return API_ERROR_MESSAGES.RATE_LIMITED;
  const raw = error?.message || "";
  if (/^请求失败 \(\d+\)$/.test(raw)) return fallback;
  return raw || fallback;
}
