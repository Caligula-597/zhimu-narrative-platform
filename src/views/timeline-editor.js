/**
 * Timeline Editor — multi-line parallel action timeline (缺口 A)。
 *
 * Features:
 *   - Multi-line parallel tracks (0..MAX_PARALLEL_LINES)
 *   - Precise ("17:00") or fuzzy ("傍晚") timestamps
 *   - Character action + impact display
 *   - Per-entry cognitions (correct=black, misleading=red)
 *   - Filter by act/chapter
 *   - Side-panel editing for each entry
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openTimeline()
 *   closeTimeline()
 *   timelineEditorWorkspaceHtml(data, session)
 *   bindTimeline(data, session)
 */

import * as timelineApi from "../api/timeline.js";
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
  buildTimelineEntry,
  emptyTimelineDraft,
  createCognition,
  MAX_PARALLEL_LINES
} from "../../shared/timeline-editor.js";

const TOOL_TYPE = "timeline";

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const s = getWriterToolSession(data);
  return s?.type === TOOL_TYPE ? s : null;
}

function getActs(data) {
  return data?.chapters || [];
}
function getRoles(data) {
  return data?.roles || [];
}
function roleName(data, id) {
  const roles = getRoles(data);
  const r = roles.find((x) => x.id === id);
  return r?.name || r?.label || id;
}

// ── Open / Close ──
export async function openTimeline() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用行动时间线");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: { entries: [], filterActId: "" },
    draft: emptyTimelineDraft(),
    editingId: null,
    loading: true
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view.entries = await loadEntries(session);
  } catch (error) {
    session.error = normalizeError(error, "读取时间线失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function closeTimeline() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

export function setTimelineActFilter(actId) {
  const session = currentSession();
  if (!session) return;
  session.view.filterActId = actId;
  session.loading = true;
  loadEntries(session).then((entries) => {
    if (!writerToolSessionIsCurrent(session)) return;
    session.view.entries = entries;
    session.loading = false;
    render();
  }).catch(() => {
    if (!writerToolSessionIsCurrent(session)) return;
    session.loading = false;
  });
}

export function openTimelineEntryEditor(entryId = null) {
  const session = currentSession();
  if (!session) return;
  if (entryId) {
    const entry = session.view.entries.find((e) => e.id === entryId);
    if (!entry) return;
    session.draft = buildTimelineEntry(entry);
    session.editingId = entry.id;
  } else {
    session.draft = {
      ...emptyTimelineDraft(),
      actId: session.view.filterActId || (getActs(studioStore.get().cloudStudio)[0]?.id || ""),
      parallelLine: 0
    };
    session.editingId = null;
  }
  render();
}

export function closeTimelineEntryEditor() {
  const session = currentSession();
  if (!session) return;
  session.editingId = null;
  session.draft = emptyTimelineDraft();
  render();
}

export function updateTimelineDraft(field, value) {
  const session = currentSession();
  if (!session) return;
  session.draft[field] = value;
}

export function addCognitionToDraft() {
  const session = currentSession();
  if (!session) return;
  session.draft.cognitions = [
    ...(session.draft.cognitions || []),
    createCognition("", "", false)
  ];
  render();
}

export function updateCognitionInDraft(index, field, value) {
  const session = currentSession();
  if (!session) return;
  const cognitions = [...(session.draft.cognitions || [])];
  if (cognitions[index]) {
    cognitions[index] = { ...cognitions[index], [field]: value };
    session.draft.cognitions = cognitions;
  }
}

export function removeCognitionFromDraft(index) {
  const session = currentSession();
  if (!session) return;
  session.draft.cognitions = (session.draft.cognitions || []).filter((_, i) => i !== index);
  render();
}

export async function saveTimelineEntryEditor() {
  const session = currentSession();
  if (!session) return;
  const d = session.draft;
  if (!d.actId || !d.action) {
    return showToast("请填写所属幕和行动内容");
  }
  const body = {
    actId: d.actId,
    timestamp: d.timestamp,
    sortOrder: d.sortOrder,
    parallelLine: d.parallelLine,
    actorId: d.actorId,
    action: d.action,
    impact: d.impact,
    cognitions: d.cognitions || []
  };
  const op = session.editingId
    ? timelineApi.updateTimelineEntry(session.worldId, session.editingId, body)
    : timelineApi.createTimelineEntry(session.worldId, body);
  try {
    await op;
    showToast(session.editingId ? "已更新" : "已创建");
    session.editingId = null;
    session.draft = emptyTimelineDraft();
    session.loading = true;
    session.view.entries = await loadEntries(session);
  } catch (error) {
    showToast(normalizeError(error, "保存失败"));
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function deleteTimelineEntry(entryId) {
  const session = currentSession();
  if (!session || !entryId) return;
  if (!confirm("确定删除这条时间线条目？")) return;
  try {
    await timelineApi.deleteTimelineEntry(session.worldId, entryId);
    showToast("已删除");
    session.loading = true;
    session.view.entries = await loadEntries(session);
  } catch (error) {
    showToast(normalizeError(error, "删除失败"));
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

// ── Internal ──
async function loadEntries(session) {
  const result = await timelineApi.listTimelineEntries(session.worldId, {
    actId: session.view?.filterActId || undefined
  });
  return (result || []).map((e) => buildTimelineEntry(e));
}

// ── Render ──
export function timelineEditorWorkspaceHtml(data, session) {
  if (!session) return "";
  const acts = getActs(data);
  const roles = getRoles(data);
  const entries = session.view?.entries || [];
  const filterActId = session.view?.filterActId || "";

  const maxLine = entries.reduce((m, e) => Math.max(m, e.parallelLine), 0);
  const lineCount = Math.max(maxLine + 1, 1);

  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push(entries.filter((e) => e.parallelLine === i));
  }

  const actTabsHtml = [
    `<button type="button" class="tab ${!filterActId ? "is-active" : ""}" data-action="timeline-filter-all">全部</button>`,
    ...acts.map((a) =>
      `<button type="button" class="tab ${filterActId === a.id ? "is-active" : ""}" data-action="timeline-filter-act" data-act-id="${escapeHtml(a.id)}">${escapeHtml(a.name || a.title || "未命名幕")}</button>`
    )
  ].join("");

  const linesHtml = lines.map((lineEntries, lineIdx) => {
    const entriesHtml = lineEntries.length
      ? lineEntries.map((entry) => entryHtml(data, entry)).join("")
      : `<div class="timeline-empty">此线暂无条目</div>`;
    return `
      <div class="timeline-parallel-line">
        <div class="timeline-parallel-line-header">
          <h3>线 ${lineIdx + 1}</h3>
          <button type="button" class="btn quiet compact" data-action="timeline-add-entry" data-parallel-line="${lineIdx}">+ 添加</button>
        </div>
        ${entriesHtml}
      </div>
    `;
  }).join("");

  return `
    <style>
      .timeline-editor-shell{display:flex;flex-direction:column;gap:16px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .timeline-editor-header h2{margin:0 0 4px;font-size:20px;}
      .timeline-editor-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;}
      .timeline-editor-header .toolbar{display:flex;gap:8px;justify-content:flex-end;}
      .timeline-empty,.timeline-error{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:24px;}
      .timeline-error{color:#b22d3a;}
      .timeline-act-filter{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px;}
      .timeline-act-filter .tab{padding:6px 12px;border-radius:999px;border:1px solid var(--line,#dfe7e3);background:var(--card,#fff);cursor:pointer;font-size:13px;color:var(--ink,#22302c);}
      .timeline-act-filter .tab.is-active{background:var(--accent,#587b72);color:#fff;border-color:var(--accent,#587b72);}
      .timeline-parallel-line{border:1px solid var(--line,#dfe7e3);border-radius:12px;padding:12px;background:var(--card,#fff);}
      .timeline-parallel-line-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
      .timeline-parallel-line-header h3{margin:0;font-size:14px;color:var(--muted,#6b7a74);}
      .timeline-entry{display:flex;justify-content:space-between;gap:10px;padding:10px;border-top:1px dashed var(--line,#dfe7e3);}
      .timeline-entry:first-of-type{border-top:0;}
      .timeline-entry-time{flex:0 0 72px;font-weight:600;color:var(--muted,#6b7a74);font-size:13px;}
      .timeline-entry-body{flex:1;min-width:0;}
      .timeline-entry-action{font-size:14px;}
      .timeline-entry-impact{font-size:13px;color:var(--muted,#6b7a74);margin-top:2px;}
      .timeline-entry-cognitions{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;}
      .timeline-cognition{padding:2px 8px;border-radius:999px;font-size:12px;}
      .timeline-cognition.correct{background:#eef3f0;color:#22302c;}
      .timeline-cognition.misleading{background:#fbecec;color:#b22d3a;}
      .timeline-entry-actions{display:flex;gap:4px;}
      .timeline-entry-actions button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);}
      .timeline-editor-panel{margin-top:6px;padding:16px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px;}
      .timeline-editor-panel h3{margin:0;font-size:15px;}
      .timeline-editor-panel label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);}
      .field-group{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);}
      .timeline-editor-panel .field,.field-group .field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;font-size:13px;color:var(--ink,#22302c);background:var(--bg,#f7faf8);}
      .timeline-cognition-editor{border:1px solid var(--line,#dfe7e3);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--bg,#f7faf8);}
      .cognition-row{display:flex;gap:8px;align-items:center;}
      .cognition-type-toggle{display:flex;gap:2px;}
      .cognition-type-toggle button{border:1px solid var(--line,#dfe7e3);border-radius:6px;padding:4px 8px;cursor:pointer;background:var(--card,#fff);color:var(--muted,#6b7a74);}
      .cognition-type-toggle button.is-black{background:#22302c;color:#fff;border-color:#22302c;}
      .cognition-type-toggle button.is-red{background:#b22d3a;color:#fff;border-color:#b22d3a;}
      .panel-actions{display:flex;gap:8px;justify-content:flex-end;}
      .panel-actions .btn{padding:8px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;}
      .panel-actions .btn.primary{background:var(--accent,#587b72);color:#fff;}
      .panel-actions .btn.outline{background:transparent;border-color:var(--line,#dfe7e3);}
    </style>
    <section class="timeline-editor-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="timeline-editor-header">
        <h2>行动时间线编辑器</h2>
        <p class="timeline-editor-lede">多线并行的行动时间线：每条目指向一幕与一条并行线，标记角色行动、世界影响与角色认知（黑=正确，红=误导）。</p>
        <div class="toolbar">
          <button type="button" class="btn primary" data-action="timeline-add-entry" data-parallel-line="0">+ 新增条目</button>
          <button type="button" class="btn quiet" data-action="timeline-close">关闭</button>
        </div>
      </div>

      <div class="timeline-act-filter">${actTabsHtml}</div>

      ${session.loading ? '<div class="loading-dots">加载中…</div>' : linesHtml}
      ${session.error && session.editingId === null ? `<div class="timeline-error">${escapeHtml(session.error)}</div>` : ""}
      ${session.editingId !== undefined ? entryEditorPanelHtml(session, roles, acts) : ""}
    </section>
  `;
}

function entryHtml(data, entry) {
  const roleNameValue = roleName(data, entry.actorId);
  const cognitionsHtml = (entry.cognitions || []).map((c) => {
    const cls = c.isMisleading ? "misleading" : "correct";
    const label = c.isMisleading ? "【误导】" : "【认知】";
    const charName = roleName(data, c.characterId);
    return `<span class="timeline-cognition ${cls}">${label} ${escapeHtml(charName)}: ${escapeHtml(c.content)}</span>`;
  }).join("");

  return `
    <div class="timeline-entry">
      <div class="timeline-entry-time">${escapeHtml(entry.timestamp || "—")}</div>
      <div class="timeline-entry-body">
        <div class="timeline-entry-action"><strong>${escapeHtml(roleNameValue)}</strong>：${escapeHtml(entry.action)}</div>
        ${entry.impact ? `<div class="timeline-entry-impact">→ ${escapeHtml(entry.impact)}</div>` : ""}
        ${cognitionsHtml ? `<div class="timeline-entry-cognitions">${cognitionsHtml}</div>` : ""}
      </div>
      <div class="timeline-entry-actions">
        <button type="button" data-action="timeline-edit-entry" data-entry-id="${escapeHtml(entry.id)}" title="编辑">✎</button>
        <button type="button" data-action="timeline-delete-entry" data-entry-id="${escapeHtml(entry.id)}" title="删除">✕</button>
      </div>
    </div>
  `;
}

function entryEditorPanelHtml(session, roles, acts) {
  const d = session.draft;
  const isEdit = Boolean(session.editingId);

  const roleOptions = [
    `<option value="">— 选择角色 —</option>`,
    ...roles.map((r) =>
      `<option value="${escapeHtml(r.id)}" ${d.actorId === r.id ? "selected" : ""}>${escapeHtml(r.name || r.label || r.id)}</option>`
    )
  ].join("");

  const actOptions = [
    ...acts.map((a) =>
      `<option value="${escapeHtml(a.id)}" ${d.actId === a.id ? "selected" : ""}>${escapeHtml(a.name || a.title || "未命名幕")}</option>`
    )
  ].join("");

  const lineOptions = Array.from({ length: MAX_PARALLEL_LINES }, (_, i) =>
    `<option value="${i}" ${d.parallelLine === i ? "selected" : ""}>线 ${i + 1}</option>`
  ).join("");

  const cognitionsHtml = (d.cognitions || []).map((c, i) => {
    const charOptions = [
      `<option value="">— 选择角色 —</option>`,
      ...roles.map((r) =>
        `<option value="${escapeHtml(r.id)}" ${c.characterId === r.id ? "selected" : ""}>${escapeHtml(r.name || r.label || r.id)}</option>`
      )
    ].join("");
    return `
      <div class="timeline-cognition-editor">
        <div class="cognition-row">
          <select class="field" data-cognition-index="${i}" data-cognition-field="characterId">${charOptions}</select>
          <div class="cognition-type-toggle">
            <button type="button" class="${!c.isMisleading ? "is-black" : ""}" data-cognition-index="${i}" data-cognition-type="correct" title="正确认知">黑</button>
            <button type="button" class="${c.isMisleading ? "is-red" : ""}" data-cognition-index="${i}" data-cognition-type="misleading" title="误导性认知">红</button>
          </div>
          <button type="button" class="btn quiet compact" data-action="timeline-remove-cognition" data-index="${i}">✕</button>
        </div>
        <textarea class="field" rows="2" data-cognition-index="${i}" data-cognition-field="content" placeholder="认知内容…">${escapeHtml(c.content)}</textarea>
      </div>
    `;
  }).join("");

  return `
    <div class="timeline-editor-panel">
      <h3>${isEdit ? "编辑时间线条目" : "新增时间线条目"}</h3>

      <div class="field-group">
        <label>所属幕
          <select class="field" data-timeline-field="actId">${actOptions}</select>
        </label>
      </div>

      <div class="field-group">
        <label>时间标记
          <input class="field" type="text" data-timeline-field="timestamp" value="${escapeHtml(d.timestamp)}" placeholder="例如 17:00 或 傍晚" />
        </label>
      </div>

      <div class="field-group">
        <label>排序
          <input class="field" type="number" data-timeline-field="sortOrder" value="${d.sortOrder}" min="0" max="9999" />
        </label>
      </div>

      <div class="field-group">
        <label>并行线
          <select class="field" data-timeline-field="parallelLine">${lineOptions}</select>
        </label>
      </div>

      <div class="field-group">
        <label>角色
          <select class="field" data-timeline-field="actorId">${roleOptions}</select>
        </label>
      </div>

      <div class="field-group">
        <label>行动
          <textarea class="field" rows="3" data-timeline-field="action" placeholder="角色做了什么…">${escapeHtml(d.action)}</textarea>
        </label>
      </div>

      <div class="field-group">
        <label>影响
          <textarea class="field" rows="2" data-timeline-field="impact" placeholder="这个行动对世界产生什么影响…">${escapeHtml(d.impact)}</textarea>
        </label>
      </div>

      <div class="field-group">
        <label>角色认知 <button type="button" class="btn quiet compact" data-action="timeline-add-cognition">+ 添加认知</button></label>
        ${cognitionsHtml || '<p class="hint">暂无认知条目</p>'}
      </div>

      <div class="panel-actions">
        <button type="button" class="btn primary" data-action="timeline-save-entry">保存</button>
        <button type="button" class="btn outline" data-action="timeline-cancel-entry">取消</button>
      </div>
    </div>
  `;
}

// ── Bind ──
export function bindTimeline(data, session) {
  const root = document.querySelector(`[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";

  root.querySelectorAll("[data-action='timeline-filter-all']").forEach((el) => {
    el.addEventListener("click", () => setTimelineActFilter(""));
  });
  root.querySelectorAll("[data-action='timeline-filter-act']").forEach((el) => {
    el.addEventListener("click", () => setTimelineActFilter(el.dataset.actId));
  });

  root.querySelector("[data-action='timeline-close']")?.addEventListener("click", closeTimeline);

  root.querySelectorAll("[data-action='timeline-add-entry']").forEach((el) => {
    el.addEventListener("click", () => {
      const line = parseInt(el.dataset.parallelLine, 10) || 0;
      const s = currentSession();
      if (!s) return;
      s.editingId = null;
      s.draft = {
        ...emptyTimelineDraft(),
        actId: s.view.filterActId || (getActs(studioStore.get().cloudStudio)[0]?.id || ""),
        parallelLine: line
      };
      render();
    });
  });

  root.querySelectorAll("[data-action='timeline-edit-entry']").forEach((el) => {
    el.addEventListener("click", () => openTimelineEntryEditor(el.dataset.entryId));
  });
  root.querySelectorAll("[data-action='timeline-delete-entry']").forEach((el) => {
    el.addEventListener("click", () => deleteTimelineEntry(el.dataset.entryId));
  });

  root.querySelectorAll("[data-timeline-field]").forEach((el) => {
    const field = el.dataset.timelineField;
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateTimelineDraft(field, el.value));
  });

  root.querySelectorAll("[data-cognition-index]").forEach((el) => {
    const index = parseInt(el.dataset.cognitionIndex, 10);
    const type = el.dataset.cognitionType;
    const field = el.dataset.cognitionField;
    if (type) {
      el.addEventListener("click", () => {
        const isMisleading = type === "misleading";
        updateCognitionInDraft(index, "isMisleading", isMisleading);
        render();
      });
    } else if (field) {
      const eventType = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(eventType, () => updateCognitionInDraft(index, field, el.value));
    }
  });

  root.querySelector("[data-action='timeline-add-cognition']")?.addEventListener("click", addCognitionToDraft);
  root.querySelectorAll("[data-action='timeline-remove-cognition']").forEach((el) => {
    el.addEventListener("click", () => removeCognitionFromDraft(parseInt(el.dataset.index, 10)));
  });

  root.querySelector("[data-action='timeline-save-entry']")?.addEventListener("click", saveTimelineEntryEditor);
  root.querySelector("[data-action='timeline-cancel-entry']")?.addEventListener("click", closeTimelineEntryEditor);
}