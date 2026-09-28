/**
 * Ending Branch Editor — workspace for endings.
 *
 * An ending branch defines a possible outcome: title, trigger condition,
 * resulting text, and extra clues / physical items revealed when reached.
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openEnding()
 *   closeEnding()
 *   endingWorkspaceHtml(data, session)
 *   bindEnding(data, session)
 */

import * as endingApi from "../api/ending.js";
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
import { buildEnding, emptyEndingDraft, toggleId } from "../../shared/ending.js";

const TOOL_TYPE = "ending-branch";

function getClues(data) { return data?.clues || []; }
function getItems(data) { return data?.items || []; }
function clueName(data, id) { return getClues(data).find((c) => c.id === id)?.name || id.slice(0, 8); }
function itemName(data, id) { return getItems(data).find((i) => i.id === id)?.name || id.slice(0, 8); }

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const s = getWriterToolSession(data);
  return s?.type === TOOL_TYPE ? s : null;
}

export async function openEnding() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用结局分支");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: { endings: [] },
    draft: { ...emptyEndingDraft() },
    editingId: null,
    loading: true
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view.endings = (await endingApi.listEndings(session.worldId)) || [];
  } catch (error) {
    session.error = normalizeError(error, "读取结局分支失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function closeEnding() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

export function openEndingEditor(editingId = null) {
  const session = currentSession();
  if (!session) return;
  if (editingId) {
    const ending = session.view.endings.find((e) => e.id === editingId);
    if (!ending) return;
    session.draft = buildEnding(ending);
    session.editingId = ending.id;
  } else {
    session.draft = { ...emptyEndingDraft(), sortOrder: session.view.endings.length };
    session.editingId = null;
  }
  render();
}

export function closeEndingEditor() {
  const session = currentSession();
  if (!session) return;
  session.draft = { ...emptyEndingDraft() };
  session.editingId = null;
  render();
}

export function updateEndingDraft(field, value) {
  const session = currentSession();
  if (!session) return;
  session.draft[field] = value;
}

export function toggleEndingReveal(listField, id) {
  const session = currentSession();
  if (!session) return;
  session.draft[listField] = toggleId(session.draft[listField], id);
}

export async function saveEndingEditor() {
  const session = currentSession();
  if (!session) return;
  const d = session.draft;
  if (!d.title || !d.trigger || !d.result) {
    return showToast("请填写结局标题、触发条件与结果文本");
  }
  const body = {
    title: d.title,
    trigger: d.trigger,
    result: d.result,
    revealText: d.revealText,
    revealClueIds: d.revealClueIds || [],
    revealItemIds: d.revealItemIds || [],
    isGood: d.isGood,
    sortOrder: d.sortOrder ?? 0
  };
  const op = session.editingId
    ? endingApi.updateEnding(session.worldId, session.editingId, body)
    : endingApi.createEnding(session.worldId, body);
  try {
    await op;
    showToast(session.editingId ? "已更新" : "已创建");
    session.editingId = null;
    session.draft = { ...emptyEndingDraft() };
    session.loading = true;
    session.view.endings = (await endingApi.listEndings(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "保存失败"));
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function deleteEnding(editingId) {
  const session = currentSession();
  if (!session || !editingId) return;
  if (!confirm("确定删除这个结局分支？")) return;
  try {
    await endingApi.deleteEnding(session.worldId, editingId);
    showToast("已删除");
    session.view.endings = (await endingApi.listEndings(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "删除失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

export function endingWorkspaceHtml(data, session) {
  if (!session) return "";
  const endings = session.view?.endings || [];

  const listHtml = endings.length
    ? endings.map((e) => endingCardHtml(e, data)).join("")
    : `<div class="end-empty">暂无结局分支</div>`;

  return `
    <style>
      .end-shell{display:flex;flex-direction:column;gap:16px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .end-header h2{margin:0 0 4px;font-size:20px;}
      .end-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;}
      .end-header .toolbar{display:flex;gap:8px;justify-content:flex-end;}
      .end-list{display:flex;flex-direction:column;gap:10px;}
      .end-card{padding:14px;border:1px solid var(--line,#dfe7e3);border-left:3px solid #587b72;border-radius:10px;background:var(--card,#fff);}
      .end-card.is-good{border-left-color:#2f6b4f;}
      .end-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px;}
      .end-card-top strong{font-size:15px;}
      .end-type{font-size:10px;padding:2px 8px;border-radius:999px;font-weight:700;background:#e3f1e8;color:#2f6b4f;}
      .end-type.bad{background:#fce3e0;color:#b22d3a;}
      .end-trigger{margin:8px 0 0;font-size:12px;color:var(--ink,#22302c);}
      .end-trigger b{color:var(--muted,#6b7a74);font-weight:600;}
      .end-result{margin:6px 0 0;line-height:1.6;color:var(--ink,#22302c);}
      .end-reveals{margin:8px 0 0;display:flex;flex-wrap:wrap;gap:6px;}
      .end-reveal-chip{padding:2px 8px;border-radius:999px;font-size:11px;background:#fff6e6;color:#8a6a2a;}
      .end-card-actions{display:flex;gap:4px;}
      .end-card-actions button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);}
      .end-empty,.end-error{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:24px;}
      .end-error{color:#b22d3a;}
      .end-editor-panel{margin-top:6px;padding:16px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px;}
      .end-editor-panel h3{margin:0;font-size:15px;}
      .end-editor-panel label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);}
      .end-editor-panel .field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;font-size:13px;color:var(--ink,#22302c);background:var(--bg,#f7faf8);}
      .end-row{display:flex;gap:12px;flex-wrap:wrap;}
      .end-row label{flex:1;min-width:0;}
      .end-checklist{display:flex;flex-wrap:wrap;gap:6px;border:1px solid var(--line,#dfe7e3);border-radius:8px;padding:8px;background:var(--bg,#f7faf8);max-height:140px;overflow:auto;}
      .end-check-item{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--ink,#22302c);}
      .end-check-item input{width:14px;height:14px;}
      .end-good-toggle{flex-direction:row !important;align-items:center;gap:8px !important;}
      .end-good-toggle input{width:16px;height:16px;}
      .end-panel-actions{display:flex;gap:8px;justify-content:flex-end;}
      .end-panel-actions .btn{padding:8px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;}
      .end-panel-actions .btn.primary{background:var(--accent,#587b72);color:#fff;}
      .end-panel-actions .btn.outline{background:transparent;border-color:var(--line,#dfe7e3);}
    </style>
    <section class="end-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="end-header">
        <h2>结局分支编辑器</h2>
        <p class="end-lede">定义多种可能结局：触发条件、结果文本与达成的线索/物证揭示。</p>
        <div class="toolbar">
          <button type="button" class="btn primary" data-action="end-add">+ 新增结局</button>
          <button type="button" class="btn quiet" data-action="end-close">关闭</button>
        </div>
      </div>

      ${session.loading ? '<div class="loading-dots">加载中…</div>' : `<div class="end-list">${listHtml}</div>`}
      ${session.error && !session.editingId ? `<div class="end-error">${escapeHtml(session.error)}</div>` : ""}
      ${session.editingId !== undefined ? endingEditorPanelHtml(session, data) : ""}
    </section>
  `;
}

function endingCardHtml(ending, data) {
  const revealChunks = [];
  (ending.revealClueIds || []).forEach((id) => revealChunks.push(`线索「${clueName(data, id)}」`));
  (ending.revealItemIds || []).forEach((id) => revealChunks.push(`物证「${itemName(data, id)}」`));
  const reveals = revealChunks.length
    ? revealChunks.join("、")
    : (ending.revealText ? "附加揭示文本" : "");
  return `
    <article class="end-card ${ending.isGood === false ? "is-good" : ""}">
      <div class="end-card-top">
        <div>
          <strong>${escapeHtml(ending.title || "未命名结局")}</strong>
          <span class="end-type ${ending.isGood === false ? "bad" : ""}">${ending.isGood === false ? "坏结局" : "好结局"}</span>
        </div>
        <div class="end-card-actions">
          <button type="button" data-action="end-edit" data-ending-id="${escapeHtml(ending.id)}" title="编辑">✎</button>
          <button type="button" data-action="end-delete" data-ending-id="${escapeHtml(ending.id)}" title="删除">✕</button>
        </div>
      </div>
      <p class="end-trigger"><b>触发：</b>${escapeHtml(ending.trigger || "—")}</p>
      ${ending.result ? `<p class="end-result">${escapeHtml(ending.result)}</p>` : ""}
      ${reveals ? `<div class="end-reveals"><span class="end-reveal-chip">揭示：${escapeHtml(reveals)}</span></div>` : ""}
    </article>
  `;
}

function checklistHtml(list, selected, labelKey) {
  if (!list.length) return '<span class="end-empty">暂无可用条目</span>';
  return list.map((x) => {
    const checked = selected.includes(x.id) ? "checked" : "";
    return `<label class="end-check-item">
      <input type="checkbox" data-end-reveal="${labelKey}" data-reveal-id="${escapeHtml(x.id)}" ${checked} />
      ${escapeHtml(x.name || x.id.slice(0, 8))}
    </label>`;
  }).join("");
}

function endingEditorPanelHtml(session, data) {
  const d = session.draft;
  const isEdit = Boolean(session.editingId);
  const clueChecks = checklistHtml(getClues(data), d.revealClueIds || [], "clue");
  const itemChecks = checklistHtml(getItems(data), d.revealItemIds || [], "item");
  return `
    <div class="end-editor-panel">
      <h3>${isEdit ? "编辑结局分支" : "新增结局分支"}</h3>
      <div class="end-row">
        <label>结局标题（如 X-01）
          <input class="field" type="text" data-end-field="title" value="${escapeHtml(d.title)}" placeholder="例如 X-01" />
        </label>
        <label>排序
          <input class="field" type="number" data-end-field="sortOrder" value="${d.sortOrder}" min="0" max="9999" />
        </label>
      </div>
      <label>触发条件
        <textarea class="field" rows="2" data-end-field="trigger" placeholder="满足什么条件进入该结局…">${escapeHtml(d.trigger)}</textarea>
      </label>
      <label>结果文本
        <textarea class="field" rows="4" data-end-field="result" placeholder="该结局的最终呈现…">${escapeHtml(d.result)}</textarea>
      </label>
      <label>附加揭示文本
        <textarea class="field" rows="2" data-end-field="revealText" placeholder="达成的附加信息揭示…">${escapeHtml(d.revealText)}</textarea>
      </label>
      <label>达成的线索揭示
        <div class="end-checklist">${clueChecks}</div>
      </label>
      <label>达成的物证揭示
        <div class="end-checklist">${itemChecks}</div>
      </label>
      <label class="end-good-toggle">
        <input type="checkbox" data-end-field="isGood" ${d.isGood !== false ? "checked" : ""} />
        好结局（未勾选表示坏结局）
      </label>
      <div class="end-panel-actions">
        <button type="button" class="btn primary" data-action="end-save">保存</button>
        <button type="button" class="btn outline" data-action="end-cancel">取消</button>
      </div>
    </div>
  `;
}

export function bindEnding(data, session) {
  const root = document.querySelector(`[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";

  root.querySelector("[data-action='end-close']")?.addEventListener("click", closeEnding);
  root.querySelector("[data-action='end-add']")?.addEventListener("click", () => openEndingEditor(null));
  root.querySelectorAll("[data-action='end-edit']").forEach((el) =>
    el.addEventListener("click", () => openEndingEditor(el.dataset.endingId)));
  root.querySelectorAll("[data-action='end-delete']").forEach((el) =>
    el.addEventListener("click", () => deleteEnding(el.dataset.endingId)));

  root.querySelectorAll("[data-end-field]").forEach((el) => {
    const field = el.dataset.endField;
    const eventType = el.type === "checkbox" ? "change" : "input";
    el.addEventListener(eventType, () => updateEndingDraft(field, el.type === "checkbox" ? el.checked : el.value));
  });

  root.querySelectorAll("[data-end-reveal]").forEach((el) =>
    el.addEventListener("change", () => {
      const listField = el.dataset.endReveal === "item" ? "revealItemIds" : "revealClueIds";
      toggleEndingReveal(listField, el.dataset.revealId);
    }));

  root.querySelector("[data-action='end-save']")?.addEventListener("click", saveEndingEditor);
  root.querySelector("[data-action='end-cancel']")?.addEventListener("click", closeEndingEditor);
}