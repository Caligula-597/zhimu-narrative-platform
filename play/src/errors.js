const API_ERROR_MESSAGES = {
  ROLE_SLOT_OCCUPIED: "该角色席位已被其他玩家占用，请选择其他角色。",
  ROLE_SLOT_WORLD_MISMATCH: "所选角色不属于当前房间。",
  ROOM_NOT_FOUND: "邀请码无效或房间不存在。",
  INVITE_FIELDS_REQUIRED: "请填写邀请码并选择角色席位。",
  PLAYER_ROLE_REQUIRED: "需要选择角色后才能进入房间。"
};

export function formatApiError(error, fallback = "操作失败") {
  if (error?.code && API_ERROR_MESSAGES[error.code]) return API_ERROR_MESSAGES[error.code];
  return error?.message || fallback;
}
