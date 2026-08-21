const REASON_LABELS = Object.freeze({
  initial_connect: "正在建立实时连接",
  connecting: "正在连接实时通道",
  retry: "实时通道断开，正在重试",
  stream_closed: "实时通道已关闭",
  stream_error: "实时通道发生网络错误",
  handshake_timeout: "连接响应超时",
  offline: "设备当前离线",
  browser_resume: "浏览器恢复后重新连接",
  stream_connected: "实时通道已连接，正在核对房间状态",
  connected: "实时通道已连接",
  disconnected: "实时通道已断开",
  poll: "正在使用轮询补偿",
  connected_periodic: "定期状态核对完成",
  catch_up_complete: "断线期间的状态已追平",
});

export function createSyncDiagnostics() {
  return {
    status: "idle",
    connected: false,
    catchUpPending: false,
    inputDeferred: false,
    reason: "",
    retryAt: null,
    lastSyncedAt: null,
    cursor: null,
    lastErrorCode: "",
  };
}

export function readSseCursor(storage, key) {
  try {
    const value = key ? storage?.getItem?.(key) : null;
    const cursor = Number(value);
    return /^\d+$/.test(String(value ?? "")) && Number.isSafeInteger(cursor) ? cursor : null;
  } catch {
    return null;
  }
}

export function applySyncStatus(current, status, meta = {}) {
  const previous = current || createSyncDiagnostics();
  const connected = status === "connected";
  return {
    ...previous,
    status,
    connected,
    catchUpPending: connected ? Boolean(meta.catchUpPending) : false,
    reason: meta.reason || (status === "reconnecting" ? "retry" : status === "polling" ? "poll" : status),
    retryAt: meta.retryAt || null,
  };
}

export function markSyncReconciled(current, {
  cursor = null,
  reason = "catch_up_complete",
  transport = "stream",
  at = new Date().toISOString(),
} = {}) {
  const previous = current || createSyncDiagnostics();
  return {
    ...previous,
    status: transport === "poll" && !previous.connected ? "polling" : "connected",
    connected: transport === "stream" || previous.connected,
    catchUpPending: false,
    reason,
    retryAt: null,
    lastSyncedAt: at,
    cursor: cursor ?? previous.cursor,
    lastErrorCode: "",
  };
}

export function markSyncError(current, error, meta = {}) {
  const previous = current || createSyncDiagnostics();
  const code = String(error?.code || "SSE_STREAM_ERROR");
  const reason = code === "SSE_HANDSHAKE_TIMEOUT"
    ? "handshake_timeout"
    : globalThis.navigator?.onLine === false ? "offline" : "stream_error";
  return {
    ...previous,
    connected: false,
    catchUpPending: false,
    reason: meta.reason || reason,
    lastErrorCode: code,
  };
}

export function markInputRefreshDeferred(current, deferred) {
  return {
    ...(current || createSyncDiagnostics()),
    inputDeferred: Boolean(deferred),
  };
}

function timeLabel(value, locale) {
  if (!value) return "尚未完成核对";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚未完成核对";
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function describeSyncDiagnostics(value, {
  locale = "zh-CN",
  fallbackCursor = null,
} = {}) {
  const state = value || createSyncDiagnostics();
  const cursor = state.cursor ?? fallbackCursor;
  const cursorLabel = cursor == null ? "游标等待首个事件" : `游标 #${cursor}`;
  const synced = `最近核对 ${timeLabel(state.lastSyncedAt, locale)} · ${cursorLabel}`;
  if (state.inputDeferred) return `正在保护你输入中的内容 · 新状态已接收，离开输入框后更新 · ${synced}`;
  if (state.catchUpPending) return `实时连接已恢复，正在追平断线期间状态 · ${cursorLabel}`;
  if (state.status === "connected") return `状态已追平 · ${synced}`;
  const reason = REASON_LABELS[state.reason] || REASON_LABELS[state.status] || "实时状态正在恢复";
  const retry = state.retryAt
    ? ` · 预计 ${timeLabel(state.retryAt, locale)} 重试`
    : "";
  return `${reason}${retry} · ${synced}`;
}
