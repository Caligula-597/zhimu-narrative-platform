import { escapeHtml, formatTime, hostOperationLabel } from "../utils/format.js";
import {
  WORLD_LOG_EVENT_OPTIONS,
  WORLD_LOG_MAX_LIMIT,
  worldLogStats,
  worldLogVisibilityLabel
} from "./writer-world-logs-model.js";
import {
  writerToolContextPanelHtml,
  writerToolFactsHtml,
  writerToolSurfaceHtml
} from "./writer-tool-layout.js";

function optionRows(items, selected, valueKey, labelKey, allLabel) {
  const all = `<option value=""${selected ? "" : " selected"}>${escapeHtml(allLabel)}</option>`;
  return all + items.map((item) => {
    const value = String(item?.[valueKey] || "");
    const label = String(item?.[labelKey] || "未命名");
    return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function eventOptionsHtml(selected) {
  return WORLD_LOG_EVENT_OPTIONS.map(([value, label]) =>
    `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`
  ).join("");
}

function logRowsHtml(logs) {
  if (!logs.length) {
    return `<div class="writer-world-logs-empty">
      <strong>没有匹配的运行记录</strong>
      <p>调整房间、事件类型或关键词；筛选只影响当前查看，不会删除历史。</p>
    </div>`;
  }
  return logs.map((log) => {
    const eventType = String(log?.event_type || "");
    return `<article class="writer-world-log-row">
      <div class="writer-world-log-mark" aria-hidden="true"></div>
      <div class="writer-world-log-copy">
        <header>
          <div>
            <span class="writer-world-log-type">${escapeHtml(hostOperationLabel(eventType, ""))}</span>
            <code>${escapeHtml(eventType || "system")}</code>
          </div>
          <time datetime="${escapeHtml(log?.created_at || "")}">${escapeHtml(formatTime(log?.created_at))}</time>
        </header>
        <p>${escapeHtml(log?.message || "该事件没有附加说明")}</p>
        <footer>
          <span>${escapeHtml(log?.room_name || "未命名运行房")}</span>
          <span>${escapeHtml(log?.actor_name || "系统")}</span>
          <span>${escapeHtml(worldLogVisibilityLabel(log?.visibility))}</span>
        </footer>
      </div>
    </article>`;
  }).join("");
}

function filterPanelHtml(data, session, stats) {
  return writerToolContextPanelHtml({
    kicker: "RUNTIME JOURNAL",
    title: "筛选运行记录",
    intro: "按运行房和事件类型定位玩家阅读、调查、规则与主持操作。日志为只读证据，不会在这里改写运行状态。",
    facts: [
      { label: "当前记录", value: stats.returned },
      { label: "涉及房间", value: stats.rooms },
      { label: "操作主体", value: stats.actors },
      { label: "读取上限", value: session.filters.limit }
    ],
    bodyHtml: `<div class="writer-world-log-filters">
      <label>运行房
        <select class="field" data-action="writer-logs-filter-room">
          ${optionRows(data?.rooms || [], session.filters.roomId, "id", "name", "全部运行房")}
        </select>
      </label>
      <label>事件类型
        <select class="field" data-action="writer-logs-filter-event">${eventOptionsHtml(session.filters.eventType)}</select>
      </label>
      <label>日志关键词
        <input class="field" maxlength="120" value="${escapeHtml(session.keywordDraft)}" data-writer-log-keyword placeholder="搜索日志正文">
      </label>
      <div class="writer-world-log-filter-actions">
        <button type="button" class="primary-btn" data-action="writer-logs-apply"${session.loading ? " disabled" : ""}>应用筛选</button>
        <button type="button" class="secondary-btn" data-action="writer-logs-clear"${session.loading ? " disabled" : ""}>清除</button>
      </div>
      <p class="writer-world-log-filter-note">按 Enter 可搜索；快速切换筛选时，较早返回的请求不会覆盖当前结果。</p>
    </div>`
  });
}

export function worldLogsWorkspaceHtml(data, session) {
  const stats = worldLogStats(session.logs, session.filters.limit);
  const status = session.error
    ? `<div class="writer-world-log-status error" role="alert"><strong>运行日志加载失败</strong><p>${escapeHtml(session.error)}</p><button type="button" class="secondary-btn" data-action="writer-logs-refresh">重试</button></div>`
    : session.loading && !session.logs.length
      ? `<div class="writer-world-log-status" role="status"><strong>正在读取运行日志…</strong><p>筛选条件已固定，等待云端返回。</p></div>`
      : "";
  const more = stats.hasMore
    ? `<button type="button" class="secondary-btn" data-action="writer-logs-more"${session.loading ? " disabled" : ""}>继续读取 ${Math.min(50, WORLD_LOG_MAX_LIMIT - session.filters.limit)} 条</button>`
    : stats.capped
      ? `<span class="writer-world-log-cap">已达到单次查看上限 ${WORLD_LOG_MAX_LIMIT} 条，请使用筛选缩小范围</span>`
      : `<span class="writer-world-log-cap">已显示当前筛选下的全部记录</span>`;
  return writerToolSurfaceHtml({
    type: "logs",
    className: "writer-world-logs-workspace",
    bodyHtml: `<header class="writer-world-logs-head">
      <div>
        <p class="section-kicker">WORLD OPERATIONS LEDGER</p>
        <h1>世界运行日志</h1>
        <p>集中查看三端产生的运行证据，确认玩家知道了什么、规则何时触发、主持执行了哪些操作。</p>
      </div>
      <div class="row">
        <button type="button" class="secondary-btn" data-action="writer-logs-refresh"${session.loading ? " disabled" : ""}>刷新</button>
        <button type="button" class="secondary-btn" data-action="writer-tool-close">返回创作中心</button>
      </div>
    </header>
    <div class="writer-world-logs-layout">
      ${filterPanelHtml(data, session, stats)}
      <main class="writer-world-log-ledger" aria-busy="${session.loading ? "true" : "false"}">
        <div class="section-head">
          <div><p class="section-kicker">AUDIT TRAIL</p><h2>运行证据</h2><p>${escapeHtml(session.summary || "按时间倒序显示最近记录")}</p></div>
          ${session.loading && session.logs.length ? '<span class="cloud-pill">正在刷新…</span>' : ""}
        </div>
        ${status || `<div class="writer-world-log-list" aria-live="polite">${logRowsHtml(session.logs)}</div>`}
        <div class="writer-world-log-footer">${more}</div>
      </main>
    </div>`
  });
}
