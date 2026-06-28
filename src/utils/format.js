/**
 * Format helpers — migrated to real ES Modules.
 * escapeHtml now re-exported from shared/security.js (canonical home).
 * window.zhimuFormat bridge kept for un-migrated views.
 */
import { escapeHtml } from "../../shared/security.js";

export {
  formatTime,
  formatRelativeTime,
  formatBytes,
  escapeHtml,
  roleParts,
  hostAuditActionLabel,
  hostAuditDetail,
  checkpointRestoreStatusLabel,
  hostOperationLabel,
  hostPlayerColor,
  logActivityType,
  chapterPublicationLabel,
  chapterFlowClass
};

function formatTime(value) {
  return new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatRelativeTime(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return formatTime(value);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function roleParts(name = "") {
  const parts = String(name).split(" · ");
  return { name: parts[0] || "未命名角色", role: parts.slice(1).join(" · ") || "玩家角色" };
}

function checkpointRestoreStatusLabel(status = "") {
  const labels = { pending: "排队中", applied: "已应用", failed: "失败", cancelled: "已取消" };
  return labels[status] || status || "未知";
}

function hostAuditActionLabel(action = "") {
  const labels = {
    manual_rule_triggered: "手动触发规则",
    room_settings_updated: "房间设置变更",
    host_grant_clue: "手动发线索",
    host_grant_item: "手动发物品",
    host_event_delayed: "延迟待确认事件",
    host_kick_player: "踢出玩家",
    checkpoint_restore: "存档点恢复",
    delay_expired: "延迟到期唤醒"
  };
  return labels[action] || action || "主持操作";
}

function hostAuditDetail(entry = {}) {
  const meta = entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
  if (entry.action === "host_event_delayed") return `延迟 ${meta.delayMinutes ?? "?"} 分钟`;
  if (entry.action === "host_grant_clue") return `发放给 ${(meta.roleSlotIds || []).length} 名玩家`;
  if (entry.action === "host_grant_item") return `发放给 ${meta.roleSlotId ? "1" : "0"} 名玩家`;
  if (entry.action === "host_kick_player") return meta.displayName ? `移出 ${meta.displayName}` : meta.roleName ? `角色 ${meta.roleName}` : "";
  if (entry.action === "checkpoint_restore") {
    const scope = meta.scope && typeof meta.scope === "object" ? Object.entries(meta.scope).filter(([, v]) => v).map(([k]) => k) : [];
    return scope.length ? `回滚域：${scope.join("、")}${meta.crossRoom ? " · 跨平行房" : ""}` : meta.crossRoom ? "跨平行房恢复" : "已应用恢复";
  }
  if (entry.action === "room_settings_updated" && meta.settings) {
    const keys = Object.keys(meta.settings);
    return keys.length ? `变更：${keys.join("、")}` : "已更新房间设置";
  }
  if (entry.action === "manual_rule_triggered" && meta.ruleId) return `规则 ${String(meta.ruleId).slice(0, 8)}…`;
  if (entry.target_type && entry.target_id) return `${entry.target_type} · ${String(entry.target_id).slice(0, 8)}…`;
  return "";
}

function hostOperationLabel(type = "", message = "") {
  const labels = {
    reading_completed: "阅读完成",
    investigation_completed: "调查完成",
    host_grant_clue: "主持发线索",
    host_unlock_section: "解锁分幕",
    scene_unlocked: "开放场景",
    host_event_executed: "主持确认",
    host_event_dismissed: "主持拒绝",
    player_kicked: "玩家被移出",
    host_note: "主持备注",
    rule_action: "规则动作",
    clue_read: "线索阅读",
    clue_shared_room: "线索公开"
  };
  return labels[type] || message || "系统记录";
}

function hostPlayerColor(index) {
  return ["#b9795c", "#587f79", "#706b91", "#9a814f", "#76614d", "#657c91"][index % 6];
}

function logActivityType(eventType = "") {
  return /warn|stuck|delay|卡关/i.test(eventType) ? "warn" : "ok";
}

function chapterPublicationLabel(status) {
  return { draft: "草稿", testing: "测试中", published: "已发布" }[status] || status;
}

function chapterFlowClass(status) {
  if (status === "published") return "ok";
  if (status === "testing") return "live";
  return "locked";
}

/** Bridge: un-migrated views still read window.zhimuFormat. */
if (typeof window !== "undefined") {
  window.zhimuFormat = {
    formatRelativeTime,
    formatTime,
    formatBytes,
    escapeHtml,
    roleParts,
    hostAuditActionLabel,
    hostAuditDetail,
    checkpointRestoreStatusLabel,
    hostOperationLabel,
    hostPlayerColor,
    logActivityType,
    chapterPublicationLabel,
    chapterFlowClass
  };
}
