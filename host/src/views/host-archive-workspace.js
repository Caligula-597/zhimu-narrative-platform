import { getRoomId } from "../session.js";
import { state } from "../state.js";
import {
  HOST_ARCHIVE_KINDS,
  HOST_ARCHIVE_LIMITS,
  hostArchiveContextIsCurrent,
  hostArchiveIsLocked,
  hostArchiveIsPending
} from "../runtime/host-archive-model.js";
import { escapeHtml } from "../utils/format.js";

function statusHtml(workspace) {
  if (!workspace.message && !workspace.errors.length) return "";
  const tone = workspace.status === "error"
    ? "error"
    : workspace.status === "uncertain"
      ? "warning"
      : workspace.status === "success"
        ? "success"
        : "pending";
  return `<section class="host-archive-status ${tone}" role="${tone === "error" ? "alert" : "status"}">
    ${workspace.message ? `<p>${escapeHtml(workspace.message)}</p>` : ""}
    ${workspace.errors.length ? `<ul>${workspace.errors.map((error) => `<li>${escapeHtml(error.path ? `${error.path}：${error.message}` : error.message || String(error))}</li>`).join("")}</ul>` : ""}
  </section>`;
}

function confirmationHtml(workspace) {
  if (!workspace.confirm) return "";
  return `<section class="host-archive-confirm" aria-label="未保存归档草稿确认">
    <div><p class="section-kicker">UNSAVED ARCHIVE</p><strong>放弃当前未提交的归档草稿？</strong><p>存档点和复盘草稿都会被清除；已经由服务器确认的记录不会受到影响。</p></div>
    <div class="row"><button type="button" class="secondary-btn" data-action="host-archive-confirm-cancel">继续编辑</button><button type="button" class="primary-btn danger-btn" data-action="host-archive-discard-confirm">确认放弃</button></div>
  </section>`;
}

function contextFacts() {
  const joined = (state.cloudHostPlayers || []).filter((player) => player.joined).length;
  const pending = (state.cloudHostEvents || []).filter((event) => event.status !== "delayed").length;
  const logs = (state.cloudWorldLogs || []).length;
  const clues = state.studio?.clues?.length || 0;
  return [
    { value: joined, label: "已入房玩家" },
    { value: clues, label: "剧本线索" },
    { value: pending, label: "待确认事件" },
    { value: logs, label: "近期日志" }
  ];
}

function historySummary(item, kind) {
  const summary = item.summary || {};
  if (kind === "checkpoint") {
    return [
      `${Number(summary.joinedPlayers) || 0}/${Number(summary.totalRoles) || 0} 玩家`,
      `${Number(summary.clueCount) || 0} 线索`,
      `${Number(summary.unlockedSceneCount) || 0} 场景`,
      `${Number(summary.pendingEventCount) || 0} 待办`
    ].join(" · ");
  }
  return [
    `${Number(summary.joinedPlayers) || 0} 玩家`,
    `${Number(summary.cluesDiscovered) || 0} 已发现线索`,
    `${Number(summary.investigationsCompleted) || 0} 调查`,
    `${Number(summary.rulesTriggered) || 0} 规则`
  ].join(" · ");
}

function historyDate(value) {
  if (!value) return "刚刚";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN");
}

function historyHtml(workspace) {
  const kind = workspace.kind;
  const items = kind === "recap" ? workspace.recaps : workspace.checkpoints;
  const loading = workspace.historyStatus === "loading";
  const rows = items.length
    ? items.slice(0, 10).map((item) => `<article class="host-archive-history-row">
        <div><strong>${escapeHtml(item.label || HOST_ARCHIVE_KINDS[kind].label)}</strong><p>${escapeHtml(item.description || "无主持备注")}</p></div>
        <small>${escapeHtml(historySummary(item, kind))}</small>
        <small>${escapeHtml(item.created_by_name || "主持人")} · ${escapeHtml(historyDate(item.created_at))}</small>
      </article>`).join("")
    : `<div class="empty-state">${loading ? "正在读取历史记录…" : `当前房间尚无${HOST_ARCHIVE_KINDS[kind].label}。`}</div>`;
  return `<aside class="host-archive-history">
    <div class="host-archive-history-head"><div><p class="section-kicker">ROOM HISTORY</p><h3>${escapeHtml(HOST_ARCHIVE_KINDS[kind].label)}历史</h3></div><button type="button" class="text-btn" data-action="host-archive-refresh" ${loading ? "disabled" : ""}>${loading ? "读取中…" : "刷新"}</button></div>
    ${workspace.historyError ? `<div class="host-archive-history-error" role="status">${escapeHtml(workspace.historyError)}</div>` : ""}
    <div class="host-archive-history-list">${rows}</div>
  </aside>`;
}

function formHtml(workspace) {
  const kind = workspace.kind;
  const config = HOST_ARCHIVE_KINDS[kind];
  const draft = workspace.drafts[kind];
  const locked = hostArchiveIsLocked(workspace);
  const titlePlaceholder = kind === "recap" ? "例如：第一夜 · 完整复盘" : "例如：第一夜收工";
  const descriptionPlaceholder = kind === "recap"
    ? "记录本局结局、未解之谜或后续需要补充的说明"
    : "记录今晚推进到哪里、下次从哪里继续";
  return `<section class="host-archive-editor">
    <div class="host-archive-kind-tabs" role="tablist" aria-label="归档类型">
      ${Object.entries(HOST_ARCHIVE_KINDS).map(([id, item]) => `<button type="button" role="tab" aria-selected="${kind === id}" class="${kind === id ? "active" : ""}" data-action="host-archive-kind" data-kind="${id}" ${locked ? "disabled" : ""}><strong>${escapeHtml(item.label)}</strong><small>${id === "checkpoint" ? "可恢复的运行快照" : "面向局后分析的完整叙事"}</small></button>`).join("")}
    </div>
    <div class="host-archive-purpose"><p class="section-kicker">${kind === "recap" ? "POSTGAME RECORD" : "RECOVERY POINT"}</p><h3>${escapeHtml(config.actionLabel)}</h3><p>${escapeHtml(config.description)}</p></div>
    <label>标题
      <input class="field" maxlength="${HOST_ARCHIVE_LIMITS.TITLE}" data-host-archive-field="title" value="${escapeHtml(draft.title)}" placeholder="${escapeHtml(titlePlaceholder)}" ${locked ? "disabled" : ""}>
    </label>
    <label>主持备注
      <textarea class="field" rows="8" maxlength="${HOST_ARCHIVE_LIMITS.DESCRIPTION}" data-host-archive-field="description" placeholder="${escapeHtml(descriptionPlaceholder)}" ${locked ? "disabled" : ""}>${escapeHtml(draft.description)}</textarea>
    </label>
    <section class="host-archive-boundary">
      <strong>${kind === "recap" ? "复盘会读取什么" : "存档会保存什么"}</strong>
      <ul>${kind === "recap"
        ? "<li>章节与关键剧情脉络</li><li>玩家阅读、线索、调查和笔记表现</li><li>主持确认事件、规则触发和结局信息</li>"
        : "<li>玩家阅读进度与角色状态</li><li>线索归属、物品、内容解锁和调查记录</li><li>待确认事件、规则执行和近期时间线</li>"}</ul>
    </section>
    <footer class="host-archive-actions">
      <span class="status-chip ${workspace.dirty[kind] ? "testing" : "published"}">${workspace.dirty[kind] ? "有未提交修改" : "草稿未修改"}</span>
      <div class="row">
        ${workspace.status === "uncertain" ? `<button type="button" class="secondary-btn" data-action="host-archive-reconcile">核对提交</button>` : ""}
        <button type="button" class="primary-btn" data-action="host-archive-submit" ${locked ? "disabled" : ""}>${hostArchiveIsPending(workspace) ? "处理中…" : escapeHtml(config.actionLabel)}</button>
      </div>
    </footer>
  </section>`;
}

export function renderHostArchiveWorkspace() {
  const workspace = state.hostArchiveWorkspace;
  if (!workspace || !hostArchiveContextIsCurrent(workspace, getRoomId())) return "";
  const pending = hostArchiveIsPending(workspace);
  return `<section class="host-archive-workspace" data-host-archive-workspace aria-labelledby="host-archive-title">
    <header class="host-archive-head">
      <div><p class="section-kicker">SESSION ARCHIVE WORKSPACE</p><h2 id="host-archive-title">房间归档工作区</h2><p><strong>${escapeHtml(workspace.roomName)}</strong> · 所有写入固定绑定当前打开时的运行房。</p></div>
      <button type="button" class="secondary-btn" data-action="host-archive-close" ${pending ? "disabled" : ""}>返回监控台</button>
    </header>
    <div class="host-archive-facts">${contextFacts().map((fact) => `<article><strong>${Number(fact.value) || 0}</strong><span>${escapeHtml(fact.label)}</span></article>`).join("")}</div>
    ${statusHtml(workspace)}
    <div class="host-archive-grid">${formHtml(workspace)}${historyHtml(workspace)}</div>
    ${confirmationHtml(workspace)}
  </section>`;
}
