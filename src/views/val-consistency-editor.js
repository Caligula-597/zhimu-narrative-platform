/**
 * Val Consistency Ledger — workspace (缺口 V).
 *
 * A Val (一致性) record flags contradictory versions of the SAME fact
 * referenced elsewhere in the world, and drives 未决 → 待裁决 → 已统一.
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openValConsistency()
 *   closeValConsistency()
 *   valConsistencyWorkspaceHtml(data, session)
 *   bindValConsistency(data, session)
 */

import * as valApi from "../api/val-consistency.js";
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
  buildValRecord,
  emptyValDraft,
  VAL_STATUSES,
  nextValStatus
} from "../../shared/val-consistency.js";

const TOOL_TYPE = "val-consistency";

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const s = getWriterToolSession(data);
  return s?.type === TOOL_TYPE ? s : null;
}

// ── Open / Close ──
export async function openValConsistency() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用一致性台账");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: { records: [] },
    draft: { ...emptyValDraft() },
    editingId: null,
    loading: true
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view.records = (await valApi.listValRecords(session.worldId)) || [];
  } catch (error) {
    session.error = normalizeError(error, "读取一致性台账失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function closeValConsistency() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

export function openValEditor(editingId = null) {
  const session = currentSession();
  if (!session) return;
  if (editingId) {
    const record = session.view.records.find((r) => r.id === editingId);
    if (!record) return;
    session.draft = buildValRecord(record);
    session.editingId = record.id;
  } else {
    session.draft = { ...emptyValDraft(), sequence: (session.view.records.length || 0) + 1 };
    session.editingId = null;
  }
  render();
}

export function closeValEditor() {
  const session = currentSession();
  if (!session) return;
  session.draft = { ...emptyValDraft() };
  session.editingId = null;
  render();
}

export function updateValDraft(field, value) {
  const session = currentSession();
  if (!session) return;
  session.draft[field] = value;
}

export function advanceValStatus(recordId) {
  const session = currentSession();
  if (!session) return;
  const record = session.view.records.find((r) => r.id === recordId);
  if (!record) return;
  const next = nextValStatus(record.status);
  if (!next) return;
  const body = { status: next };
  valApi.updateValRecord(session.worldId, recordId, body)
    .then(async () => {
      showToast(`状态移至「${next}」`);
      session.view.records = (await valApi.listValRecords(session.worldId)) || [];
    })
    .catch((error) => showToast(normalizeError(error, "更新状态失败")))
    .finally(() => {
      if (writerToolSessionIsCurrent(session)) render();
    });
}

export async function saveValEditor() {
  const session = currentSession();
  if (!session) return;
  const d = session.draft;
  if (!d.referencesEntry && !d.conflictDesc && !d.title) {
    return showToast("请填写涉及条目或冲突点，否则该记录无意义");
  }
  const body = {
    title: d.title || `VAL-${String(d.sequence || 0).padStart(2, "0")}`,
    sequence: d.sequence || 0,
    referencesEntry: d.referencesEntry,
    conflictDesc: d.conflictDesc,
    versionA: d.versionA,
    versionB: d.versionB,
    recommendation: d.recommendation,
    status: d.status
  };
  const op = session.editingId
    ? valApi.updateValRecord(session.worldId, session.editingId, body)
    : valApi.createValRecord(session.worldId, body);
  try {
    await op;
    showToast(session.editingId ? "已更新" : "已创建");
    session.editingId = null;
    session.draft = { ...emptyValDraft() };
    session.loading = true;
    session.view.records = (await valApi.listValRecords(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "保存失败"));
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function deleteValRecord(editingId) {
  const session = currentSession();
  if (!session || !editingId) return;
  if (!confirm("确定删除这条一致性记录？")) return;
  try {
    await valApi.deleteValRecord(session.worldId, editingId);
    showToast("已删除");
    session.view.records = (await valApi.listValRecords(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "删除失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

// ── Render ──
const VAL_STATUS_CLASS = { 未决: "val-status-open", 待裁决: "val-status-pending", 已统一: "val-status-done" };

export function valConsistencyWorkspaceHtml(data, session) {
  if (!session) return "";
  const records = session.view?.records || [];

  const counts = VAL_STATUSES.reduce((acc, s) => {
    acc[s] = (records || []).filter((r) => r.status === s).length;
    return acc;
  }, {});
  const openCount = (counts["未决"] || 0) + (counts["待裁决"] || 0);

  const listHtml = (records || []).length
    ? (records || []).map((r) => valCardHtml(r)).join("")
    : `<div class="val-empty">暂无一致性记录</div>`;

  return `
    <style>
      .val-shell{display:flex;flex-direction:column;gap:16px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .val-header h2{margin:0 0 4px;font-size:20px;}
      .val-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;}
      .val-header .toolbar{display:flex;gap:8px;justify-content:flex-end;}
      .val-banner{border:1px solid var(--line,#dfe7e3);border-left:4px solid #b7791f;border-radius:8px;padding:10px 12px;background:var(--card,#fff);color:var(--muted,#6b7a74);font-size:12px;}
      .val-banner b{color:#a05a13;}
      .val-list{display:flex;flex-direction:column;gap:10px;}
      .val-card{padding:14px;border:1px solid var(--line,#dfe7e3);border-left:3px solid #b7791f;border-radius:10px;background:var(--card,#fff);}
      .val-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px;}
      .val-card-top strong{font-size:15px;}
      .val-ref{color:var(--muted,#6b7a74);font-size:12px;margin-top:2px;}
      .val-conflict{margin-top:8px;font-size:13px;color:var(--ink,#22302c);white-space:pre-wrap;}
      .val-versions{display:flex;flex-direction:column;gap:6px;margin-top:8px;}
      .val-ver{font-size:12px;padding:6px 8px;border-radius:6px;white-space:pre-wrap;}
      .val-ver.a{background:#fdf0ee;color:#8a2320;border:1px solid #f0c9c4;border-left:3px solid #c0392b;}
      .val-ver.b{background:#eef3fb;color:#24406b;border:1px solid #ccd9ec;border-left:3px solid #4569a8;}
      .val-reco{margin-top:8px;font-size:12px;color:var(--muted,#6b7a74);}
      .val-reco b{color:var(--ink,#22302c);}
      .val-status{margin-top:8px;display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;}
      .val-status-open{background:#fef0ec;color:#b3402f;}
      .val-status-pending{background:#fff5df;color:#a4701a;}
      .val-status-done{background:#e9f3ee;color:#3f7a62;}
      .val-card-actions{display:flex;gap:4px;align-items:center;}
      .val-card-actions button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);}
      .val-card-actions .val-advance{color:#587b72;font-size:12px;padding:4px 8px;}
      .val-empty,.val-error{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:24px;}
      .val-error{color:#b22d3a;}
      .val-editor-panel{margin-top:6px;padding:16px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px;}
      .val-editor-panel h3{margin:0;font-size:15px;}
      .val-editor-panel label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);flex:1;min-width:0;}
      .val-row{display:flex;gap:12px;flex-wrap:wrap;}
      .val-editor-panel .field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;font-size:13px;color:var(--ink,#22302c);background:var(--bg,#f7faf8);}
      .val-panel-actions{display:flex;gap:8px;justify-content:flex-end;}
      .val-panel-actions .btn{padding:8px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;}
      .val-panel-actions .btn.primary{background:var(--accent,#587b72);color:#fff;}
      .val-panel-actions .btn.outline{background:transparent;border-color:var(--line,#dfe7e3);}
    </style>
    <section class="val-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="val-header">
        <h2>一致性台账</h2>
        <p class="val-lede">登记同一事实在多处被引用时出现的矛盾版本，推动"版本归位（未决 → 待裁决 → 已统一）"。当某条目只改了单边版本、未同步关联处时，靠它提示。</p>
        <div class="toolbar">
          <button type="button" class="btn primary" data-action="val-add">+ 新增一致性记录</button>
          <button type="button" class="btn quiet" data-action="val-close">关闭</button>
        </div>
      </div>

      <div class="val-banner">待统一 <b>${openCount}</b> 条（未决 ${counts["未决"] || 0} · 待裁决 ${counts["待裁决"] || 0} · 已统一 ${counts["已统一"] || 0}）</div>

      ${session.loading ? '<div class="loading-dots">加载中…</div>' : `<div class="val-list">${listHtml}</div>`}
      ${session.error && !session.editingId ? `<div class="val-error">${escapeHtml(session.error)}</div>` : ""}
      ${session.editingId !== undefined ? valEditorPanelHtml(session) : ""}
    </section>
  `;
}

function valCardHtml(record) {
  const statusClass = VAL_STATUS_CLASS[record.status] || "val-status-open";
  const canAdvance = record.status !== "已统一";
  const verA = record.versionA ? `<div class="val-ver a"><b>版本 A：</b>${escapeHtml(record.versionA)}</div>` : "";
  const verB = record.versionB ? `<div class="val-ver b"><b>版本 B：</b>${escapeHtml(record.versionB)}</div>` : "";
  return `
    <article class="val-card">
      <div class="val-card-top">
        <strong>${escapeHtml(record.title || "未命名")}</strong>
        <div class="val-card-actions">
          ${canAdvance ? `<button type="button" class="val-advance" data-action="val-advance" data-val-id="${escapeHtml(record.id)}">→ ${escapeHtml(nextValStatus(record.status) || "")}</button>` : ""}
          <button type="button" data-action="val-edit" data-val-id="${escapeHtml(record.id)}" title="编辑">✎</button>
          <button type="button" data-action="val-delete" data-val-id="${escapeHtml(record.id)}" title="删除">✕</button>
        </div>
      </div>
      ${record.referencesEntry ? `<p class="val-ref">涉及条目：${escapeHtml(record.referencesEntry)}</p>` : ""}
      ${record.conflictDesc ? `<p class="val-conflict">冲突点：${escapeHtml(record.conflictDesc)}</p>` : ""}
      ${(verA || verB) ? `<div class="val-versions">${verA}${verB}</div>` : ""}
      ${record.recommendation ? `<p class="val-reco"><b>建议：</b>${escapeHtml(record.recommendation)}</p>` : ""}
      <span class="val-status ${statusClass}">${escapeHtml(record.status)}</span>
    </article>
  `;
}

function valEditorPanelHtml(session) {
  const d = session.draft;
  const isEdit = Boolean(session.editingId);
  const statusOpts = VAL_STATUSES.map((s) =>
    `<option value="${s}" ${d.status === s ? "selected" : ""}>${s}</option>`).join("");
  return `
    <div class="val-editor-panel">
      <h3>${isEdit ? "编辑一致性记录" : "新增一致性记录"}</h3>
      <div class="val-row">
        <label>记录标题（如 VAL-04）
          <input class="field" type="text" data-val-field="title" value="${escapeHtml(d.title)}" placeholder="例如 VAL-04" />
        </label>
        <label>排序
          <input class="field" type="number" data-val-field="sequence" value="${escapeHtml(String(d.sequence ?? 0))}" />
        </label>
      </div>
      <label>涉及条目 / 何处
        <input class="field" type="text" data-val-field="referencesEntry" value="${escapeHtml(d.referencesEntry)}" placeholder="哪个条目、哪一处被引用" />
      </label>
      <label>冲突点
        <textarea class="field" rows="2" data-val-field="conflictDesc" placeholder="两个版本在哪里打架（数值 / 时间 / 设定 / 归属…）">${escapeHtml(d.conflictDesc)}</textarea>
      </label>
      <div class="val-row">
        <label>版本 A
          <textarea class="field" rows="2" data-val-field="versionA" placeholder="版本 A 原样记录">${escapeHtml(d.versionA)}</textarea>
        </label>
      </div>
      <div class="val-row">
        <label>版本 B
          <textarea class="field" rows="2" data-val-field="versionB" placeholder="版本 B 原样记录">${escapeHtml(d.versionB)}</textarea>
        </label>
      </div>
      <label>建议（以哪个为准 / 如何统一）
        <textarea class="field" rows="2" data-val-field="recommendation" placeholder="建议保留哪版，或如何让关联处同步">${escapeHtml(d.recommendation)}</textarea>
      </label>
      <label>状态
        <select class="field" data-val-field="status">${statusOpts}</select>
      </label>
      <div class="val-panel-actions">
        <button type="button" class="btn primary" data-action="val-save">保存</button>
        <button type="button" class="btn outline" data-action="val-cancel">取消</button>
      </div>
    </div>
  `;
}

// ── Bind ──
export function bindValConsistency(data, session) {
  const root = document.querySelector(`[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";

  root.querySelector("[data-action='val-close']")?.addEventListener("click", closeValConsistency);
  root.querySelector("[data-action='val-add']")?.addEventListener("click", () => openValEditor(null));
  root.querySelectorAll("[data-action='val-edit']").forEach((el) =>
    el.addEventListener("click", () => openValEditor(el.dataset.valId)));
  root.querySelectorAll("[data-action='val-delete']").forEach((el) =>
    el.addEventListener("click", () => deleteValRecord(el.dataset.valId)));
  root.querySelectorAll("[data-action='val-advance']").forEach((el) =>
    el.addEventListener("click", () => advanceValStatus(el.dataset.valId)));

  root.querySelectorAll("[data-val-field]").forEach((el) => {
    const field = el.dataset.valField;
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateValDraft(field, el.value));
  });

  root.querySelector("[data-action='val-save']")?.addEventListener("click", saveValEditor);
  root.querySelector("[data-action='val-cancel']")?.addEventListener("click", closeValEditor);
}