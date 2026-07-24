import { state } from "../state.js";
import {
  HOST_OPERATION_KINDS,
  HOST_OPERATION_LIMITS,
  HOST_OPERATION_TABS,
  grantModeLabel,
  hostOperationContextIsCurrent,
  hostOperationIsPending,
  hostOperationIsSubmitting,
  joinedHostPlayers,
  sectionOptionsForRole
} from "../runtime/host-operation-model.js";
import { escapeHtml, formatTime, hostOperationLabel } from "../utils/format.js";

function optionsHtml(items, selected, emptyLabel = "暂无可选内容") {
  if (!items.length) return `<option value="">${escapeHtml(emptyLabel)}</option>`;
  return items
    .map((item) => `<option value="${escapeHtml(item.id)}"${String(item.id) === String(selected) ? " selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
}

function fieldSelect(label, field, items, selected, emptyLabel) {
  return `<label>${escapeHtml(label)}
    <select class="field" data-host-operation-field="${escapeHtml(field)}">
      ${optionsHtml(items, selected, emptyLabel)}
    </select>
  </label>`;
}

function operationTabsHtml(operation) {
  const submitting = hostOperationIsSubmitting(operation);
  return `<nav class="host-operation-tabs" aria-label="主持现场操作">
    ${HOST_OPERATION_TABS.map((tab) => `<button type="button" class="host-operation-tab${operation.kind === tab.kind ? " is-active" : ""}" data-action="host-operation-switch" data-operation-kind="${escapeHtml(tab.kind)}"${submitting ? " disabled" : ""}>${escapeHtml(tab.label)}</button>`).join("")}
  </nav>`;
}

function operationStatusHtml(operation) {
  const tone = operation.status === "error"
    ? "error"
    : operation.status === "success"
      ? "success"
      : operation.status === "submitting" || operation.status === "loading"
        ? "pending"
        : "";
  if (!tone && !operation.message) return "";
  const message = operation.message || (operation.status === "loading" ? "正在加载玩家当前状态…" : "正在提交，操作完成前请勿重复点击。");
  return `<div class="host-operation-status ${tone}" role="${tone === "error" ? "alert" : "status"}">${escapeHtml(message)}</div>`;
}

function operationConfirmHtml(operation) {
  if (!operation.confirm) return "";
  return `<section class="host-operation-confirm" aria-label="操作确认">
    <div>
      <p class="section-kicker">CONFIRM</p>
      <strong>${escapeHtml(operation.confirm.title || "确认操作")}</strong>
      <p>${escapeHtml(operation.confirm.detail || "")}</p>
    </div>
    <div class="row">
      <button type="button" class="secondary-btn" data-action="host-operation-confirm-cancel">取消</button>
      <button type="button" class="primary-btn${operation.confirm.danger ? " danger-btn" : ""}" data-action="host-operation-confirm-execute">${escapeHtml(operation.confirm.label || "确认执行")}</button>
    </div>
  </section>`;
}

function submitButton(operation, label, disabled = false) {
  const pending = hostOperationIsSubmitting(operation);
  return `<button type="button" class="primary-btn" data-action="host-operation-submit"${pending || disabled ? " disabled" : ""}>${pending ? "正在提交…" : escapeHtml(label)}</button>`;
}

function grantClueHtml(operation) {
  const players = joinedHostPlayers(state);
  const selectedRoles = new Set((operation.draft.roleSlotIds || []).map(String));
  const clues = (state.studio?.clues || [])
    .slice()
    .sort((a, b) => Number(String(b.id) === operation.draft.clueId) - Number(String(a.id) === operation.draft.clueId)
      || String(a.name || "").localeCompare(String(b.name || "")))
    .map((clue) => {
      const mode = grantModeLabel(clue.metadata?.grantMode);
      return { id: String(clue.id), name: `${clue.name}${mode && clue.metadata?.grantMode !== "auto" ? ` · ${mode}` : ""}` };
    });
  return `<div class="host-operation-form">
    <div class="host-operation-copy"><strong>手动发放线索</strong><p>每位玩家独立获得线索访问权；相同命令的短时重试由房间级幂等保护，不会重复创建所有权。</p></div>
    ${fieldSelect("线索", "clueId", clues, operation.draft.clueId, "当前剧本尚无线索")}
    <fieldset class="host-operation-picker">
      <legend>目标玩家（可多选）</legend>
      ${players.map((player) => `<label><input type="checkbox" data-host-operation-field="roleSlotIds" value="${escapeHtml(player.role_slot_id)}"${selectedRoles.has(String(player.role_slot_id)) ? " checked" : ""}> <span><b>${escapeHtml(player.player_display_name || "玩家")}</b> · ${escapeHtml(player.role_name)}</span></label>`).join("") || `<p>当前没有已入房玩家。</p>`}
    </fieldset>
    <label>日志说明<input class="field" data-host-operation-field="message" value="${escapeHtml(operation.draft.message || "")}" maxlength="500"></label>
    <div class="host-operation-actions">${submitButton(operation, "确认发放", !players.length || !clues.length)}</div>
  </div>`;
}

function grantItemHtml(operation) {
  const players = joinedHostPlayers(state);
  const items = (state.studio?.items || []).map((item) => ({ id: String(item.id), name: item.name }));
  return `<div class="host-operation-form">
    <div class="host-operation-copy"><strong>手动发放物品</strong><p>物品写入目标角色背包，并可能触发依赖 item_owned 的自动化规则。</p></div>
    ${fieldSelect("目标玩家", "roleSlotId", players.map((player) => ({ id: String(player.role_slot_id), name: `${player.player_display_name || "玩家"} · ${player.role_name}` })), operation.draft.roleSlotId, "当前没有已入房玩家")}
    ${fieldSelect("物品", "itemId", items, operation.draft.itemId, "当前剧本尚无物品")}
    <label>数量<input class="field" type="number" min="1" max="99" step="1" data-host-operation-field="quantity" value="${escapeHtml(operation.draft.quantity || "1")}"></label>
    <label>日志说明<input class="field" data-host-operation-field="message" value="${escapeHtml(operation.draft.message || "")}" maxlength="500"></label>
    <div class="host-operation-actions">${submitButton(operation, "确认发放", !players.length || !items.length)}</div>
  </div>`;
}

function unlockSectionHtml(operation) {
  const players = joinedHostPlayers(state);
  const sections = state.studio?.sections || [];
  const sectionOptions = sectionOptionsForRole(sections, operation.draft.roleSlotId, operation.options.actKey || "");
  return `<div class="host-operation-form">
    <div class="host-operation-copy"><strong>手动解锁私人分幕</strong><p>解锁后对应玩家立即可读；本操作会写入时间线和审计，并通过 SSE 通知 Player。</p></div>
    ${fieldSelect("目标玩家", "roleSlotId", players.map((player) => ({ id: String(player.role_slot_id), name: `${player.player_display_name || "玩家"} · ${player.role_name}` })), operation.draft.roleSlotId, "当前没有已入房玩家")}
    ${fieldSelect("私人分幕", "sectionId", sectionOptions, operation.draft.sectionId, "该角色尚无私人分幕")}
    <label>日志说明<input class="field" data-host-operation-field="message" value="${escapeHtml(operation.draft.message || "")}" maxlength="500"></label>
    <div class="host-operation-actions">${submitButton(operation, "确认解锁", !sectionOptions.length)}</div>
  </div>`;
}

function unlockSceneHtml(operation) {
  const scenes = (state.studio?.scenes || []).map((scene) => ({ id: String(scene.id), name: scene.name }));
  return `<div class="host-operation-form">
    <div class="host-operation-copy"><strong>开放公共场景</strong><p>开放后所有已入房玩家都能在探索页看到该场景。</p></div>
    ${fieldSelect("场景", "sceneId", scenes, operation.draft.sceneId, "当前剧本尚无场景")}
    <div class="host-operation-actions">${submitButton(operation, "确认开放", !scenes.length)}</div>
  </div>`;
}

function hostLogHtml(operation) {
  const players = joinedHostPlayers(state);
  const options = [{ id: "", name: "不指定角色" }, ...players.map((player) => ({
    id: String(player.role_slot_id),
    name: `${player.player_display_name || "玩家"} · ${player.role_name}`
  }))];
  return `<div class="host-operation-form">
    <div class="host-operation-copy"><strong>添加主持日志</strong><p>日志会写入本房间时间线并保留主持审计；不会把主持备注正文推送给玩家。</p></div>
    ${fieldSelect("关联角色", "roleSlotId", options, operation.draft.roleSlotId)}
    <label>日志内容<textarea class="field" rows="5" maxlength="${HOST_OPERATION_LIMITS.HOST_LOG_LENGTH}" data-host-operation-field="message" placeholder="例如：提醒林夏继续阅读序章">${escapeHtml(operation.draft.message || "")}</textarea></label>
    <div class="host-operation-actions">${submitButton(operation, "写入日志", !String(operation.draft.message || "").trim())}</div>
  </div>`;
}

function nudgeHtml(operation) {
  const players = joinedHostPlayers(state);
  const selectedRoles = new Set((operation.draft.roleSlotIds || []).map(String));
  return `<div class="host-operation-form">
    <div class="host-operation-copy"><strong>提醒等待或卡关玩家</strong><p>消息只通过当前房间实时推送发送到目标 Player；断线玩家会在游标恢复或轮询刷新后重新同步状态。</p></div>
    <label>提醒内容<textarea class="field" rows="4" maxlength="500" data-host-operation-field="message">${escapeHtml(operation.draft.message || "")}</textarea></label>
    <fieldset class="host-operation-picker">
      <legend>通知对象</legend>
      ${players.map((player) => `<label><input type="checkbox" data-host-operation-field="roleSlotIds" value="${escapeHtml(player.role_slot_id)}"${selectedRoles.has(String(player.role_slot_id)) ? " checked" : ""}> <span><b>${escapeHtml(player.player_display_name || "玩家")}</b> · ${escapeHtml(player.role_name)}${player.stuck_label ? ` · ${escapeHtml(player.stuck_label)}` : ""}</span></label>`).join("") || `<p>当前没有已入房玩家。</p>`}
    </fieldset>
    <div class="host-operation-actions">${submitButton(operation, "发送提醒", !players.length)}</div>
  </div>`;
}

function clueNoteHtml(operation) {
  const matrix = state.cloudHostClueMatrix;
  const clue = (matrix?.clues || []).find((item) => String(item.id) === String(operation.draft.clueId));
  const player = (matrix?.players || []).find((item) => String(item.role_slot_id) === String(operation.draft.roleSlotId));
  return `<div class="host-operation-form">
    <div class="host-operation-copy"><strong>线索主持备注</strong><p>${escapeHtml(player?.player_display_name || player?.role_name || "未知玩家")} · ${escapeHtml(clue?.name || "未知线索")}。备注仅主持端可见。</p></div>
    <label>备注内容<textarea class="field" rows="6" maxlength="2000" data-host-operation-field="hostNote">${escapeHtml(operation.draft.hostNote || "")}</textarea></label>
    <div class="host-operation-actions">${submitButton(operation, "保存备注", !clue || !player)}</div>
  </div>`;
}

function detailActionButton({ command, label, roleSlotId, sectionId, clueId, danger = false }) {
  return `<button type="button" class="text-btn${danger ? " danger-text" : ""}" data-action="host-operation-detail-command" data-command="${escapeHtml(command)}"${roleSlotId ? ` data-role="${escapeHtml(roleSlotId)}"` : ""}${sectionId ? ` data-section="${escapeHtml(sectionId)}"` : ""}${clueId ? ` data-clue="${escapeHtml(clueId)}"` : ""}>${escapeHtml(label)}</button>`;
}

function playerDetailHtml(operation) {
  if (operation.status === "loading" && !operation.detail) {
    return `<div class="host-operation-loading"><strong>正在加载玩家当前状态…</strong><p>读取分幕、线索、调查、笔记和最近主持操作。</p></div>`;
  }
  if (!operation.detail) {
    return `<div class="empty-state">玩家详情暂不可用。可保留当前工作台并点击重新加载。</div>
      <div class="host-operation-actions"><button type="button" class="secondary-btn" data-action="host-operation-reload-player">重新加载</button></div>`;
  }
  const detail = operation.detail;
  const role = detail.role || {};
  const roleSlotId = String(operation.options.roleSlotId || "");
  const sections = detail.sections || [];
  const clues = detail.clues || [];
  return `<div class="host-player-inspector">
    <section class="host-player-summary">
      <div>
        <p class="section-kicker">PLAYER KNOWLEDGE</p>
        <h3>${escapeHtml(role.player_display_name || role.name || "空置席位")} · ${escapeHtml(role.name || "")}</h3>
        <p>${escapeHtml(role.public_profile || "尚未补充公开身份")}</p>
      </div>
      <div class="host-player-summary-facts">
        <span><b>${sections.filter((item) => item.completed).length}/${sections.length}</b> 分幕完成</span>
        <span><b>${clues.length}</b> 已获线索</span>
        <span><b>${(detail.investigations || []).length}</b> 调查记录</span>
      </div>
    </section>
    <aside class="host-operation-notice"><strong>该玩家现在知道什么</strong><p>下方汇总其可读分幕、已获得线索、调查、笔记与最近操作。撤回只移除当前访问权，不会抹去玩家记忆、笔记或审计历史。</p></aside>
    <div class="host-player-knowledge-grid">
      <section><h4>分幕进度</h4><div class="host-detail-list">${sections.map((section) => {
        const readable = section.unlocked || Number(section.sequence) === 1;
        const status = section.completed ? "已完成" : readable ? "可阅读" : "未解锁";
        const actions = [
          !section.completed && !readable ? detailActionButton({ command: "unlock-section", label: "解锁", roleSlotId, sectionId: section.id }) : "",
          !section.completed ? detailActionButton({ command: "skip-section", label: "跳过并完成", roleSlotId, sectionId: section.id }) : "",
          section.unlocked && Number(section.sequence) > 1 ? detailActionButton({ command: "relock-section", label: "撤回", roleSlotId, sectionId: section.id, danger: true }) : ""
        ].join("");
        return `<article class="host-detail-row"><div><strong>${escapeHtml(section.sequence)}. ${escapeHtml(section.title)}</strong><p>${escapeHtml(status)} · ${escapeHtml(section.publication_status || "")}</p></div><div class="row">${section.completed ? `<span class="status-chip published">完成</span>` : ""}${actions}</div></article>`;
      }).join("") || `<div class="empty-state">尚无私人分幕。</div>`}</div></section>
      <section><h4>线索 · ${clues.length}</h4><div class="host-detail-list">${clues.map((clue) => `<article class="host-detail-row"><div><strong>${escapeHtml(clue.name)}</strong><p>${clue.read_at ? "已阅读" : "未阅读"}${clue.shared_with_room ? " · 已公开" : ""} · ${formatTime(clue.acquired_at)}</p>${clue.player_note ? `<small>玩家解读：${escapeHtml(clue.player_note)}</small>` : ""}${clue.host_note ? `<small>主持备注：${escapeHtml(clue.host_note)}</small>` : ""}</div><div class="row">${detailActionButton({ command: "resend-clue", label: "补发", roleSlotId, clueId: clue.id })}${detailActionButton({ command: "revoke-clue", label: "撤回", roleSlotId, clueId: clue.id, danger: true })}</div></article>`).join("") || `<div class="empty-state">尚未获得线索。</div>`}</div></section>
      <section><h4>调查记录 · ${(detail.investigations || []).length}</h4><div class="host-detail-list">${(detail.investigations || []).map((item) => `<article class="host-detail-row"><strong>${escapeHtml(item.point_name)}</strong><p>${escapeHtml(item.scene_name)} · ${formatTime(item.investigated_at)}</p></article>`).join("") || `<div class="empty-state">尚无调查记录。</div>`}</div></section>
      <section><h4>玩家笔记 · ${(detail.notes || []).length}</h4><div class="host-detail-list">${(detail.notes || []).slice(0, 8).map((note) => `<article class="host-detail-row"><strong>${escapeHtml(note.title)}</strong><p>${escapeHtml(String(note.body || "").slice(0, 120))}</p></article>`).join("") || `<div class="empty-state">尚无笔记。</div>`}</div></section>
      <section class="host-player-log-section"><h4>最近操作</h4><div class="host-detail-list">${(detail.recentLogs || []).slice(0, 10).map((log) => `<article class="host-detail-row"><strong>${escapeHtml(hostOperationLabel(log.event_type, log.message))}</strong><p>${escapeHtml(log.message || "")} · ${formatTime(log.created_at)}</p></article>`).join("") || `<div class="empty-state">尚无相关日志。</div>`}</div></section>
    </div>
    <section class="host-player-note-editor">
      <label>主持私密备注<textarea class="field" rows="4" maxlength="${HOST_OPERATION_LIMITS.PLAYER_NOTES_LENGTH}" data-host-operation-field="hostNotes">${escapeHtml(operation.draft.hostNotes || "")}</textarea></label>
      <div class="host-operation-actions">
        ${role.player_display_name ? `<button type="button" class="secondary-btn danger-text" data-action="host-operation-detail-command" data-command="kick-player" data-role="${escapeHtml(roleSlotId)}">移出玩家</button>` : ""}
        <button type="button" class="primary-btn" data-action="host-operation-save-player-notes"${hostOperationIsPending(operation) ? " disabled" : ""}>保存备注</button>
      </div>
    </section>
  </div>`;
}

function operationBodyHtml(operation) {
  switch (operation.kind) {
    case HOST_OPERATION_KINDS.PLAYER: return playerDetailHtml(operation);
    case HOST_OPERATION_KINDS.GRANT_CLUE: return grantClueHtml(operation);
    case HOST_OPERATION_KINDS.GRANT_ITEM: return grantItemHtml(operation);
    case HOST_OPERATION_KINDS.UNLOCK_SECTION: return unlockSectionHtml(operation);
    case HOST_OPERATION_KINDS.UNLOCK_SCENE: return unlockSceneHtml(operation);
    case HOST_OPERATION_KINDS.LOG: return hostLogHtml(operation);
    case HOST_OPERATION_KINDS.NUDGE: return nudgeHtml(operation);
    case HOST_OPERATION_KINDS.CLUE_NOTE: return clueNoteHtml(operation);
    default: return `<div class="empty-state">未知主持操作。</div>`;
  }
}

function operationTitle(operation) {
  return {
    [HOST_OPERATION_KINDS.PLAYER]: "玩家状态与干预",
    [HOST_OPERATION_KINDS.GRANT_CLUE]: "线索发放",
    [HOST_OPERATION_KINDS.GRANT_ITEM]: "物品发放",
    [HOST_OPERATION_KINDS.UNLOCK_SECTION]: "私人分幕解锁",
    [HOST_OPERATION_KINDS.UNLOCK_SCENE]: "公共场景开放",
    [HOST_OPERATION_KINDS.LOG]: "主持日志",
    [HOST_OPERATION_KINDS.NUDGE]: "玩家提醒",
    [HOST_OPERATION_KINDS.CLUE_NOTE]: "线索主持备注"
  }[operation.kind] || "主持现场操作";
}

export function renderHostOperationWorkspace() {
  const operation = state.hostOperation;
  if (!operation || !hostOperationContextIsCurrent(operation, state.room?.id)) return "";
  const submitting = hostOperationIsSubmitting(operation);
  return `<section class="host-operation-workspace" data-host-operation-workspace data-operation-kind="${escapeHtml(operation.kind)}" aria-labelledby="host-operation-title">
    <header class="host-operation-head">
      <div>
        <p class="section-kicker">LIVE OPERATION</p>
        <h2 id="host-operation-title">${escapeHtml(operationTitle(operation))}</h2>
        <p>操作固定绑定当前运行房；提交后由服务端事务、审计、SSE 和轮询共同保证三端最终一致。</p>
      </div>
      <div class="host-operation-head-actions">
        <span class="status-chip ${state.roomEventsConnected ? "published" : "testing"}">${state.roomEventsConnected ? "SSE 已连接" : "轮询补偿中"}</span>
        <button type="button" class="secondary-btn" data-action="host-operation-close"${submitting ? " disabled" : ""}>返回监控台</button>
      </div>
    </header>
    ${operationTabsHtml(operation)}
    ${operationStatusHtml(operation)}
    <div class="host-operation-body">${operationBodyHtml(operation)}</div>
    ${operationConfirmHtml(operation)}
  </section>`;
}
