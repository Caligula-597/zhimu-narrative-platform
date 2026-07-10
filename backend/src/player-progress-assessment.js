const STUCK_IDLE_MS = 45 * 60 * 1000;
const STUCK_OPENING_MS = 30 * 60 * 1000;
const STUCK_NO_CONTENT_MS = 5 * 60 * 1000;

/** JSON Schema for generated API contracts (host player stuck assessment). */
export const playerProgressAssessmentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["maybeStuck", "code", "label", "detail", "recommendedAction"],
  properties: {
    maybeStuck: { type: "boolean" },
    code: { type: "string", maxLength: 80 },
    label: { type: "string", maxLength: 120 },
    detail: { type: "string", maxLength: 500 },
    recommendedAction: {
      type: "string",
      enum: ["invite", "none", "unlock_section", "nudge", "inspect"]
    },
    suggestedNudge: { type: "string", maxLength: 500 }
  }
};

function timestamp(value) {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function assessPlayerProgress(player, now = Date.now()) {
  if (!player.joined) {
    return { maybeStuck: false, code: "empty", label: "席位空置", detail: "等待玩家加入", recommendedAction: "invite" };
  }
  if (!["active", "testing"].includes(player.room_status || "active")) {
    const paused = player.room_status === "paused";
    return {
      maybeStuck: false,
      code: paused ? "room_paused" : "room_inactive",
      label: paused ? "房间暂停" : "本局已结束",
      detail: paused ? "暂停期间不计入卡关" : "无需现场干预",
      recommendedAction: "none"
    };
  }

  const total = Number(player.total_sections) || 0;
  const available = player.available_sections == null ? total : Number(player.available_sections) || 0;
  const completed = Number(player.completed_sections) || 0;
  const started = Number(player.started_sections) || 0;
  const unreadClues = Math.max(0, (Number(player.clue_count) || 0) - (Number(player.read_clue_count) || 0));
  const joinedAt = timestamp(player.joined_at);
  const lastAt = timestamp(player.last_activity_at) ?? joinedAt;
  const joinedFor = joinedAt == null ? 0 : now - joinedAt;
  const idleFor = lastAt == null ? 0 : now - lastAt;

  if (total > 0 && completed >= total) {
    return { maybeStuck: false, code: "complete", label: "阅读完成", detail: "全部分幕已完成", recommendedAction: "none" };
  }
  if (available === 0 && joinedFor >= STUCK_NO_CONTENT_MS) {
    return {
      maybeStuck: true,
      code: "no_content",
      label: "无可读内容",
      detail: "入房后仍没有角色分幕",
      recommendedAction: "unlock_section",
      suggestedNudge: "正在为你准备角色内容，请稍候；主持人会尽快确认分幕配置。"
    };
  }
  if (available > 0 && available < total && completed >= available && idleFor >= STUCK_IDLE_MS) {
    return {
      maybeStuck: true,
      code: "waiting_unlock",
      label: "等待新分幕",
      detail: `已完成当前 ${available} 个可读分幕，仍有内容尚未解锁`,
      recommendedAction: "unlock_section",
      suggestedNudge: "你已完成当前开放内容，主持人正在确认下一阶段；新分幕解锁后会自动出现。"
    };
  }
  if (completed === 0 && started === 0 && joinedFor >= STUCK_OPENING_MS) {
    return {
      maybeStuck: true,
      code: "opening_not_started",
      label: "尚未开始首幕",
      detail: "入房超过 30 分钟仍未开始阅读",
      recommendedAction: "nudge",
      suggestedNudge: "可以先打开「剧情」阅读第一幕；如果看不到内容，请告诉主持人。"
    };
  }
  if (completed === 0 && started > 0 && idleFor >= STUCK_IDLE_MS) {
    return {
      maybeStuck: true,
      code: "opening_abandoned",
      label: "首幕阅读停滞",
      detail: "已开始首幕，但超过 45 分钟没有推进",
      recommendedAction: "inspect",
      suggestedNudge: "第一幕还没有读完；如果角色目标或文本不清楚，可以直接告诉主持人。"
    };
  }
  if (total > completed && idleFor >= STUCK_IDLE_MS) {
    if (unreadClues > 0) {
      return {
        maybeStuck: true,
        code: "unread_clues",
        label: "有未读线索",
        detail: `${unreadClues} 条线索尚未阅读，且超过 45 分钟未推进`,
        recommendedAction: "nudge",
        suggestedNudge: "你有新的未读线索，可以先到「调查 → 线索」查看，再决定下一步。"
      };
    }
    return {
      maybeStuck: true,
      code: "progress_idle",
      label: "剧情推进停滞",
      detail: "超过 45 分钟没有新的阅读、调查或笔记",
      recommendedAction: "inspect",
      suggestedNudge: "当前剧情似乎停住了；可以查看「现在」页的建议下一步，或联系主持人获取提示。"
    };
  }
  return {
    maybeStuck: false,
    code: "active",
    label: completed || started ? "进行中" : "刚加入",
    detail: completed || started ? "最近仍有有效推进" : "尚在开场缓冲期",
    recommendedAction: "none"
  };
}

export function computeMaybeStuck(player, now = Date.now()) {
  return assessPlayerProgress(player, now).maybeStuck;
}
