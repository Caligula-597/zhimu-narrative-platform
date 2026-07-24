import { getRoomId } from "../session.js";
import { state } from "../state.js";
import {
  HOST_EVENT_DELAY_LIMITS,
  hostEventStillAvailable,
  hostEventWorkspaceContextIsCurrent,
  hostEventWorkspaceIsLocked,
  hostEventWorkspaceIsPending
} from "../runtime/host-event-workspace-model.js";
import { escapeHtml, formatRelativeTime, formatTime } from "../utils/format.js";

function safeJson(value) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "无法显示结构化上下文";
  }
}

function relatedRoleIds(event) {
  const ids = new Set(event.triggerPlayers || []);
  for (const action of event.actions || []) {
    const roleId = action?.roleSlotId ?? action?.role_slot_id;
    if (roleId) ids.add(String(roleId));
    for (const item of action?.roleSlotIds || action?.role_slot_ids || []) ids.add(String(item));
  }
  return [...ids];
}

function playerLabel(roleId) {
  const player = (state.cloudHostPlayers || []).find(
    (item) => String(item.role_slot_id) === String(roleId)
  );
  return player
    ? `${player.player_display_name || "玩家"} · ${player.role_name || "未命名角色"}`
    : `席位 ${String(roleId).slice(0, 8)}…`;
}

function statusHtml(workspace) {
  if (!workspace.message && !workspace.errors.length) return "";
  const tone = workspace.status === "error" || workspace.status === "stale"
    ? "error"
    : workspace.status === "uncertain"
      ? "warning"
      : workspace.status === "success"
        ? "success"
        : "pending";
  return `<section class="host-event-workspace-status ${tone}" role="${tone === "error" ? "alert" : "status"}">
    ${workspace.message ? `<p>${escapeHtml(workspace.message)}</p>` : ""}
    ${workspace.errors.length ? `<ul>${workspace.errors.map((error) => `<li>${escapeHtml(error.message || String(error))}</li>`).join("")}</ul>` : ""}
  </section>`;
}

function commandPanel(workspace, available) {
  const locked = hostEventWorkspaceIsLocked(workspace);
  const intent = workspace.intent;
  return `<aside class="host-event-command-panel">
    <div><p class="section-kicker">HOST DECISION</p><h3>主持判断</h3><p>先核对影响，再决定执行、拒绝或延迟。所有操作固定绑定当前运行房和事件。</p></div>
    <div class="host-event-command-tabs" role="tablist" aria-label="事件处理方式">
      ${[
        ["execute", "确认执行"],
        ["dismiss", "拒绝事件"],
        ["delay", "延迟处理"]
      ].map(([command, label]) => `<button type="button" role="tab" aria-selected="${intent === command}" class="${intent === command ? "active" : ""}" data-action="host-event-workspace-command" data-command="${command}" ${locked ? "disabled" : ""}>${label}</button>`).join("")}
    </div>
    ${intent === "delay" ? `<label>延迟分钟
      <input class="field" type="number" min="${HOST_EVENT_DELAY_LIMITS.MIN}" max="${HOST_EVENT_DELAY_LIMITS.MAX}" step="1" data-host-event-field="delayMinutes" value="${escapeHtml(workspace.delayMinutes)}" ${locked ? "disabled" : ""}>
      <small>允许 1 分钟至 24 小时；到期后事件自动回到待确认队列。</small>
    </label>` : ""}
    <div class="host-event-command-impact">
      <strong>${intent === "execute" ? "执行后" : intent === "dismiss" ? "拒绝后" : intent === "delay" ? "延迟后" : "选择处理方式"}</strong>
      <p>${intent === "execute"
        ? "预览中的规则动作会写入房间，并通过实时事件同步给相关玩家。"
        : intent === "dismiss"
          ? "本条事件将标记为已拒绝，预览中的动作不会执行。"
          : intent === "delay"
            ? "事件暂时移出待办，到期后重新唤醒；不会提前执行动作。"
            : "请先核对事件来源、相关玩家和动作影响，再选择执行、拒绝或延迟。"}</p>
    </div>
    <div class="host-event-command-actions">
      ${workspace.status === "uncertain" ? `<button type="button" class="secondary-btn" data-action="host-event-workspace-reconcile">核对操作</button>` : ""}
      <button type="button" class="primary-btn ${intent === "dismiss" ? "danger-btn" : ""}" data-action="host-event-workspace-submit" data-command="${escapeHtml(intent)}" ${locked || !available || intent === "review" ? "disabled" : ""}>${hostEventWorkspaceIsPending(workspace) ? "处理中…" : intent === "execute" ? "确认并执行" : intent === "dismiss" ? "确认拒绝" : intent === "delay" ? "确认延迟" : "请选择处理方式"}</button>
    </div>
  </aside>`;
}

export function renderHostEventWorkspace() {
  const workspace = state.hostEventWorkspace;
  if (!workspace || !hostEventWorkspaceContextIsCurrent(workspace, getRoomId())) return "";
  const event = workspace.event;
  const available = hostEventStillAvailable(workspace, state.cloudHostEvents || []);
  const roleIds = relatedRoleIds(event);
  const actions = event.actionSummaries.length
    ? event.actionSummaries
    : event.actions.map((action) => action?.type || "未命名动作");
  return `<section class="host-event-workspace" data-host-event-workspace aria-labelledby="host-event-workspace-title">
    <header class="host-event-workspace-head">
      <div><p class="section-kicker">EVENT REVIEW WORKSPACE</p><h2 id="host-event-workspace-title">待确认事件审阅</h2><p>${escapeHtml(event.sourceLabel)} · ${escapeHtml(event.ruleName || "无关联自动化规则")}</p></div>
      <button type="button" class="secondary-btn" data-action="host-event-workspace-close" ${hostEventWorkspaceIsPending(workspace) ? "disabled" : ""}>返回监控台</button>
    </header>
    <div class="host-event-workspace-facts">
      <article><span>状态</span><strong>${escapeHtml(event.status === "delayed" ? "已延迟" : available ? "待确认" : "已离开队列")}</strong></article>
      <article><span>触发时间</span><strong>${escapeHtml(event.createdAt ? formatRelativeTime(event.createdAt) : "未知")}</strong></article>
      <article><span>规则模式</span><strong>${escapeHtml(event.ruleMode || "人工判断")}</strong></article>
      <article><span>关联席位</span><strong>${roleIds.length || "全房间"}</strong></article>
    </div>
    ${event.delayUntil ? `<div class="host-event-delay-note">预计 ${escapeHtml(formatTime(event.delayUntil))} 重新进入待确认队列</div>` : ""}
    ${!available && workspace.status !== "success" ? `<div class="host-event-stale" role="alert">该事件已不在当前待办列表，可能被其他主持处理。请勿继续提交。</div>` : ""}
    ${statusHtml(workspace)}
    <div class="host-event-workspace-grid">
      <main class="host-event-review">
        <section><p class="section-kicker">TRIGGER</p><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.description || "无补充说明")}</p></section>
        <section><h4>关联玩家</h4><div class="host-event-role-list">${roleIds.length
          ? roleIds.map((roleId) => `<button type="button" class="secondary-btn" data-action="host-player-detail" data-role="${escapeHtml(roleId)}">${escapeHtml(playerLabel(roleId))}</button>`).join("")
          : `<span class="status-chip draft">全房间事件</span>`}</div></section>
        <section><h4>确认后将执行</h4><div class="host-event-action-list">${actions.length
          ? actions.map((item, index) => `<article><span>${index + 1}</span><p>${escapeHtml(item)}</p></article>`).join("")
          : `<div class="empty-state">该事件没有可执行动作，建议拒绝或返回规则配置检查。</div>`}</div></section>
        <details class="host-event-technical-context"><summary>查看技术上下文</summary><div><h4>触发条件</h4><pre>${escapeHtml(safeJson(event.ruleConditions))}</pre><h4>动作载荷</h4><pre>${escapeHtml(safeJson(event.actions))}</pre></div></details>
      </main>
      ${commandPanel(workspace, available)}
    </div>
  </section>`;
}
