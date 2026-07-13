import { api } from "../api.js";
import { activeRuntimeRoom } from "../components/ui.js";
import {
  closeModal,
  modalEl,
  mountModal,
  openModal,
  studioField,
  studioSelect,
  studioValues
} from "../components/modal.js";
import { state } from "../state.js";
import { escapeHtml, rulePreviewStatusLabel } from "../utils/format.js";
import { setHtml } from "../../../shared/safe-dom.js";
import { refreshHostRoom } from "./data.js";

let renderRef = () => {};
let showToastRef = () => {};

export function bindHostRulesContext({ render, showToast }) {
  renderRef = render;
  showToastRef = showToast;
}

function render() { renderRef(); }
function showToast(message) { showToastRef(message); }

function ruleModeLabel(mode) {
  return { automatic: "自动执行", host_confirm: "主持确认", manual: "仅手动" }[mode]
    || mode
    || "自动执行";
}

function ruleSummary(rule) {
  const conditions = JSON.stringify(rule.conditions || {});
  const actions = JSON.stringify(rule.actions || []);
  return `<small>当 ${escapeHtml(conditions.slice(0, 90))}${conditions.length > 90 ? "…" : ""}</small><small>则 ${escapeHtml(actions.slice(0, 90))}${actions.length > 90 ? "…" : ""}</small>`;
}

export function hostRulesManager() {
  const room = activeRuntimeRoom();
  const currentRules = (state.rules || []).filter((rule) => !rule.room_id || rule.room_id === room?.id);
  const rows = currentRules.length
    ? currentRules.map((rule) => `<div class="checkpoint-row"><div><strong>${escapeHtml(rule.name)}</strong><p>${escapeHtml(ruleModeLabel(rule.mode))} · ${rule.enabled ? "已启用" : "已暂停"} · ${escapeHtml(rule.room_name || "世界模板")} · 优先级 ${Number(rule.priority) || 100}</p>${ruleSummary(rule)}</div><div class="row"><button class="text-btn" data-action="host-rule-toggle" data-rule="${escapeHtml(rule.id)}">${rule.enabled ? "暂停" : "启用"}</button><button class="text-btn" data-action="host-rule-edit" data-rule="${escapeHtml(rule.id)}">编辑</button><button class="text-btn danger-text" data-action="host-rule-delete" data-rule="${escapeHtml(rule.id)}">删除</button></div></div>`).join("")
    : `<div class="empty-state">当前房间没有可用规则。可以新建世界模板规则，或绑定到当前房间。</div>`;
  return `<div class="host-detail-list" style="margin-top:12px"><p class="section-kicker">规则管理</p>${rows}</div>`;
}

function ruleEditorValue(rule = {}) {
  return {
    roomId: rule.room_id || "",
    name: rule.name || "",
    mode: rule.mode || "automatic",
    priority: String(rule.priority ?? 100),
    enabled: rule.enabled !== false,
    conditions: JSON.stringify(rule.conditions || { all: [{ type: "reading_completed", roleSlotId: "", scriptSectionId: "" }] }, null, 2),
    actions: JSON.stringify(rule.actions || [{ type: "timeline_log", message: "主持端新建规则" }], null, 2)
  };
}

async function refreshHostRules() {
  state.rules = await api.getRules();
  render();
}

function showRuleEditorErrors(errors = []) {
  const box = modalEl.root.querySelector("[data-host-rule-errors]");
  if (!box) return;
  if (!errors.length) {
    setHtml(box, "");
    box.classList.remove("show");
    return;
  }
  box.classList.add("show");
  setHtml(box, `<strong>请修正以下问题：</strong><ul>${errors.map((item) => `<li>${escapeHtml(item.message || String(item))}</li>`).join("")}</ul>`);
}

export function openHostRuleEditor(ruleId = "") {
  const rule = (state.rules || []).find((item) => item.id === ruleId);
  const value = ruleEditorValue(rule);
  const rooms = state.rooms || [];
  mountModal();
  modalEl.root.className = "modal rule-editor-modal";
  setHtml(modalEl.root, `<h2>${rule ? "编辑自动化规则" : "新建自动化规则"}</h2><p class="wizard-intro">主持端提供轻量 JSON 管理；复杂可视化编排仍可回到创作者端处理。</p><div class="form-group">${studioField("规则名称", "ruleName", "input", value.name)}${studioSelect("绑定范围", "ruleRoomId", [{ id: "", name: "世界模板 · 可复用于新房间" }, ...rooms.map((room) => ({ id: room.id, name: room.name }))], value.roomId)}${studioSelect("触发模式", "ruleMode", [{ id: "automatic", name: "自动执行" }, { id: "host_confirm", name: "主持确认" }, { id: "manual", name: "仅手动触发" }], value.mode)}${studioField("优先级", "rulePriority", "input", value.priority)}<label class="check-label"><input type="checkbox" data-host-rule-enabled ${value.enabled ? "checked" : ""}> 启用规则</label>${studioField("检测条件 JSON", "ruleConditions", "textarea", value.conditions)}${studioField("执行动作 JSON", "ruleActions", "textarea", value.actions)}</div><div data-host-rule-errors class="rule-error-box"></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-rule-submit>保存规则</button></div>`);
  modalEl.backdrop.classList.add("show");
  modalEl.root.querySelector("[data-close]").onclick = closeModal;
  modalEl.root.querySelector("[data-host-rule-submit]").onclick = async () => {
    try {
      showRuleEditorErrors([]);
      const values = studioValues();
      let conditions;
      let actions;
      try {
        conditions = JSON.parse(values.ruleConditions);
        actions = JSON.parse(values.ruleActions);
      } catch (error) {
        showRuleEditorErrors([{ message: `JSON 格式错误：${error.message}` }]);
        return;
      }
      const validation = await api.validateRuleBody({ conditions, actions });
      if (!validation.ok) {
        showRuleEditorErrors(validation.errors || []);
        return;
      }
      const payload = {
        roomId: values.ruleRoomId || null,
        name: values.ruleName,
        mode: values.ruleMode,
        priority: Number(values.rulePriority) || 100,
        enabled: modalEl.root.querySelector("[data-host-rule-enabled]").checked,
        conditions,
        actions
      };
      if (rule) await api.updateRule(rule.id, payload);
      else await api.createRule(payload);
      closeModal();
      await refreshHostRules();
      showToast("规则已保存");
    } catch (error) {
      showToast(error.message);
    }
  };
}

export async function toggleHostRule(ruleId) {
  const rule = (state.rules || []).find((item) => item.id === ruleId);
  if (!rule) return showToast("找不到规则");
  try {
    await api.updateRule(rule.id, {
      roomId: rule.room_id || null,
      name: rule.name,
      mode: rule.mode,
      priority: rule.priority,
      enabled: !rule.enabled,
      conditions: rule.conditions,
      actions: rule.actions
    });
    await refreshHostRules();
    showToast(rule.enabled ? "规则已暂停" : "规则已启用");
  } catch (error) {
    showToast(error.message);
  }
}

export async function deleteHostRule(ruleId) {
  const rule = (state.rules || []).find((item) => item.id === ruleId);
  if (!rule) return showToast("找不到规则");
  if (!window.confirm(`确定删除规则“${rule.name}”？`)) return;
  try {
    await api.deleteRule(ruleId);
    await refreshHostRules();
    showToast("规则已删除");
  } catch (error) {
    showToast(error.message);
  }
}

export async function validateHostRules() {
  try {
    const result = await api.validateRules();
    openModal(
      "规则检查完成",
      result.checks?.length
        ? result.checks.map((check) => `<b>${escapeHtml(check.title)}</b><br><span>${escapeHtml(check.detail)}</span>`).join("<br><br>")
        : `已检查 ${result.totalRules || 0} 条规则，没有发现结构问题。`,
      "知道了"
    );
  } catch (error) {
    showToast(error.message);
  }
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
