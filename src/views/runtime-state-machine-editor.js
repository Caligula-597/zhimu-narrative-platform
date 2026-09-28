/**
 * Runtime State Machine + Host Exception Remediation Editor — workspace (缺口 M).
 *
 * Covers 《长生叹》M-01~M-08 runtime state machine requirements. Each machine is a
 * chain of runtime states under host control; every state defines its entering
 * condition, host actions, next-state target, and an exception remediation note
 * for when that stage cannot advance as scripted.
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openRuntimeStateMachine()
 *   closeRuntimeStateMachine()
 *   runtimeStateMachineWorkspaceHtml(data, session)
 *   bindRuntimeStateMachine(data, session)
 */

import * as rsmApi from "../api/runtime-state-machine.js";
import { canEditWorldContent } from "../components/emptyState.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import {
  beginWriterToolSession,
  getWriterToolSession,
  clearWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import {
  buildRuntimeStateMachine,
  emptyRuntimeStateMachineDraft,
  createRuntimeState
} from "../../shared/runtime-state-machine.js";

const TOOL_TYPE = "runtime-machine";

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const s = getWriterToolSession(data);
  return s?.type === TOOL_TYPE ? s : null;
}

function nextSequence(machines) {
  return (machines || []).reduce((max, m) => Math.max(max, Number(m.sequence) || 0), 0) + 1;
}

// ── Open / Close ──
export async function openRuntimeStateMachine() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用运行时状态机");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: { machines: [] },
    draft: { ...emptyRuntimeStateMachineDraft(), states: [createRuntimeState()] },
    editingId: null,
    loading: true
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view.machines = (await rsmApi.listRuntimeStateMachines(session.worldId)) || [];
  } catch (error) {
    session.error = normalizeError(error, "读取运行时状态机失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function closeRuntimeStateMachine() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

export function openRuntimeStateMachineEditor(editingId = null) {
  const session = currentSession();
  if (!session) return;
  if (editingId) {
    const machine = session.view.machines.find((m) => m.id === editingId);
    if (!machine) return;
    session.draft = buildRuntimeStateMachine(machine);
    session.editingId = machine.id;
  } else {
    session.draft = { ...emptyRuntimeStateMachineDraft(), sequence: nextSequence(session.view.machines), states: [createRuntimeState()] };
    session.editingId = null;
  }
  render();
}

export function closeRuntimeStateMachineEditor() {
  const session = currentSession();
  if (!session) return;
  session.draft = { ...emptyRuntimeStateMachineDraft(), states: [createRuntimeState()] };
  session.editingId = null;
  render();
}

export function updateRuntimeStateMachineDraft(field, value) {
  const session = currentSession();
  if (!session) return;
  session.draft[field] = field === "sequence" ? Number(value) || 1 : value;
}

export function updateRuntimeStateDraft(index, field, value) {
  const session = currentSession();
  if (!session) return;
  const states = [...(session.draft.states || [])];
  if (states[index]) {
    states[index] = { ...states[index], [field]: value };
    session.draft.states = states;
  }
}

export function addRuntimeStateToDraft() {
  const session = currentSession();
  if (!session) return;
  session.draft.states = [...(session.draft.states || []), createRuntimeState()];
  render();
}

export function removeRuntimeStateFromDraft(index) {
  const session = currentSession();
  if (!session) return;
  session.draft.states = (session.draft.states || []).filter((_, i) => i !== index);
  render();
}

export function moveRuntimeStateInDraft(index, dir) {
  const session = currentSession();
  if (!session) return;
  const states = [...(session.draft.states || [])];
  const target = index + dir;
  if (target < 0 || target >= states.length) return;
  [states[index], states[target]] = [states[target], states[index]];
  session.draft.states = states;
  render();
}

export async function saveRuntimeStateMachineEditor() {
  const session = currentSession();
  if (!session) return;
  const d = session.draft;
  if (!d.title && !d.states?.length) {
    return showToast("请填写状态机标题或至少一个状态");
  }
  const stateList = (d.states || []).map((s) => ({
    name: s.name,
    description: s.description || "",
    condition: s.condition || "",
    action: s.action || "",
    nextState: s.nextState || "",
    remedy: s.remedy || ""
  }));
  const body = {
    title: d.title || `M-${String(d.sequence).padStart(2, "0")}`,
    sequence: Number(d.sequence) || 1,
    startState: d.startState || "",
    endState: d.endState || "",
    summary: d.summary || "",
    states: stateList
  };
  const op = session.editingId
    ? rsmApi.updateRuntimeStateMachine(session.worldId, session.editingId, body)
    : rsmApi.createRuntimeStateMachine(session.worldId, body);
  try {
    await op;
    showToast(session.editingId ? "已更新" : "已创建");
    session.editingId = null;
    session.draft = { ...emptyRuntimeStateMachineDraft(), states: [createRuntimeState()] };
    session.loading = true;
    session.view.machines = (await rsmApi.listRuntimeStateMachines(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "保存失败"));
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function deleteRuntimeStateMachine(editingId) {
  const session = currentSession();
  if (!session || !editingId) return;
  if (!confirm("确定删除这条运行时状态机？")) return;
  try {
    await rsmApi.deleteRuntimeStateMachine(session.worldId, editingId);
    showToast("已删除");
    session.view.machines = (await rsmApi.listRuntimeStateMachines(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "删除失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

// ── Render ──
export function runtimeStateMachineWorkspaceHtml(data, session) {
  if (!session) return "";
  const machines = session.view?.machines || [];

  const listHtml = machines.length
    ? `<div class="rsm-list">${machines.map(machineCardHtml).join("")}</div>`
    : `<div class="rsm-empty">暂无运行时状态机</div>`;

  return `
    <style>
      .rsm-shell{display:flex;flex-direction:column;gap:16px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .rsm-header h2{margin:0 0 4px;font-size:20px;}
      .rsm-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;}
      .rsm-header .toolbar{display:flex;gap:8px;justify-content:flex-end;}
      .rsm-list{display:flex;flex-direction:column;gap:10px;}
      .rsm-card{padding:14px;border:1px solid var(--line,#dfe7e3);border-left:3px solid #587b72;border-radius:10px;background:var(--card,#fff);}
      .rsm-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;}
      .rsm-card-top strong{font-size:15px;}
      .rsm-meta{color:var(--muted,#6b7a74);font-size:12px;margin-top:2px;}
      .rsm-states{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
      .rsm-state-chip{padding:4px 10px;border-radius:8px;font-size:12px;background:#eef3f0;color:#3c514a;border:1px solid #dfe7e3;}
      .rsm-state-chip b{color:var(--ink,#22302c);}
      .rsm-remedy{margin-top:8px;padding:6px 10px;border-radius:8px;background:#fdf1f0;color:#8a2a26;font-size:12px;}
      .rsm-card-actions{display:flex;gap:4px;}
      .rsm-card-actions button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);}
      .rsm-empty,.rsm-error{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:24px;}
      .rsm-error{color:#b22d3a;}
      .rsm-editor-panel{margin-top:6px;padding:16px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px;}
      .rsm-editor-panel h3{margin:0;font-size:15px;}
      .rsm-editor-panel label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);flex:1;min-width:0;}
      .rsm-row{display:flex;gap:12px;flex-wrap:wrap;}
      .rsm-editor-panel .field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;font-size:13px;color:var(--ink,#22302c);background:var(--bg,#f7faf8);}
      .rsm-state-editor{border:1px solid var(--line,#dfe7e3);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--bg,#f7faf8);}
      .rsm-state-editor .rsm-state-head{display:flex;justify-content:space-between;align-items:center;}
      .rsm-state-editor .rsm-state-head b{font-size:12px;color:var(--muted,#6b7a74);}
      .rsm-state-tools{display:flex;gap:4px;}
      .rsm-state-tools button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);font-size:13px;}
      .rsm-panel-actions{display:flex;gap:8px;justify-content:flex-end;}
      .rsm-panel-actions .btn{padding:8px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;}
      .rsm-panel-actions .btn.primary{background:var(--accent,#587b72);color:#fff;}
      .rsm-panel-actions .btn.outline{background:transparent;border-color:var(--line,#dfe7e3);}
    </style>
    <section class="rsm-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="rsm-header">
        <h2>运行时状态机编辑器</h2>
        <p class="rsm-lede">把主持执掌过程拆成一串可推进的运行时状态。每个状态记录<strong>进入条件 → 主持操作 → 下一状态</strong>，并预置<strong>异常补救</strong>：当该阶段无法按剧本推进时，主持应如何兜底。</p>
        <div class="toolbar">
          <button type="button" class="btn primary" data-action="rsm-add">+ 新增运行时状态机</button>
          <button type="button" class="btn quiet" data-action="rsm-close">关闭</button>
        </div>
      </div>

      ${session.loading ? '<div class="loading-dots">加载中…</div>' : `<div class="rsm-list">${listHtml}</div>`}
      ${session.error && !session.editingId ? `<div class="rsm-error">${escapeHtml(session.error)}</div>` : ""}
      ${session.editingId !== undefined ? rsmEditorPanelHtml(session) : ""}
    </section>
  `;
}

function machineCardHtml(machine) {
  const states = machine.states || [];
  const chips = states.map((s, i) =>
    `<span class="rsm-state-chip">${i + 1}. <b>${escapeHtml(s.name || "状态")}</b>${s.nextState ? ` → ${escapeHtml(s.nextState)}` : ""}</span>`
  ).join("");
  const anyRemedy = states.some((s) => s.remedy);
  const actionsText = states
    .filter((s) => s.action)
    .slice(0, 3)
    .map((s) => `${s.name || "状态"}：${s.action}`).join(" ｜ ");
  return `
    <article class="rsm-card">
      <div class="rsm-card-top">
        <div>
          <strong>${escapeHtml(machine.title || "未命名状态机")}</strong>
          <p class="rsm-meta">#${Number(machine.sequence) || 0}${machine.startState ? ` · 起始：${escapeHtml(machine.startState)}` : ""}${machine.endState ? ` · 结束：${escapeHtml(machine.endState)}` : ""} ${states.length ? ` · ${states.length} 个状态` : ""}</p>
          ${machine.summary ? `<p class="rsm-meta">${escapeHtml(machine.summary)}</p>` : ""}
          ${actionsText ? `<p class="rsm-meta">主持操作：${escapeHtml(actionsText)}${states.some((s) => s.action && !s.action) ? "" : ""}</p>` : ""}
        </div>
        <div class="rsm-card-actions">
          <button type="button" data-action="rsm-edit" data-machine-id="${escapeHtml(machine.id)}" title="编辑">✎</button>
          <button type="button" data-action="rsm-delete" data-machine-id="${escapeHtml(machine.id)}" title="删除">✕</button>
        </div>
      </div>
      ${chips ? `<div class="rsm-states">${chips}</div>` : ""}
      ${anyRemedy ? `<div class="rsm-remedy">⚠ 含主持异常补救设定</div>` : ""}
    </article>
  `;
}

function rsmEditorPanelHtml(session) {
  const d = session.draft;
  const isEdit = Boolean(session.editingId);

  const statesHtml = (d.states || []).map((s, i) => `
    <div class="rsm-state-editor">
      <div class="rsm-state-head">
        <b>状态 ${i + 1}</b>
        <div class="rsm-state-tools">
          ${i > 0 ? `<button type="button" data-action="rsm-state-up" data-index="${i}">↑</button>` : ""}
          ${i < (d.states.length - 1) ? `<button type="button" data-action="rsm-state-down" data-index="${i}">↓</button>` : ""}
          <button type="button" data-action="rsm-state-remove" data-index="${i}">✕</button>
        </div>
      </div>
      <div class="rsm-row">
        <label>状态名
          <input class="field" type="text" data-rsm-state-field="${i}::name" value="${escapeHtml(s.name)}" placeholder="例如 线索未揭示" />
        </label>
        <label>下一状态
          <input class="field" type="text" data-rsm-state-field="${i}::nextState" value="${escapeHtml(s.nextState)}" placeholder="例如 真相披露" />
        </label>
      </div>
      <label>状态描述
        <textarea class="field" rows="2" data-rsm-state-field="${i}::description" placeholder="此刻剧情/世界处于什么状态…">${escapeHtml(s.description)}</textarea>
      </label>
      <label>进入条件
        <textarea class="field" rows="2" data-rsm-state-field="${i}::condition" placeholder="满足什么条件进入该状态…">${escapeHtml(s.condition)}</textarea>
      </label>
      <label>主持操作（推进该状态要做的事）
        <textarea class="field" rows="2" data-rsm-state-field="${i}::action" placeholder="主持此刻应发放的线索 / 播报 / 检查…">${escapeHtml(s.action)}</textarea>
      </label>
      <label>异常补救（本阶段无法推进时如何兜底）
        <textarea class="field" rows="2" data-rsm-state-field="${i}::remedy" placeholder="卡住时主持如何补救、绕过或提前推进…">${escapeHtml(s.remedy)}</textarea>
      </label>
    </div>
  `).join("");

  return `
    <div class="rsm-editor-panel">
      <h3>${isEdit ? "编辑运行时状态机" : "新增运行时状态机"}</h3>
      <div class="rsm-row">
        <label>状态机编号（如 M-01）
          <input class="field" type="text" data-rsm-field="title" value="${escapeHtml(d.title)}" placeholder="例如 M-01" />
        </label>
        <label>执行顺序
          <input class="field" type="number" min="0" data-rsm-field="sequence" value="${Number(d.sequence) || 1}" />
        </label>
      </div>
      <div class="rsm-row">
        <label>起始状态
          <input class="field" type="text" data-rsm-field="startState" value="${escapeHtml(d.startState)}" placeholder="初始状态名" />
        </label>
        <label>结束状态
          <input class="field" type="text" data-rsm-field="endState" value="${escapeHtml(d.endState)}" placeholder="终点状态名" />
        </label>
      </div>
      <label>状态机概述
        <textarea class="field" rows="2" data-rsm-field="summary" placeholder="这段运行从起点到终点的整体走向…">${escapeHtml(d.summary)}</textarea>
      </label>

      <div class="rsm-row">
        <label>运行时状态 <button type="button" class="btn quiet compact" data-action="rsm-state-add">+ 添加状态</button></label>
      </div>
      ${statesHtml || '<p class="rsm-empty">暂无状态</p>'}

      <div class="rsm-panel-actions">
        <button type="button" class="btn primary" data-action="rsm-save">保存</button>
        <button type="button" class="btn outline" data-action="rsm-cancel">取消</button>
      </div>
    </div>
  `;
}

// ── Bind ──
export function bindRuntimeStateMachine(data, session) {
  const root = document.querySelector(`[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";

  root.querySelector("[data-action='rsm-close']")?.addEventListener("click", closeRuntimeStateMachine);
  root.querySelector("[data-action='rsm-add']")?.addEventListener("click", () => openRuntimeStateMachineEditor(null));
  root.querySelectorAll("[data-action='rsm-edit']").forEach((el) =>
    el.addEventListener("click", () => openRuntimeStateMachineEditor(el.dataset.machineId)));
  root.querySelectorAll("[data-action='rsm-delete']").forEach((el) =>
    el.addEventListener("click", () => deleteRuntimeStateMachine(el.dataset.machineId)));

  root.querySelectorAll("[data-rsm-field]").forEach((el) => {
    const field = el.dataset.rsmField;
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateRuntimeStateMachineDraft(field, el.value));
  });

  root.querySelectorAll("[data-rsm-state-field]").forEach((el) => {
    const [indexStr, field] = el.dataset.rsmStateField.split("::");
    const index = parseInt(indexStr, 10);
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateRuntimeStateDraft(index, field, el.value));
  });

  root.querySelector("[data-action='rsm-state-add']")?.addEventListener("click", addRuntimeStateToDraft);
  root.querySelectorAll("[data-action='rsm-state-remove']").forEach((el) =>
    el.addEventListener("click", () => removeRuntimeStateFromDraft(parseInt(el.dataset.index, 10))));
  root.querySelectorAll("[data-action='rsm-state-up']").forEach((el) =>
    el.addEventListener("click", () => moveRuntimeStateInDraft(parseInt(el.dataset.index, 10), -1)));
  root.querySelectorAll("[data-action='rsm-state-down']").forEach((el) =>
    el.addEventListener("click", () => moveRuntimeStateInDraft(parseInt(el.dataset.index, 10), 1)));

  root.querySelector("[data-action='rsm-save']")?.addEventListener("click", saveRuntimeStateMachineEditor);
  root.querySelector("[data-action='rsm-cancel']")?.addEventListener("click", closeRuntimeStateMachineEditor);
}