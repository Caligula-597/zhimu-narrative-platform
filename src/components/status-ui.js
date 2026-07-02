import { escapeHtml } from "../utils/format.js";
import { friendlyApiError } from "../utils/user-messages.js";
/** Shared loading / empty / error state renderers. */

export function normalizeError(error, fallback = "操作失败，请稍后重试。") {
  if (!error) return fallback;
  if (typeof error === "string") return error || fallback;
  const payload = { code: error.code, error: error.message || error.error };
  return friendlyApiError(payload, error.message || fallback) || error.message || fallback;
}

export function renderState({
  tone = "info",
  kicker = "",
  title = "",
  message = "",
  details = [],
  actions = "",
  compact = false
} = {}) {
  const detailList = details.length
    ? `<ul class="unified-state-details">${details.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  return `<section class="unified-state unified-state-${tone} ${compact ? "compact" : ""}">
    ${kicker ? `<p class="section-kicker">${escapeHtml(kicker)}</p>` : ""}
    ${title ? `<h3>${escapeHtml(title)}</h3>` : ""}
    ${message ? `<p>${escapeHtml(message)}</p>` : ""}
    ${detailList}
    ${actions ? `<div class="row unified-state-actions">${actions}</div>` : ""}
  </section>`;
}

export function loading(title = "正在加载", message = "请稍候，正在同步最新数据。", options = {}) {
  return renderState({ ...options, tone: "loading", title, message });
}

export function empty(title = "暂无内容", message = "当前筛选条件下没有可显示的数据。", options = {}) {
  return renderState({ ...options, tone: "empty", title, message });
}

export function error(title = "加载失败", err, options = {}) {
  return renderState({ ...options, tone: "error", title, message: normalizeError(err, options.fallback) });
}

export function modalLoading(message = "正在加载…") {
  return renderState({ tone: "loading", message, compact: true });
}

export function modalError(err, fallback = "加载失败，请稍后重试。") {
  return renderState({ tone: "error", title: "无法完成操作", message: normalizeError(err, fallback), compact: true });
}
