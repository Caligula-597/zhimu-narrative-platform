/**
 * Object Lifecycle Editor — workspace (缺口7).
 *
 * A per-item lifecycle state machine following the arc 建立→变化→运行→回收.
 * Each stage defines a trigger condition, the state change it causes, and the
 * character holding the object at that stage.
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openObjectLifecycle()
 *   closeObjectLifecycle()
 *   objectLifecycleWorkspaceHtml(data, session)
 *   bindObjectLifecycle(data, session)
 */

import * as lifecycleApi from "../api/object-lifecycle.js";
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
  buildObjectLifecycle,
  emptyObjectLifecycleDraft,
  createLifecycleStage
} from "../../shared/object-lifecycle.js";

const TOOL_TYPE = "object-lifecycle";

function getItems(data) {
  return data?.items || [];
}
function itemName(data, id) {
  return getItems(data).find((i) => i.id === id)?.name || "";
}

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const s = getWriterToolSession(data);
  return s?.type === TOOL_TYPE ? s : null;
}

// ── Open / Close ──
export async function openObjectLifecycle() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用物件生命周期");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: { lifecycles: [] },
    draft: { ...emptyObjectLifecycleDraft(), stages: [createLifecycleStage()] },
    editingId: null,
    loading: true
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view.lifecycles = (await lifecycleApi.listObjectLifecycles(session.worldId)) || [];
  } catch (error) {
    session.error = normalizeError(error, "读取物件生命周期失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function closeObjectLifecycle() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

export function openObjectLifecycleEditor(editingId = null) {
  const session = currentSession();
  if (!session) return;
  if (editingId) {
    const lifecycle = session.view.lifecycles.find((l) => l.id === editingId);
    if (!lifecycle) return;
    session.draft = buildObjectLifecycle(lifecycle);
    session.editingId = lifecycle.id;
  } else {
    session.draft = { ...emptyObjectLifecycleDraft(), stages: [createLifecycleStage()] };
    session.editingId = null;
  }
  render();
}

export function closeObjectLifecycleEditor() {
  const session = currentSession();
  if (!session) return;
  session.draft = { ...emptyObjectLifecycleDraft(), stages: [createLifecycleStage()] };
  session.editingId = null;
  render();
}

export function updateObjectLifecycleDraft(field, value) {
  const session = currentSession();
  if (!session) return;
  session.draft[field] = value;
}

export function updateLifecycleStageDraft(index, field, value) {
  const session = currentSession();
  if (!session) return;
  const stages = [...(session.draft.stages || [])];
  if (stages[index]) {
    stages[index] = { ...stages[index], [field]: value };
    session.draft.stages = stages;
  }
}

export function addLifecycleStageToDraft() {
  const session = currentSession();
  if (!session) return;
  session.draft.stages = [...(session.draft.stages || []), createLifecycleStage()];
  render();
}

export function removeLifecycleStageFromDraft(index) {
  const session = currentSession();
  if (!session) return;
  session.draft.stages = (session.draft.stages || []).filter((_, i) => i !== index);
  render();
}

export function moveLifecycleStageInDraft(index, dir) {
  const session = currentSession();
  if (!session) return;
  const stages = [...(session.draft.stages || [])];
  const target = index + dir;
  if (target < 0 || target >= stages.length) return;
  [stages[index], stages[target]] = [stages[target], stages[index]];
  session.draft.stages = stages;
  render();
}

export async function saveObjectLifecycleEditor() {
  const session = currentSession();
  if (!session) return;
  const d = session.draft;
  const title = d.itemLabel ? `物件 · ${d.itemLabel}` : "未命名物件";
  if (!d.title && !d.itemLabel) {
    return showToast("请填写物件标题或至少绑定一个物证");
  }
  const stageList = (d.stages || []).map((s) => ({
    label: s.label,
    description: s.description || "",
    trigger: s.trigger || "",
    change: s.change || "",
    holder: s.holder || ""
  }));
  const body = {
    title: d.title || title,
    itemId: d.itemId || null,
    itemLabel: d.itemLabel || itemName(studioStore.get().cloudStudio, d.itemId),
    summary: d.summary,
    stages: stageList
  };
  const op = session.editingId
    ? lifecycleApi.updateObjectLifecycle(session.worldId, session.editingId, body)
    : lifecycleApi.createObjectLifecycle(session.worldId, body);
  try {
    await op;
    showToast(session.editingId ? "已更新" : "已创建");
    session.editingId = null;
    session.draft = { ...emptyObjectLifecycleDraft(), stages: [createLifecycleStage()] };
    session.loading = true;
    session.view.lifecycles = (await lifecycleApi.listObjectLifecycles(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "保存失败"));
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function deleteObjectLifecycle(editingId) {
  const session = currentSession();
  if (!session || !editingId) return;
  if (!confirm("确定删除这条物件生命周期？")) return;
  try {
    await lifecycleApi.deleteObjectLifecycle(session.worldId, editingId);
    showToast("已删除");
    session.view.lifecycles = (await lifecycleApi.listObjectLifecycles(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "删除失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

// ── Render ──
export function objectLifecycleWorkspaceHtml(data, session) {
  if (!session) return "";
  const items = getItems(data);
  const lifecycles = session.view?.lifecycles || [];

  const listHtml = lifecycles.length
    ? lifecycles.map((l) => lifecycleCardHtml(l)).join("")
    : `<div class="objlc-empty">暂无物件生命周期</div>`;

  return `
    <style>
      .objlc-shell{display:flex;flex-direction:column;gap:16px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .objlc-header h2{margin:0 0 4px;font-size:20px;}
      .objlc-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;}
      .objlc-header .toolbar{display:flex;gap:8px;justify-content:flex-end;}
      .objlc-list{display:flex;flex-direction:column;gap:10px;}
      .objlc-card{padding:14px;border:1px solid var(--line,#dfe7e3);border-left:3px solid #587b72;border-radius:10px;background:var(--card,#fff);}
      .objlc-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px;}
      .objlc-card-top strong{font-size:15px;}
      .objlc-item{color:var(--muted,#6b7a74);font-size:12px;margin-top:2px;}
      .objlc-stages{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
      .objlc-stage-chip{padding:4px 10px;border-radius:999px;font-size:12px;background:#eef3f0;color:#3c514a;}
      .objlc-stage-chip b{color:var(--ink,#22302c);}
      .objlc-card-actions{display:flex;gap:4px;}
      .objlc-card-actions button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);}
      .objlc-empty,.objlc-error{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:24px;}
      .objlc-error{color:#b22d3a;}
      .objlc-editor-panel{margin-top:6px;padding:16px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px;}
      .objlc-editor-panel h3{margin:0;font-size:15px;}
      .objlc-editor-panel label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);flex:1;min-width:0;}
      .objlc-row{display:flex;gap:12px;flex-wrap:wrap;}
      .objlc-editor-panel .field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;font-size:13px;color:var(--ink,#22302c);background:var(--bg,#f7faf8);}
      .objlc-stage-editor{border:1px solid var(--line,#dfe7e3);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--bg,#f7faf8);}
      .objlc-stage-editor .objlc-stage-head{display:flex;justify-content:space-between;align-items:center;}
      .objlc-stage-editor .objlc-stage-head b{font-size:12px;color:var(--muted,#6b7a74);}
      .objlc-stage-tools{display:flex;gap:4px;}
      .objlc-stage-tools button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);font-size:13px;}
      .objlc-panel-actions{display:flex;gap:8px;justify-content:flex-end;}
      .objlc-panel-actions .btn{padding:8px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;}
      .objlc-panel-actions .btn.primary{background:var(--accent,#587b72);color:#fff;}
      .objlc-panel-actions .btn.outline{background:transparent;border-color:var(--line,#dfe7e3);}
    </style>
    <section class="objlc-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="objlc-header">
        <h2>物件生命周期编辑器</h2>
        <p class="objlc-lede">为每个物件定义完整生命周期状态机（建立 → 变化 → 运行 → 回收），每个阶段可配置触发条件、状态变化与角色持有变化。</p>
        <div class="toolbar">
          <button type="button" class="btn primary" data-action="objlc-add">+ 新增物件生命周期</button>
          <button type="button" class="btn quiet" data-action="objlc-close">关闭</button>
        </div>
      </div>

      ${session.loading ? '<div class="loading-dots">加载中…</div>' : `<div class="objlc-list">${listHtml}</div>`}
      ${session.error && !session.editingId ? `<div class="objlc-error">${escapeHtml(session.error)}</div>` : ""}
      ${session.editingId !== undefined ? objlcEditorPanelHtml(session, items) : ""}
    </section>
  `;
}

function lifecycleCardHtml(lifecycle) {
  const stages = lifecycle.stages || [];
  const chips = stages.map((s, i) =>
    `<span class="objlc-stage-chip">${i + 1}. <b>${escapeHtml(s.label || "阶段")}</b>${s.holder ? ` · 持有：${escapeHtml(s.holder)}` : ""}${s.trigger ? ` · 触发：${escapeHtml(s.trigger)}` : ""}</span>`
  ).join("");
  return `
    <article class="objlc-card">
      <div class="objlc-card-top">
        <div>
          <strong>${escapeHtml(lifecycle.title || "未命名物件")}</strong>
          <p class="objlc-item">${escapeHtml(lifecycle.itemLabel || "未绑定物证")}</p>
          ${lifecycle.summary ? `<p class="objlc-item">${escapeHtml(lifecycle.summary)}</p>` : ""}
        </div>
        <div class="objlc-card-actions">
          <button type="button" data-action="objlc-edit" data-lifecycle-id="${escapeHtml(lifecycle.id)}" title="编辑">✎</button>
          <button type="button" data-action="objlc-delete" data-lifecycle-id="${escapeHtml(lifecycle.id)}" title="删除">✕</button>
        </div>
      </div>
      ${chips ? `<div class="objlc-stages">${chips}</div>` : ""}
    </article>
  `;
}

function objlcEditorPanelHtml(session, items) {
  const d = session.draft;
  const isEdit = Boolean(session.editingId);
  const itemOpts = [
    `<option value="">— 选择物证 —</option>`,
    ...items.map((i) =>
      `<option value="${escapeHtml(i.id)}" ${d.itemId === i.id ? "selected" : ""}>${escapeHtml(i.name || i.id)}</option>`
    )
  ].join("");

  const stagesHtml = (d.stages || []).map((s, i) => `
    <div class="objlc-stage-editor">
      <div class="objlc-stage-head">
        <b>阶段 ${i + 1}</b>
        <div class="objlc-stage-tools">
          ${i > 0 ? `<button type="button" data-action="objlc-stage-up" data-index="${i}">↑</button>` : ""}
          ${i < (d.stages.length - 1) ? `<button type="button" data-action="objlc-stage-down" data-index="${i}">↓</button>` : ""}
          <button type="button" data-action="objlc-stage-remove" data-index="${i}">✕</button>
        </div>
      </div>
      <label>阶段名
        <input class="field" type="text" data-stage-field="${i}::label" value="${escapeHtml(s.label)}" placeholder="例如 建立" />
      </label>
      <label>阶段描述
        <textarea class="field" rows="2" data-stage-field="${i}::description" placeholder="这个阶段物件处于什么状态…">${escapeHtml(s.description)}</textarea>
      </label>
      <label>触发条件
        <textarea class="field" rows="2" data-stage-field="${i}::trigger" placeholder="满足什么条件进入该阶段…">${escapeHtml(s.trigger)}</textarea>
      </label>
      <label>状态变化
        <textarea class="field" rows="2" data-stage-field="${i}::change" placeholder="该阶段导致物件状态如何变化…">${escapeHtml(s.change)}</textarea>
      </label>
      <label>角色持有
        <input class="field" type="text" data-stage-field="${i}::holder" value="${escapeHtml(s.holder)}" placeholder="此刻由哪位角色持有（可空）" />
      </label>
    </div>
  `).join("");

  return `
    <div class="objlc-editor-panel">
      <h3>${isEdit ? "编辑物件生命周期" : "新增物件生命周期"}</h3>
      <div class="objlc-row">
        <label>物件标题（如 O-01）
          <input class="field" type="text" data-lc-field="title" value="${escapeHtml(d.title)}" placeholder="例如 O-01" />
        </label>
      </div>
      <div class="objlc-row">
        <label>绑定物证
          <select class="field" data-lc-field="itemId">${itemOpts}</select>
        </label>
        <label>物件标注
          <input class="field" type="text" data-lc-field="itemLabel" value="${escapeHtml(d.itemLabel)}" placeholder="未绑定物证时填写显示名" />
        </label>
      </div>
      <label>生命周期概述
        <textarea class="field" rows="2" data-lc-field="summary" placeholder="这个物件从建立到回收的完整走向…">${escapeHtml(d.summary)}</textarea>
      </label>

      <div class="objlc-row">
        <label>生命周期阶段 <button type="button" class="btn quiet compact" data-action="objlc-stage-add">+ 添加阶段</button></label>
      </div>
      ${stagesHtml || '<p class="objlc-empty">暂无阶段</p>'}

      <div class="objlc-panel-actions">
        <button type="button" class="btn primary" data-action="objlc-save">保存</button>
        <button type="button" class="btn outline" data-action="objlc-cancel">取消</button>
      </div>
    </div>
  `;
}

// ── Bind ──
export function bindObjectLifecycle(data, session) {
  const root = document.querySelector(`[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";

  root.querySelector("[data-action='objlc-close']")?.addEventListener("click", closeObjectLifecycle);
  root.querySelector("[data-action='objlc-add']")?.addEventListener("click", () => openObjectLifecycleEditor(null));
  root.querySelectorAll("[data-action='objlc-edit']").forEach((el) =>
    el.addEventListener("click", () => openObjectLifecycleEditor(el.dataset.lifecycleId)));
  root.querySelectorAll("[data-action='objlc-delete']").forEach((el) =>
    el.addEventListener("click", () => deleteObjectLifecycle(el.dataset.lifecycleId)));

  root.querySelectorAll("[data-lc-field]").forEach((el) => {
    const field = el.dataset.lcField;
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateObjectLifecycleDraft(field, el.value));
  });

  root.querySelectorAll("[data-stage-field]").forEach((el) => {
    const [indexStr, field] = el.dataset.stageField.split("::");
    const index = parseInt(indexStr, 10);
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateLifecycleStageDraft(index, field, el.value));
  });

  root.querySelector("[data-action='objlc-stage-add']")?.addEventListener("click", addLifecycleStageToDraft);
  root.querySelectorAll("[data-action='objlc-stage-remove']").forEach((el) =>
    el.addEventListener("click", () => removeLifecycleStageFromDraft(parseInt(el.dataset.index, 10))));
  root.querySelectorAll("[data-action='objlc-stage-up']").forEach((el) =>
    el.addEventListener("click", () => moveLifecycleStageInDraft(parseInt(el.dataset.index, 10), -1)));
  root.querySelectorAll("[data-action='objlc-stage-down']").forEach((el) =>
    el.addEventListener("click", () => moveLifecycleStageInDraft(parseInt(el.dataset.index, 10), 1)));

  root.querySelector("[data-action='objlc-save']")?.addEventListener("click", saveObjectLifecycleEditor);
  root.querySelector("[data-action='objlc-cancel']")?.addEventListener("click", closeObjectLifecycleEditor);
}