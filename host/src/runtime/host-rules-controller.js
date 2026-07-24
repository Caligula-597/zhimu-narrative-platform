import { api } from "../api.js";
import { activeRuntimeRoom } from "../components/ui.js";
import { state } from "../state.js";
import { escapeHtml, rulePreviewStatusLabel } from "../utils/format.js";
import { hostRuleModeLabel } from "./host-rule-workspace-model.js";
import { resolveHostWorldAccess } from "./host-rule-permissions.js";
import { refreshHostRoom } from "./data.js";

let renderRef = () => {};
let showToastRef = () => {};

export function bindHostRulesContext({ render, showToast }) {
  renderRef = render;
  showToastRef = showToast;
}

function render() { renderRef(); }
function showToast(message) { showToastRef(message); }

function ruleSummary(rule) {
  const conditions = JSON.stringify(rule.conditions || {});
  const actions = JSON.stringify(rule.actions || []);
  return `<small>当 ${escapeHtml(conditions.slice(0, 90))}${conditions.length > 90 ? "…" : ""}</small><small>则 ${escapeHtml(actions.slice(0, 90))}${actions.length > 90 ? "…" : ""}</small>`;
}

function ruleAuditHtml() {
  const audit = state.hostRuleAudit;
  if (!audit) return "";
  if (audit.status === "loading") {
    return `<section class="host-rule-audit pending" role="status">${escapeHtml(audit.message || "正在检查全部规则…")}</section>`;
  }
  if (audit.status === "error") {
    return `<section class="host-rule-audit error" role="alert">${escapeHtml(audit.message || "规则检查失败")}</section>`;
  }
  if (!audit.checks.length) {
    return `<section class="host-rule-audit success"><strong>全部规则检查通过</strong><p>已检查 ${Number(audit.totalRules) || 0} 条规则，没有发现结构或发布阻断问题。</p></section>`;
  }
  return `<section class="host-rule-audit warning"><strong>发现 ${audit.checks.length} 项需要处理</strong><div>${audit.checks.map((check) => `<article><b>${escapeHtml(check.title || "规则问题")}</b><p>${escapeHtml(check.detail || "")}</p></article>`).join("")}</div></section>`;
}

function deleteConfirmation(rule) {
  if (String(state.hostRuleDeleteConfirmId || "") !== String(rule.id)) return "";
  return `<section class="host-rule-delete-confirm">
    <div><strong>确认删除「${escapeHtml(rule.name)}」？</strong><p>删除会立即影响当前世界和绑定房间，历史审计不会被抹除。</p></div>
    <div class="row"><button class="secondary-btn" data-action="host-rule-delete-cancel">取消</button><button class="primary-btn danger-btn" data-action="host-rule-delete-confirm" data-rule="${escapeHtml(rule.id)}">确认删除</button></div>
  </section>`;
}

export function hostRulesManager() {
  const room = activeRuntimeRoom();
  const access = resolveHostWorldAccess();
  const canEdit = access.canEditRules;
  const currentRules = (state.rules || []).filter((rule) => !rule.room_id || rule.room_id === room?.id);
  const busy = Boolean(state.hostRuleListBusy);
  const rows = currentRules.length
    ? currentRules.map((rule) => {
      const editing = String(state.hostRuleWorkspace?.ruleId || "") === String(rule.id);
      const rowBusy = String(state.hostRuleListBusy || "").endsWith(`:${rule.id}`);
      const editorActions = canEdit
        ? `<div class="row">${editing ? `<span class="status-chip testing">正在编辑</span>` : ""}<button class="text-btn" data-action="host-rule-toggle" data-rule="${escapeHtml(rule.id)}" ${busy || editing ? "disabled" : ""}>${rule.enabled ? "暂停" : "启用"}</button><button class="text-btn" data-action="host-rule-edit" data-rule="${escapeHtml(rule.id)}" ${busy ? "disabled" : ""}>编辑</button><button class="text-btn danger-text" data-action="host-rule-delete-request" data-rule="${escapeHtml(rule.id)}" ${busy || editing ? "disabled" : ""}>删除</button></div>`
        : `<span class="status-chip draft">${escapeHtml(access.label)} · 只读</span>`;
      return `<div class="checkpoint-row host-rule-row" ${rowBusy ? 'aria-busy="true"' : ""}><div><strong>${escapeHtml(rule.name)}</strong><p>${escapeHtml(hostRuleModeLabel(rule.mode))} · ${rule.enabled ? "已启用" : "已暂停"} · ${escapeHtml(rule.room_name || "世界模板")} · 优先级 ${Number(rule.priority) || 100}</p>${ruleSummary(rule)}</div>${editorActions}${canEdit ? deleteConfirmation(rule) : ""}</div>`;
    }).join("")
    : `<div class="empty-state">当前房间没有可用规则。可以新建世界模板规则，或绑定到当前房间。</div>`;
  const accessNote = canEdit
    ? ""
    : `<div class="host-rule-list-message" role="note">当前身份为 ${escapeHtml(access.label)}：可以查看规则与运行预览，写入操作仅限拥有者和编辑者。</div>`;
  return `<div class="host-detail-list host-rule-manager"><p class="section-kicker">规则管理</p>${accessNote}${state.hostRuleListMessage ? `<div class="host-rule-list-message" role="status">${escapeHtml(state.hostRuleListMessage)}</div>` : ""}${ruleAuditHtml()}${rows}</div>`;
}

export function hostRuleManagerHeaderActions() {
  const editorActions = resolveHostWorldAccess().canEditRules
    ? `<button class="secondary-btn" data-action="host-rule-new">新建</button><button class="secondary-btn" data-action="host-rule-validate">检查</button>`
    : "";
  return `<button class="secondary-btn" data-action="rules-preview">刷新预览</button>${editorActions}`;
}

function rulePreviewTraceRows(row) {
  if (row.conditionsMet !== false || !row.failedConditions?.length) return "";
  return `<ul class="rule-trace-list">${row.failedConditions.map((leaf) => `<li class="rule-trace-fail">${escapeHtml(leaf.label || leaf.type || "条件未满足")}</li>`).join("")}</ul>`;
}

export function directorRulesPreview() {
  const preview = state.cloudRulesPreview;
  if (!preview) return `<div class="empty-state">点击「刷新预览」查看当前房间中启用规则的条件评估结果。</div>`;
  if (!preview.length) return `<div class="empty-state">当前平行房没有启用的运行规则。</div>`;
  return `<div class="host-detail-list">${preview.map((row) => `<div class="checkpoint-row"><strong>${escapeHtml(row.name)}</strong><p>${escapeHtml(rulePreviewStatusLabel(row.status))}${row.conditionsMet === false ? " · 条件未满足" : ""}</p>${rulePreviewTraceRows(row)}${row.status === "manual_ready" ? `<button class="text-btn" data-action="rule-manual-trigger" data-rule="${escapeHtml(row.id)}">立即触发</button>` : ""}</div>`).join("")}</div>`;
}

export async function refreshRulesPreview() {
  if (!activeRuntimeRoom()) return showToast("请先选择运行房");
  try {
    const result = await api.previewRoomRules();
    state.cloudRulesPreview = result.rules || [];
    render();
    showToast("规则预览已更新");
  } catch (error) {
    showToast(error.message);
  }
}

export async function triggerManualRuleFromDirector(ruleId) {
  if (!activeRuntimeRoom()) return showToast("请先选择运行房");
  try {
    await api.triggerManualRule(ruleId);
    await refreshRulesPreview();
    await refreshHostRoom();
    showToast("手动规则已执行");
  } catch (error) {
    showToast(error.message);
  }
}
