import { escapeHtml } from "../security.js";

export { escapeHtml };

export function formatTime(value) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatRelativeTime(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return formatTime(value);
}

export function hostAuditActionLabel(action = "") {
  const labels = {
    manual_rule_triggered: "手动触发规则",
    host_grant_clue: "手动发线索",
    host_grant_item: "手动发物品",
    host_event_delayed: "延迟待确认事件",
    host_kick_player: "踢出玩家",
    checkpoint_restore: "存档点恢复"
  };
  return labels[action] || action || "主持操作";
}

export function hostAuditDetail(entry = {}) {
  const meta = entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
  if (entry.action === "host_event_delayed") return `延迟 ${meta.delayMinutes ?? "?"} 分钟`;
  if (entry.action === "host_grant_clue") return `发放给 ${(meta.roleSlotIds || []).length} 名玩家`;
  if (entry.action === "host_kick_player") {
    return meta.displayName ? `移出 ${meta.displayName}` : meta.roleName ? `角色 ${meta.roleName}` : "";
  }
  return "";
}

export function hostOperationLabel(type = "", message = "") {
  const labels = {
    reading_completed: "阅读完成",
    investigation_completed: "调查完成",
    host_grant_clue: "主持发线索",
    host_unlock_section: "解锁分幕",
    scene_unlocked: "开放场景",
    host_event_executed: "主持确认",
    host_event_dismissed: "主持拒绝",
    player_kicked: "玩家被移出",
    host_note: "主持备注"
  };
  return labels[type] || message || "系统记录";
}

export function hostPlayerColor(index) {
  return ["#b9795c", "#587f79", "#706b91", "#9a814f", "#76614d", "#657c91"][index % 6];
}

export function logActivityType(eventType = "") {
  return /warn|stuck|delay|卡关/i.test(eventType) ? "warn" : "ok";
}

export function rulePreviewStatusLabel(status = "") {
  const labels = {
    ready: "条件已满足",
    manual_ready: "可手动触发",
    waiting: "等待条件",
    disabled: "未启用"
  };
  return labels[status] || status || "未知";
}
