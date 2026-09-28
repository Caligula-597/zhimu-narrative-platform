/**
 * Relationship Arc Editor — workspace for multi-stage relationship progressions.
 *
 * A relationship arc is a multi-stage progression between two characters
 * (仇视 → 怀疑 → 谈判 → 合作). Each stage can define a trigger condition and
 * the relationship change it causes.
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openRelationshipArc()
 *   closeRelationshipArc()
 *   relationshipArcWorkspaceHtml(data, session)
 *   bindRelationshipArc(data, session)
 */

import * as arcApi from "../api/relationship-arc.js";
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
  buildRelationshipArc,
  emptyRelationshipArcDraft,
  createStage
} from "../../shared/relationship-arc.js";

const TOOL_TYPE = "relationship-arc";

function getRoles(data) {
  return data?.roles || [];
}
function roleName(data, id) {
  return getRoles(data).find((r) => r.id === id)?.name || getRoles(data).find((r) => r.id === id)?.label || "";
}

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const s = getWriterToolSession(data);
  return s?.type === TOOL_TYPE ? s : null;
}

// ── Open / Close ──
export async function openRelationshipArc() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用关系过程");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: { arcs: [] },
    draft: { ...emptyRelationshipArcDraft(), stages: [createStage()] },
    editingId: null,
    loading: true
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view.arcs = (await arcApi.listRelationshipArcs(session.worldId)) || [];
  } catch (error) {
    session.error = normalizeError(error, "读取关系过程失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function closeRelationshipArc() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

export function openRelationshipArcEditor(editingId = null) {
  const session = currentSession();
  if (!session) return;
  if (editingId) {
    const arc = session.view.arcs.find((a) => a.id === editingId);
    if (!arc) return;
    session.draft = buildRelationshipArc(arc);
    session.editingId = arc.id;
  } else {
    session.draft = { ...emptyRelationshipArcDraft(), stages: [createStage()] };
    session.editingId = null;
  }
  render();
}

export function closeRelationshipArcEditor() {
  const session = currentSession();
  if (!session) return;
  session.draft = { ...emptyRelationshipArcDraft(), stages: [createStage()] };
  session.editingId = null;
  render();
}

export function updateRelationshipArcDraft(field, value) {
  const session = currentSession();
  if (!session) return;
  session.draft[field] = value;
}

export function updateStageDraft(index, field, value) {
  const session = currentSession();
  if (!session) return;
  const stages = [...(session.draft.stages || [])];
  if (stages[index]) {
    stages[index] = { ...stages[index], [field]: value };
    session.draft.stages = stages;
  }
}

export function addStageToDraft() {
  const session = currentSession();
  if (!session) return;
  session.draft.stages = [...(session.draft.stages || []), createStage()];
  render();
}

export function removeStageFromDraft(index) {
  const session = currentSession();
  if (!session) return;
  session.draft.stages = (session.draft.stages || []).filter((_, i) => i !== index);
  render();
}

export function moveStageInDraft(index, dir) {
  const session = currentSession();
  if (!session) return;
  const stages = [...(session.draft.stages || [])];
  const target = index + dir;
  if (target < 0 || target >= stages.length) return;
  [stages[index], stages[target]] = [stages[target], stages[index]];
  session.draft.stages = stages;
  render();
}

export async function saveRelationshipArcEditor() {
  const session = currentSession();
  if (!session) return;
  const d = session.draft;
  const title = d.charALabel || d.charBLabel ? `${d.charALabel || "?"} 与 ${d.charBLabel || "?"}` : "未命名关系";
  if (!d.title && !d.charALabel) {
    return showToast("请填写关系标题或至少一位角色");
  }
  const stageList = (d.stages || []).map((s) => ({
    label: s.label,
    description: s.description || "",
    trigger: s.trigger || "",
    change: s.change || ""
  }));
  const body = {
    title: d.title || title,
    charAId: d.charAId || null,
    charALabel: d.charALabel,
    charBId: d.charBId || null,
    charBLabel: d.charBLabel,
    summary: d.summary,
    stages: stageList
  };
  const op = session.editingId
    ? arcApi.updateRelationshipArc(session.worldId, session.editingId, body)
    : arcApi.createRelationshipArc(session.worldId, body);
  try {
    await op;
    showToast(session.editingId ? "已更新" : "已创建");
    session.editingId = null;
    session.draft = { ...emptyRelationshipArcDraft(), stages: [createStage()] };
    session.loading = true;
    session.view.arcs = (await arcApi.listRelationshipArcs(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "保存失败"));
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function deleteRelationshipArc(editingId) {
  const session = currentSession();
  if (!session || !editingId) return;
  if (!confirm("确定删除这条关系过程？")) return;
  try {
    await arcApi.deleteRelationshipArc(session.worldId, editingId);
    showToast("已删除");
    session.view.arcs = (await arcApi.listRelationshipArcs(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "删除失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

// ── Render ──
export function relationshipArcWorkspaceHtml(data, session) {
  if (!session) return "";
  const roles = getRoles(data);
  const arcs = session.view?.arcs || [];

  const listHtml = arcs.length
    ? arcs.map((arc) => arcCardHtml(arc)).join("")
    : `<div class="relarc-empty">暂无关系过程</div>`;

  return `
    <style>
      .relarc-shell{display:flex;flex-direction:column;gap:16px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .relarc-header h2{margin:0 0 4px;font-size:20px;}
      .relarc-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;}
      .relarc-header .toolbar{display:flex;gap:8px;justify-content:flex-end;}
      .relarc-list{display:flex;flex-direction:column;gap:10px;}
      .relarc-card{padding:14px;border:1px solid var(--line,#dfe7e3);border-left:3px solid #587b72;border-radius:10px;background:var(--card,#fff);}
      .relarc-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px;}
      .relarc-card-top strong{font-size:15px;}
      .relarc-pair{color:var(--muted,#6b7a74);font-size:12px;margin-top:2px;}
      .relarc-stages{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
      .relarc-stage-chip{padding:4px 10px;border-radius:999px;font-size:12px;background:#eef3f0;color:#3c514a;}
      .relarc-stage-chip b{color:var(--ink,#22302c);}
      .relarc-card-actions{display:flex;gap:4px;}
      .relarc-card-actions button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);}
      .relarc-empty,.relarc-error{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:24px;}
      .relarc-error{color:#b22d3a;}
      .relarc-editor-panel{margin-top:6px;padding:16px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px;}
      .relarc-editor-panel h3{margin:0;font-size:15px;}
      .relarc-editor-panel label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);flex:1;min-width:0;}
      .relarc-row{display:flex;gap:12px;flex-wrap:wrap;}
      .relarc-editor-panel .field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;font-size:13px;color:var(--ink,#22302c);background:var(--bg,#f7faf8);}
      .relarc-stage-editor{border:1px solid var(--line,#dfe7e3);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--bg,#f7faf8);}
      .relarc-stage-editor .relarc-stage-head{display:flex;justify-content:space-between;align-items:center;}
      .relarc-stage-editor .relarc-stage-head b{font-size:12px;color:var(--muted,#6b7a74);}
      .relarc-stage-tools{display:flex;gap:4px;}
      .relarc-stage-tools button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);font-size:13px;}
      .relarc-panel-actions{display:flex;gap:8px;justify-content:flex-end;}
      .relarc-panel-actions .btn{padding:8px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;}
      .relarc-panel-actions .btn.primary{background:var(--accent,#587b72);color:#fff;}
      .relarc-panel-actions .btn.outline{background:transparent;border-color:var(--line,#dfe7e3);}
    </style>
    <section class="relarc-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="relarc-header">
        <h2>关系过程编辑器</h2>
        <p class="relarc-lede">定义两两角色间的多阶段递进关系，每个阶段可配置触发条件与关系变化。</p>
        <div class="toolbar">
          <button type="button" class="btn primary" data-action="relarc-add">+ 新增关系</button>
          <button type="button" class="btn quiet" data-action="relarc-close">关闭</button>
        </div>
      </div>

      ${session.loading ? '<div class="loading-dots">加载中…</div>' : `<div class="relarc-list">${listHtml}</div>`}
      ${session.error && !session.editingId ? `<div class="relarc-error">${escapeHtml(session.error)}</div>` : ""}
      ${session.editingId !== undefined ? relarcEditorPanelHtml(session, roles) : ""}
    </section>
  `;
}

function arcCardHtml(arc) {
  const a = arc.charALabel || "角色A";
  const b = arc.charBLabel || "角色B";
  const stages = arc.stages || [];
  const chips = stages.map((s, i) =>
    `<span class="relarc-stage-chip">${i + 1}. <b>${escapeHtml(s.label || "阶段")}</b>${s.trigger ? ` · 触发：${escapeHtml(s.trigger)}` : ""}</span>`
  ).join("");
  return `
    <article class="relarc-card">
      <div class="relarc-card-top">
        <div>
          <strong>${escapeHtml(arc.title || "未命名关系")}</strong>
          <p class="relarc-pair">${escapeHtml(a)} 与 ${escapeHtml(b)}</p>
          ${arc.summary ? `<p class="relarc-pair">${escapeHtml(arc.summary)}</p>` : ""}
        </div>
        <div class="relarc-card-actions">
          <button type="button" data-action="relarc-edit" data-arc-id="${escapeHtml(arc.id)}" title="编辑">✎</button>
          <button type="button" data-action="relarc-delete" data-arc-id="${escapeHtml(arc.id)}" title="删除">✕</button>
        </div>
      </div>
      ${chips ? `<div class="relarc-stages">${chips}</div>` : ""}
    </article>
  `;
}

function relarcEditorPanelHtml(session, roles) {
  const d = session.draft;
  const isEdit = Boolean(session.editingId);
  const roleOpts = (label, selected) => [
    `<option value="">— ${label} —</option>`,
    ...roles.map((r) =>
      `<option value="${escapeHtml(r.id)}" ${selected === r.id ? "selected" : ""}>${escapeHtml(r.name || r.label || r.id)}</option>`
    )
  ].join("");

  const stagesHtml = (d.stages || []).map((s, i) => `
    <div class="relarc-stage-editor">
      <div class="relarc-stage-head">
        <b>阶段 ${i + 1}</b>
        <div class="relarc-stage-tools">
          ${i > 0 ? `<button type="button" data-action="relarc-stage-up" data-index="${i}">↑</button>` : ""}
          ${i < (d.stages.length - 1) ? `<button type="button" data-action="relarc-stage-down" data-index="${i}">↓</button>` : ""}
          <button type="button" data-action="relarc-stage-remove" data-index="${i}">✕</button>
        </div>
      </div>
      <label>阶段名
        <input class="field" type="text" data-stage-field="${i}::label" value="${escapeHtml(s.label)}" placeholder="例如 仇视" />
      </label>
      <label>阶段描述
        <textarea class="field" rows="2" data-stage-field="${i}::description" placeholder="这个阶段发生了什么…">${escapeHtml(s.description)}</textarea>
      </label>
      <label>触发条件
        <textarea class="field" rows="2" data-stage-field="${i}::trigger" placeholder="满足什么条件进入该阶段…">${escapeHtml(s.trigger)}</textarea>
      </label>
      <label>关系变化
        <textarea class="field" rows="2" data-stage-field="${i}::change" placeholder="该阶段如何改变两者关系…">${escapeHtml(s.change)}</textarea>
      </label>
    </div>
  `).join("");

  return `
    <div class="relarc-editor-panel">
      <h3>${isEdit ? "编辑关系过程" : "新增关系过程"}</h3>
      <div class="relarc-row">
        <label>关系标题（如 R-01）
          <input class="field" type="text" data-relarc-field="title" value="${escapeHtml(d.title)}" placeholder="例如 R-01" />
        </label>
      </div>
      <div class="relarc-row">
        <label>角色 A
          <select class="field" data-relarc-field="charAId">${roleOpts("选择角色A", d.charAId)}</select>
        </label>
        <label>角色 A 标注
          <input class="field" type="text" data-relarc-field="charALabel" value="${escapeHtml(d.charALabel)}" placeholder="未绑定角色时填写显示名" />
        </label>
      </div>
      <div class="relarc-row">
        <label>角色 B
          <select class="field" data-relarc-field="charBId">${roleOpts("选择角色B", d.charBId)}</select>
        </label>
        <label>角色 B 标注
          <input class="field" type="text" data-relarc-field="charBLabel" value="${escapeHtml(d.charBLabel)}" placeholder="未绑定角色时填写显示名" />
        </label>
      </div>
      <label>关系概述
        <textarea class="field" rows="2" data-relarc-field="summary" placeholder="这段关系的整体走向…">${escapeHtml(d.summary)}</textarea>
      </label>

      <div class="relarc-row">
        <label>进展阶段 <button type="button" class="btn quiet compact" data-action="relarc-stage-add">+ 添加阶段</button></label>
      </div>
      ${stagesHtml || '<p class="relarc-empty">暂无阶段</p>'}

      <div class="relarc-panel-actions">
        <button type="button" class="btn primary" data-action="relarc-save">保存</button>
        <button type="button" class="btn outline" data-action="relarc-cancel">取消</button>
      </div>
    </div>
  `;
}

// ── Bind ──
export function bindRelationshipArc(data, session) {
  const root = document.querySelector(`[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";

  root.querySelector("[data-action='relarc-close']")?.addEventListener("click", closeRelationshipArc);
  root.querySelector("[data-action='relarc-add']")?.addEventListener("click", () => openRelationshipArcEditor(null));
  root.querySelectorAll("[data-action='relarc-edit']").forEach((el) =>
    el.addEventListener("click", () => openRelationshipArcEditor(el.dataset.arcId)));
  root.querySelectorAll("[data-action='relarc-delete']").forEach((el) =>
    el.addEventListener("click", () => deleteRelationshipArc(el.dataset.arcId)));

  root.querySelectorAll("[data-relarc-field]").forEach((el) => {
    const field = el.dataset.relarcField;
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateRelationshipArcDraft(field, el.value));
  });

  root.querySelectorAll("[data-stage-field]").forEach((el) => {
    const [indexStr, field] = el.dataset.stageField.split("::");
    const index = parseInt(indexStr, 10);
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateStageDraft(index, field, el.value));
  });

  root.querySelector("[data-action='relarc-stage-add']")?.addEventListener("click", addStageToDraft);
  root.querySelectorAll("[data-action='relarc-stage-remove']").forEach((el) =>
    el.addEventListener("click", () => removeStageFromDraft(parseInt(el.dataset.index, 10))));
  root.querySelectorAll("[data-action='relarc-stage-up']").forEach((el) =>
    el.addEventListener("click", () => moveStageInDraft(parseInt(el.dataset.index, 10), -1)));
  root.querySelectorAll("[data-action='relarc-stage-down']").forEach((el) =>
    el.addEventListener("click", () => moveStageInDraft(parseInt(el.dataset.index, 10), 1)));

  root.querySelector("[data-action='relarc-save']")?.addEventListener("click", saveRelationshipArcEditor);
  root.querySelector("[data-action='relarc-cancel']")?.addEventListener("click", closeRelationshipArcEditor);
}