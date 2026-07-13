import { api } from "../api.js";
import { closeModal, modalEl, mountModal, openModal } from "../components/modal.js";
import { state } from "../state.js";
import { escapeHtml, formatRelativeTime, formatTime } from "../utils/format.js";
import { setHtml } from "../../../shared/safe-dom.js";
import { refreshHostRoom } from "./data.js";

let renderRef = () => {};
let showToastRef = () => {};

export function bindHostEventQueueContext({ render, showToast }) {
  renderRef = render;
  showToastRef = showToast;
}

function render() { renderRef(); }
function showToast(message) { showToastRef(message); }

function eventRelatedRoleIds(event) {
  const ids = new Set((event.trigger_players || []).map(String));
  for (const action of event.actions || []) {
    const roleId = action.roleSlotId ?? action.role_slot_id;
    if (roleId) ids.add(String(roleId));
    for (const item of action.roleSlotIds || action.role_slot_ids || []) ids.add(String(item));
  }
  return [...ids];
}

function hostPlayerByRoleId(roleSlotId) {
  return (state.cloudHostPlayers || []).find(
    (player) => String(player.role_slot_id) === String(roleSlotId)
  );
}

export function pendingEventRoleIds() {
  const ids = new Set();
  for (const event of (state.cloudHostEvents || []).filter((row) => row.status !== "delayed")) {
    eventRelatedRoleIds(event).forEach((id) => ids.add(id));
  }
  return ids;
}

function hostEventPlayerChips(event) {
  const ids = eventRelatedRoleIds(event);
  if (!ids.length) {
    return `<div class="host-event-players"><b>关联玩家</b><span class="status-chip draft">全房间 · 确认后全员可见</span></div>`;
  }
  const chips = ids.map((id) => {
    const player = hostPlayerByRoleId(id);
    const label = player
      ? `${player.player_display_name || "玩家"} · ${player.role_name}`
      : `席位 ${String(id).slice(0, 8)}…`;
    return `<button type="button" class="host-player-chip text-btn" data-action="host-player-detail" data-role="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
  }).join("");
  return `<div class="host-event-players"><b>关联玩家</b>${chips}</div>`;
}

export function hostEventBatchToolbar() {
  const events = state.cloudHostEvents || [];
  if (!events.length) return "";
  const selected = state.hostEventSelection || [];
  const allSelected = events.length > 0 && selected.length === events.length;
  return `<div class="row host-event-batch-toolbar"><label class="check-label"><input type="checkbox" data-action="host-event-select-all" ${allSelected ? "checked" : ""}><span>全选 (${events.length})</span></label><button class="primary-btn" data-action="batch-execute-host-events" ${selected.length ? "" : "disabled"}>批量确认 (${selected.length || 0})</button><button class="secondary-btn" data-action="batch-dismiss-host-events" ${selected.length ? "" : "disabled"}>批量拒绝</button></div>`;
}

export function hostPlayerWaitStrip() {
  const events = (state.cloudHostEvents || []).filter((event) => event.status === "pending");
  if (!events.length) return "";
  const waitingIds = pendingEventRoleIds();
  const players = (state.cloudHostPlayers || []).filter(
    (player) => player.joined && waitingIds.has(String(player.role_slot_id))
  );
  const playerLine = players.length
    ? `${players.map((player) => escapeHtml(player.player_display_name || player.role_name)).join("、")} 可能在等待你确认`
    : "确认后玩家端会实时收到分幕/场景解锁通知";
  return `<section class="demo-strip host-wait-strip"><div><span class="cloud-pill">主持 ↔ 玩家</span><strong>${events.length} 条待确认 · 关联 ${waitingIds.size || "全"} 个角色席位</strong><p>${playerLine}。优先处理与卡关玩家相关的事件。</p></div><div class="row host-wait-actions"><button class="primary-btn" data-action="host-nudge-waiting">提醒等待中的玩家</button><button class="secondary-btn" data-action="refresh-host-events">刷新待办</button></div></section>`;
}

export function hostEventRows() {
  const events = state.cloudHostEvents || [];
  if (!events.length) {
    return `<div class="empty-state">当前无需人工介入。普通动作由系统自动执行，关键转折会进入这里等待主持人判断。</div>`;
  }
  const selected = new Set(state.hostEventSelection || []);
  const pending = events.filter((event) => event.status !== "delayed");
  const delayed = events.filter((event) => event.status === "delayed");
  const renderCard = (event, delayedCard = false) => `<article class="host-event-card ${delayedCard ? "host-event-delayed" : ""}"><label class="host-event-select check-label"><input type="checkbox" data-action="host-event-toggle" data-event="${escapeHtml(event.id)}" ${selected.has(event.id) ? "checked" : ""} ${delayedCard ? "disabled" : ""}></label><div class="host-event-body"><div class="host-event-head"><span class="cloud-pill">${escapeHtml(event.source_label || "系统")}</span>${delayedCard ? `<span class="status-chip testing">已延迟</span>` : ""}<strong>${escapeHtml(event.title)}</strong><small>${delayedCard && event.delay_until ? `将于 ${formatTime(event.delay_until)} 再次提醒 · ` : ""}${formatRelativeTime(event.created_at)}</small></div><p>${escapeHtml(event.description)}</p>${event.rule_name ? `<div class="rule-block"><b>来源规则</b> · ${escapeHtml(event.rule_name)}</div>` : ""}${hostEventPlayerChips(event)}${event.action_summaries?.length ? `<div class="host-event-actions-preview"><b>确认后将执行</b>${event.action_summaries.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}<div class="event-actions"><button class="primary-btn" data-action="execute-host-event" data-event="${escapeHtml(event.id)}">确认并执行</button><button class="secondary-btn" data-action="dismiss-host-event" data-event="${escapeHtml(event.id)}">拒绝</button>${delayedCard ? "" : `<button class="secondary-btn" data-action="delay-host-event" data-event="${escapeHtml(event.id)}">延迟</button>`}<button class="text-btn" data-action="host-event-context" data-event="${escapeHtml(event.id)}">查看上下文</button></div></div></article>`;
  return `${pending.map((event) => renderCard(event)).join("")}${delayed.length ? `<div class="host-events-delayed-block"><p class="section-kicker">已延迟 · ${delayed.length}</p>${delayed.map((event) => renderCard(event, true)).join("")}</div>` : ""}`;
}

export function toggleHostEventSelection(eventId, checked) {
  const selected = new Set(state.hostEventSelection || []);
  if (checked) selected.add(eventId);
  else selected.delete(eventId);
  state.hostEventSelection = [...selected];
  render();
}

export function syncHostEventSelectAll(checked) {
  const events = state.cloudHostEvents || [];
  state.hostEventSelection = checked ? events.map((row) => row.id) : [];
  render();
}

export async function batchHostEventsAction(action) {
  const ids = state.hostEventSelection || [];
  if (!ids.length) return showToast("请先勾选待处理事件");
  try {
    const result = await api.batchHostEvents(action, ids);
    state.hostEventSelection = [];
    await refreshHostRoom(true);
    render();
    const label = action === "execute" ? "确认" : "拒绝";
    showToast(`已${label} ${result.processed} 条${result.skipped ? `，${result.skipped} 条已跳过` : ""}`);
  } catch (error) {
    showToast(error.message);
  }
}

export function openHostEventContext(eventId) {
  const event = (state.cloudHostEvents || []).find((item) => item.id === eventId);
  if (!event) return;
  openModal(
    "待确认事件上下文",
    `<div class="rule-block"><b>来源</b> · ${escapeHtml(event.source_label || "系统")}<br><b>规则</b> · ${escapeHtml(event.rule_name || "—")}<br><b>触发条件</b><br>${escapeHtml(JSON.stringify(event.rule_conditions || {}, null, 2))}<br><br><b>将执行动作</b><br>${escapeHtml(JSON.stringify(event.actions || [], null, 2))}</div>`,
    "关闭"
  );
}

export function openDelayHostEventModal(eventId) {
  const event = (state.cloudHostEvents || []).find((item) => item.id === eventId);
  if (!event) return showToast("找不到待确认事件");
  mountModal();
  modalEl.root.className = "modal";
  setHtml(modalEl.root, `<h2>延迟待确认事件</h2><p class="wizard-intro">「${escapeHtml(event.title)}」将从待办列表移出，到期后自动回到待确认队列。</p><div class="form-group"><label>延迟时长</label><select class="field" data-delay-minutes><option value="5">5 分钟</option><option value="15" selected>15 分钟</option><option value="30">30 分钟</option><option value="60">1 小时</option><option value="120">2 小时</option></select></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-delay-submit>确认延迟</button></div>`);
  modalEl.backdrop.classList.add("show");
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-delay-submit]").onclick = async () => {
    try {
      const delayMinutes = Number(modalEl.root.querySelector("[data-delay-minutes]").value) || 15;
      await api.delayHostEvent(eventId, delayMinutes);
      closeModal();
      await refreshHostRoom();
      showToast(`已延迟 ${delayMinutes} 分钟`);
    } catch (error) {
      showToast(error.message);
    }
  };
}

export async function dismissHostEvent(eventId) {
  const event = (state.cloudHostEvents || []).find((item) => item.id === eventId);
  try {
    await api.dismissHostEvent(eventId);
    state.hostEventSelection = (state.hostEventSelection || []).filter((id) => id !== eventId);
    await refreshHostRoom(true);
    render();
    showToast(`已拒绝「${event?.title || "待确认事件"}」`);
  } catch (error) {
    showToast(error.message);
  }
}

export async function executeHostEvent(eventId) {
  const event = (state.cloudHostEvents || []).find((item) => item.id === eventId);
  try {
    await api.executeHostEvent(eventId);
    state.hostEventSelection = (state.hostEventSelection || []).filter((id) => id !== eventId);
    await refreshHostRoom(true);
    render();
    const preview = event?.action_summaries?.slice(0, 2).join("；") || "规则动作已写入房间";
    showToast(`已确认「${event?.title || "事件"}」· ${preview}`);
  } catch (error) {
    showToast(error.message);
  }
}
