/**
 * Location / Scene-State Enhancement — workspace (缺口 L).
 *
 * 登记地点/开放地图/现场状态：衙门令搜证、现场改写（已搜证/被改写/尸体数）、
 * 监狱即时杀人点。属"增强"性质。
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openLocationState()
 *   closeLocationState()
 *   locationStateWorkspaceHtml(data, session)
 *   bindLocationState(data, session)
 */

import * as locApi from "../api/location-state.js";
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
  buildLocRecord,
  emptyLocDraft,
  LOC_KINDS
} from "../../shared/location-state.js";

const TOOL_TYPE = "location-state";

function stateEntries(state = {}) {
  return Object.entries(state || {}).map(([key, value]) => ({ key, value }));
}

function entriesToState(entries = []) {
  const out = {};
  (entries || []).forEach((row) => {
    out[row.key] = Number(row.value) || 0;
  });
  return out;
}

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const s = getWriterToolSession(data);
  return s?.type === TOOL_TYPE ? s : null;
}

// ── Open / Close ──
export async function openLocationState() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用地点状态");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: { locs: [] },
    draft: { ...emptyLocDraft() },
    editingId: null,
    loading: true
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view.locs = (await locApi.listLocLocations(session.worldId)) || [];
  } catch (error) {
    session.error = normalizeError(error, "读取地点状态失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function closeLocationState() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

export function openLocEditor(editingId = null) {
  const session = currentSession();
  if (!session) return;
  if (editingId) {
    const loc = session.view.locs.find((r) => r.id === editingId);
    if (!loc) return;
    session.draft = buildLocRecord(loc);
    session.editingId = loc.id;
  } else {
    session.draft = { ...emptyLocDraft(), sequence: (session.view.locs.length || 0) + 1 };
    session.editingId = null;
  }
  render();
}

export function closeLocEditor() {
  const session = currentSession();
  if (!session) return;
  session.draft = { ...emptyLocDraft() };
  session.editingId = null;
  render();
}

export function updateLocDraft(field, value) {
  const session = currentSession();
  if (!session) return;
  session.draft[field] = value;
}

export function updateLocBool(field, value) {
  const session = currentSession();
  if (!session) return;
  session.draft[field] = Boolean(value);
}

export function updateLocStateEntry(index, field, value) {
  const session = currentSession();
  if (!session) return;
  const entries = stateEntries(session.draft.state);
  if (!entries[index]) entries[index] = { key: "", value: 0 };
  entries[index][field] = field === "value" ? (Number(value) || 0) : value;
  session.draft.state = entriesToState(entries);
}

export function addLocStateEntry() {
  const session = currentSession();
  if (!session) return;
  const entries = stateEntries(session.draft.state);
  entries.push({ key: "", value: 0 });
  session.draft.state = entriesToState(entries);
  render();
}

export function removeLocStateEntry(index) {
  const session = currentSession();
  if (!session) return;
  const entries = stateEntries(session.draft.state);
  entries.splice(index, 1);
  session.draft.state = entriesToState(entries);
  render();
}

export async function saveLocEditor() {
  const session = currentSession();
  if (!session) return;
  const d = session.draft;
  if (!d.title && !d.note && !d.itemsNote) {
    return showToast("请填写标题或提示内容，否则该记录无意义");
  }
  const body = {
    title: d.title || `LOC-${String(d.sequence || 0).padStart(2, "0")} · ${d.kind}`,
    sequence: d.sequence || 0,
    kind: d.kind,
    searchable: d.searchable ?? true,
    rewritable: d.rewritable ?? false,
    state: d.state || {},
    combat: d.combat ?? false,
    itemsNote: d.itemsNote,
    note: d.note
  };
  const op = session.editingId
    ? locApi.updateLocLocation(session.worldId, session.editingId, body)
    : locApi.createLocLocation(session.worldId, body);
  try {
    await op;
    showToast(session.editingId ? "已更新" : "已创建");
    session.editingId = null;
    session.draft = { ...emptyLocDraft() };
    session.loading = true;
    session.view.locs = (await locApi.listLocLocations(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "保存失败"));
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function deleteLoc(editingId) {
  const session = currentSession();
  if (!session || !editingId) return;
  if (!confirm("确定删除这条地点记录？")) return;
  try {
    await locApi.deleteLocLocation(session.worldId, editingId);
    showToast("已删除");
    session.view.locs = (await locApi.listLocLocations(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "删除失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

// ── Render ──
export function locationStateWorkspaceHtml(data, session) {
  if (!session) return "";
  const locs = session.view?.locs || [];

  const listHtml = (locs || []).length
    ? (locs || []).map((l) => locCardHtml(l)).join("")
    : `<div class="loc-empty">暂无地点记录</div>`;

  return `
    <style>
      .loc-shell{display:flex;flex-direction:column;gap:16px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .loc-header h2{margin:0 0 4px;font-size:20px;}
      .loc-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;}
      .loc-header .toolbar{display:flex;gap:8px;justify-content:flex-end;}
      .loc-list{display:flex;flex-direction:column;gap:10px;}
      .loc-card{padding:14px;border:1px solid var(--line,#dfe7e3);border-left:3px solid #4b6a8a;border-radius:10px;background:var(--card,#fff);}
      .loc-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px;}
      .loc-card-top strong{font-size:15px;}
      .loc-kind{color:var(--muted,#6b7a74);font-size:12px;margin-top:2px;}
      .loc-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
      .loc-badge{padding:3px 10px;border-radius:999px;font-size:12px;background:#eef3fb;color:#4569a8;}
      .loc-badge.on{background:#e9f3ee;color:#3f7a62;}
      .loc-badge.danger{background:#fef0ec;color:#b3402f;}
      .loc-card-actions{display:flex;gap:4px;}
      .loc-card-actions button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);}
      .loc-empty,.loc-error{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:24px;}
      .loc-error{color:#b22d3a;}
      .loc-editor-panel{margin-top:6px;padding:16px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px;}
      .loc-editor-panel h3{margin:0;font-size:15px;}
      .loc-editor-panel label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);flex:1;min-width:0;}
      .loc-row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;}
      .loc-editor-panel .field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;font-size:13px;color:var(--ink,#22302c);background:var(--bg,#f7faf8);}
      .loc-check{flex-direction:row;align-items:center;gap:6px;}
      .loc-check input{width:auto;}
      .loc-state-editor{border:1px solid var(--line,#dfe7e3);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px;background:var(--bg,#f7faf8);}
      .loc-state-editor .loc-state-head{display:flex;justify-content:space-between;align-items:center;}
      .loc-state-editor .loc-state-head b{font-size:12px;color:var(--muted,#6b7a74);}
      .loc-state-tools{display:flex;gap:4px;}
      .loc-state-tools button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);}
      .loc-panel-actions{display:flex;gap:8px;justify-content:flex-end;}
      .loc-panel-actions .btn{padding:8px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;}
      .loc-panel-actions .btn.primary{background:var(--accent,#587b72);color:#fff;}
      .loc-panel-actions .btn.outline{background:transparent;border-color:var(--line,#dfe7e3);}
    </style>
    <section class="loc-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="loc-header">
        <h2>地点与现场状态编辑器</h2>
        <p class="loc-lede">登记地点 / 开放地图 / 现场状态：衙门令搜证、现场改写（已搜证 / 被改写 / 尸体数）、监狱即时杀人点。</p>
        <div class="toolbar">
          <button type="button" class="btn primary" data-action="loc-add">+ 新增地点</button>
          <button type="button" class="btn quiet" data-action="loc-close">关闭</button>
        </div>
      </div>

      ${session.loading ? '<div class="loading-dots">加载中…</div>' : `<div class="loc-list">${listHtml}</div>`}
      ${session.error && !session.editingId ? `<div class="loc-error">${escapeHtml(session.error)}</div>` : ""}
      ${session.editingId !== undefined ? locEditorPanelHtml(session) : ""}
    </section>
  `;
}

function locCardHtml(loc) {
  const badges = [];
  badges.push(`<span class="loc-badge">${escapeHtml(loc.kind)}</span>`);
  if (loc.searchable) badges.push('<span class="loc-badge on">可搜证</span>');
  if (loc.rewritable) badges.push('<span class="loc-badge on">可改写</span>');
  if (loc.combat) badges.push('<span class="loc-badge danger">监狱即时杀人点</span>');
  return `
    <article class="loc-card">
      <div class="loc-card-top">
        <div>
          <strong>${escapeHtml(loc.title || "未命名")}</strong>
          ${loc.note ? `<p class="loc-kind">${escapeHtml(loc.note)}</p>` : ""}
        </div>
        <div class="loc-card-actions">
          <button type="button" data-action="loc-edit" data-loc-id="${escapeHtml(loc.id)}" title="编辑">✎</button>
          <button type="button" data-action="loc-delete" data-loc-id="${escapeHtml(loc.id)}" title="删除">✕</button>
        </div>
      </div>
      <div class="loc-badges">${badges.join("")}</div>
      ${loc.itemsNote ? `<p class="loc-kind">物品：${escapeHtml(loc.itemsNote)}</p>` : ""}
    </article>
  `;
}

function locEditorPanelHtml(session) {
  const d = session.draft;
  const isEdit = Boolean(session.editingId);
  const kindOpts = LOC_KINDS.map((k) =>
    `<option value="${k}" ${d.kind === k ? "selected" : ""}>${k}</option>`).join("");
  const stateEntriesList = stateEntries(d.state);
  const stateHtml = (stateEntriesList.length ? stateEntriesList : [{ key: "", value: 0 }]).map((e, i) => `
    <div class="loc-state-editor">
      <div class="loc-state-head">
        <b>现场状态 ${i + 1}</b>
        <div class="loc-state-tools">
          <button type="button" data-action="loc-state-remove" data-index="${i}">✕</button>
        </div>
      </div>
      <input class="field" type="text" data-loc-state-field="${i}::key" value="${escapeHtml(e.key)}" placeholder="键，例如 已搜证 / 尸体数" />
      <input class="field" type="number" step="any" data-loc-state-field="${i}::value" value="${escapeHtml(String(e.value))}" placeholder="值，例如 1 / 2" />
    </div>
  `).join("");

  return `
    <div class="loc-editor-panel">
      <h3>${isEdit ? "编辑地点记录" : "新增地点记录"}</h3>
      <div class="loc-row">
        <label>标题（如 LOC-01 城西青树）
          <input class="field" type="text" data-loc-field="title" value="${escapeHtml(d.title)}" placeholder="例如 LOC-01 城西青树" />
        </label>
        <label>排序
          <input class="field" type="number" data-loc-field="sequence" value="${escapeHtml(String(d.sequence ?? 0))}" />
        </label>
      </div>
      <div class="loc-row">
        <label>类别
          <select class="field" data-loc-field="kind">${kindOpts}</select>
        </label>
      </div>
      <div class="loc-row">
        <label class="loc-check"><input type="checkbox" data-loc-bool="searchable" ${d.searchable ? "checked" : ""} /> 可搜证</label>
        <label class="loc-check"><input type="checkbox" data-loc-bool="rewritable" ${d.rewritable ? "checked" : ""} /> 现场可被改写</label>
        <label class="loc-check"><input type="checkbox" data-loc-bool="combat" ${d.combat ? "checked" : ""} /> 监狱即时杀人点</label>
      </div>

      <div class="loc-row">
        <label>现场状态 <button type="button" class="btn quiet compact" data-action="loc-state-add">+ 添加状态</button></label>
      </div>
      ${stateHtml}

      <label>物品 / 陈列说明
        <textarea class="field" rows="2" data-loc-field="itemsNote" placeholder="此处陈列、可搜证物品…">${escapeHtml(d.itemsNote)}</textarea>
      </label>
      <label>备注
        <textarea class="field" rows="2" data-loc-field="note" placeholder="其他说明、搜证/改写/杀人点规则…">${escapeHtml(d.note)}</textarea>
      </label>

      <div class="loc-panel-actions">
        <button type="button" class="btn primary" data-action="loc-save">保存</button>
        <button type="button" class="btn outline" data-action="loc-cancel">取消</button>
      </div>
    </div>
  `;
}

// ── Bind ──
export function bindLocationState(data, session) {
  const root = document.querySelector(`[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";

  root.querySelector("[data-action='loc-close']")?.addEventListener("click", closeLocationState);
  root.querySelector("[data-action='loc-add']")?.addEventListener("click", () => openLocEditor(null));
  root.querySelectorAll("[data-action='loc-edit']").forEach((el) =>
    el.addEventListener("click", () => openLocEditor(el.dataset.locId)));
  root.querySelectorAll("[data-action='loc-delete']").forEach((el) =>
    el.addEventListener("click", () => deleteLoc(el.dataset.locId)));

  root.querySelectorAll("[data-loc-field]").forEach((el) => {
    const field = el.dataset.locField;
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateLocDraft(field, el.value));
  });

  root.querySelectorAll("[data-loc-bool]").forEach((el) => {
    el.addEventListener("change", () => updateLocBool(el.dataset.locBool, el.checked));
  });

  root.querySelectorAll("[data-loc-state-field]").forEach((el) => {
    const [indexStr, field] = el.dataset.locStateField.split("::");
    const index = parseInt(indexStr, 10);
    el.addEventListener("input", () => updateLocStateEntry(index, field, el.value));
  });

  root.querySelector("[data-action='loc-state-add']")?.addEventListener("click", addLocStateEntry);
  root.querySelectorAll("[data-action='loc-state-remove']").forEach((el) =>
    el.addEventListener("click", () => removeLocStateEntry(parseInt(el.dataset.index, 10))));

  root.querySelector("[data-action='loc-save']")?.addEventListener("click", saveLocEditor);
  root.querySelector("[data-action='loc-cancel']")?.addEventListener("click", closeLocEditor);
}