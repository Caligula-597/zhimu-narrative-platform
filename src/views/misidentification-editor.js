/**
 * Misidentification Editor — misidentification register workspace.
 *
 * A misidentification is a mistaken belief held by a character. This tool:
 *   - Registers each misID: who holds it, when it forms, what belief it is,
 *     what clue / physical item overthrows it, when it is refuted, how long it lasts.
 *   - Displays records on a timeline (by act, ordered by time) with live
 *     (red) vs refuted (grey, struck-through) status.
 *   - Filter by act and by active/refuted state.
 *   - Side panel to add / edit / delete records.
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openMisidentification()
 *   closeMisidentification()
 *   misidentificationWorkspaceHtml(data, session)
 *   bindMisidentification(data, session)
 */

import * as zhimuApi from "../api/index.js";
import * as misApi from "../api/misidentification.js";
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
import { buildMisidentification, emptyMisidentificationDraft } from "../../shared/misidentification.js";

const TOOL_TYPE = "misidentification";

// ── Data accessors (from creator studio) ──
function getActs(data) {
  return data?.chapters || [];
}
function getRoles(data) {
  return data?.roles || [];
}
function getClues(data) {
  return data?.clues || [];
}
function getItems(data) {
  return data?.items || [];
}
function actName(data, id) {
  return getActs(data).find((a) => a.id === id)?.name || getActs(data).find((a) => a.id === id)?.title || id.slice(0, 8);
}
function clueName(data, id) {
  return getClues(data).find((c) => c.id === id)?.name || id.slice(0, 8);
}
function itemName(data, id) {
  return getItems(data).find((i) => i.id === id)?.name || id.slice(0, 8);
}

function currentSession() {
  const data = studioStore.get().cloudStudio;
  return getWriterToolSession(data)?.type === TOOL_TYPE ? getWriterToolSession(data) : null;
}

// ── Open / Close ──
export async function openMisidentification() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用误认登记");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: { items: [], filterActId: "", filterActive: "" },
    draft: { ...emptyMisidentificationDraft(), actId: getActs(data)[0]?.id || "" },
    editingId: null,
    loading: true
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view = {
      items: (await misApi.listMisidentifications(session.worldId, {})) || [],
      filterActId: "",
      filterActive: ""
    };
  } catch (error) {
    session.error = normalizeError(error, "读取误认登记失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function closeMisidentification() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

// ── Actions ──
export async function setMisidentificationFilter(field, value) {
  const session = currentSession();
  if (!session) return;
  if (field === "actId") session.view.filterActId = value;
  if (field === "active") session.view.filterActive = value;
  session.loading = true;
  render();
  try {
    session.view.items = (await misApi.listMisidentifications(session.worldId, {
      actId: session.view.filterActId || undefined,
      isActive: session.view.filterActive || undefined
    })) || [];
  } catch (error) {
    session.error = normalizeError(error, "筛选失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function openMisidentificationEditor(editingId = null) {
  const session = currentSession();
  if (!session) return;
  if (editingId) {
    const item = session.view.items.find((m) => m.id === editingId);
    if (!item) return;
    session.draft = buildMisidentification(item);
    session.editingId = item.id;
  } else {
    session.draft = { ...emptyMisidentificationDraft(), actId: session.view.filterActId || getActs(studioStore.get().cloudStudio)[0]?.id || "" };
    session.editingId = null;
  }
  render();
}

export function closeMisidentificationEditor() {
  const session = currentSession();
  if (!session) return;
  session.draft = { ...emptyMisidentificationDraft() };
  session.editingId = null;
  render();
}

export function updateMisidentificationDraft(field, value) {
  const session = currentSession();
  if (!session) return;
  session.draft[field] = value;
}

export async function saveMisidentificationEditor() {
  const session = currentSession();
  if (!session) return;
  const d = session.draft;
  if (!d.actId || !d.title || !d.content) {
    return showToast("请填写所属幕、误认标题和误认内容");
  }
  const body = {
    actId: d.actId,
    timestamp: d.timestamp,
    sortOrder: d.sortOrder,
    holderId: d.holderId || null,
    holderLabel: d.holderLabel,
    title: d.title,
    content: d.content,
    truth: d.truth,
    refutedByClueId: d.refutedByClueId || null,
    refutedByItemId: d.refutedByItemId || null,
    refutedAt: d.refutedAt,
    duration: d.duration,
    isActive: d.isActive
  };
  const op = session.editingId
    ? misApi.updateMisidentification(session.worldId, session.editingId, body)
    : misApi.createMisidentification(session.worldId, body);
  try {
    await op;
    showToast(session.editingId ? "已更新" : "已登记");
    session.editingId = null;
    session.draft = { ...emptyMisidentificationDraft() };
    session.loading = true;
    session.view.items = (await misApi.listMisidentifications(session.worldId, {
      actId: session.view.filterActId || undefined,
      isActive: session.view.filterActive || undefined
    })) || [];
  } catch (error) {
    showToast(normalizeError(error, "保存失败"));
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function deleteMisidentification(editingId) {
  const session = currentSession();
  if (!session || !editingId) return;
  if (!confirm("确定删除这条误认记录？")) return;
  try {
    await misApi.deleteMisidentification(session.worldId, editingId);
    showToast("已删除");
    session.view.items = (await misApi.listMisidentifications(session.worldId, {
      actId: session.view.filterActId || undefined,
      isActive: session.view.filterActive || undefined
    })) || [];
  } catch (error) {
    showToast(normalizeError(error, "删除失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

// ── Render ──
export function misidentificationWorkspaceHtml(data, session) {
  if (!session) return "";
  const acts = getActs(data);
  const roles = getRoles(data);
  const clues = getClues(data);
  const items = getItems(data);
  const allItems = session.view?.items || [];
  const filterActId = session.view?.filterActId || "";
  const filterActive = session.view?.filterActive || "";

  const actTabs = [
    `<button type="button" class="tab ${!filterActId ? "is-active" : ""}" data-action="misident-filter-all">全部</button>`,
    ...acts.map((a) =>
      `<button type="button" class="tab ${filterActId === a.id ? "is-active" : ""}" data-action="misident-filter-act" data-act-id="${escapeHtml(a.id)}">${escapeHtml(a.name || a.title || "未命名幕")}</button>`
    )
  ].join("");

  const activeOptions = [
    `<option value="">全部状态</option>`,
    `<option value="true" ${filterActive === "true" ? "selected" : ""}>仍成立</option>`,
    `<option value="false" ${filterActive === "false" ? "selected" : ""}>已被推翻</option>`
  ].join("");

  const listHtml = allItems.length
    ? allItems.map((item) => misidentificationRowHtml(item, data)).join("")
    : `<div class="misident-empty">暂无误认记录</div>`;

  return `
    <style>
      .misident-shell{display:flex;flex-direction:column;gap:16px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .misident-header h2{margin:0 0 4px;font-size:20px;}
      .misident-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;}
      .misident-header .toolbar{display:flex;gap:8px;justify-content:flex-end;}
      .misident-filters{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
      .misident-act-filter{display:flex;gap:6px;flex-wrap:wrap;}
      .misident-act-filter .tab{padding:6px 12px;border:1px solid var(--line,#dfe7e3);border-radius:999px;background:transparent;cursor:pointer;font-size:12px;}
      .misident-act-filter .tab.is-active{background:var(--accent,#587b72);color:#fff;border-color:transparent;}
      .misident-active-filter{width:140px;}
      .misident-timeline{display:flex;flex-direction:column;gap:10px;}
      .misident-item{display:grid;grid-template-columns:120px 1fr auto;gap:12px;align-items:start;padding:12px;border:1px solid var(--line,#dfe7e3);border-left:3px solid #b22d3a;border-radius:10px;background:var(--card,#fff);}
      .misident-item.is-refuted{border-left-color:#a8b3ae;opacity:.72;}
      .misident-item-time{display:flex;flex-direction:column;gap:4px;}
      .misident-time{font-weight:800;color:var(--ink,#22302c);font-size:13px;}
      .misident-duration{color:var(--muted,#6b7a74);font-size:11px;}
      .misident-item-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
      .misident-title{font-size:14px;}
      .misident-badge{font-size:10px;padding:2px 8px;border-radius:999px;font-weight:700;}
      .misident-badge.is-live{background:#fde7e7;color:#b22d3a;}
      .misident-badge.is-refuted{background:#eef1ef;color:#5c7069;}
      .misident-content{margin:6px 0 0;line-height:1.6;color:var(--ink,#22302c);}
      .misident-truth{margin:4px 0 0;color:#865f3c;font-size:12px;line-height:1.6;}
      .misident-refuted-by{margin:4px 0 0;color:var(--muted,#6b7a74);font-size:12px;}
      .misident-item-actions{display:flex;gap:4px;}
      .misident-item-actions button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);font-size:13px;}
      .misident-item-actions button:hover{color:var(--ink,#22302c);}
      .misident-empty,.misident-error{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:24px;}
      .misident-error{color:#b22d3a;}
      .misident-editor-panel{margin-top:6px;padding:16px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px;}
      .misident-editor-panel h3{margin:0;font-size:15px;}
      .misident-editor-panel label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);flex:1;}
      .misident-field-row{display:flex;gap:12px;}
      .misident-field-row label{min-width:0;}
      .misident-editor-panel .field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;font-size:13px;color:var(--ink,#22302c);background:var(--bg,#f7faf8);}
      .misident-active-toggle{flex-direction:row !important;align-items:center;gap:8px !important;}
      .misident-active-toggle input{width:16px;height:16px;}
      .misident-panel-actions{display:flex;gap:8px;justify-content:flex-end;}
      .misident-panel-actions .btn{padding:8px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;}
      .misident-panel-actions .btn.primary{background:var(--accent,#587b72);color:#fff;}
      .misident-panel-actions .btn.outline{background:transparent;border-color:var(--line,#dfe7e3);}
    </style>
    <section class="misident-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="misident-header">
        <h2>误认登记</h2>
        <p class="misident-lede">记录角色持有的错误认知、形成时间、推翻它的证据与持续时间，并按时间线展示。</p>
        <div class="toolbar">
          <button type="button" class="btn primary" data-action="misident-add">+ 新增误认</button>
          <button type="button" class="btn quiet" data-action="misident-close">关闭</button>
        </div>
      </div>

      <div class="misident-filters">
        <div class="misident-act-filter">${actTabs}</div>
        <select class="field misident-active-filter" data-misident-filter="active">${activeOptions}</select>
      </div>

      ${session.loading ? '<div class="loading-dots">加载中…</div>' : `
        <div class="misident-timeline">
          ${listHtml}
        </div>
      `}

      ${session.editingId !== undefined ? misidentificationEditorPanelHtml(data, session, roles, acts, clues, items) : ""}
      ${session.error && !session.editingId ? `<div class="misident-error">${escapeHtml(session.error)}</div>` : ""}
    </section>
  `;
}

function holderLabel(data, item) {
  const role = getRoles(data).find((r) => r.id === item.holderId);
  if (role) return role.name || role.label || item.holderLabel || item.holderId.slice(0, 8);
  return item.holderLabel || item.holderId?.slice(0, 8) || "未知";
}

function refutedByLabel(data, item) {
  const parts = [];
  if (item.refutedByClueId) parts.push(`线索「${clueName(data, item.refutedByClueId)}」`);
  if (item.refutedByItemId) parts.push(`物证「${itemName(data, item.refutedByItemId)}」`);
  return parts.length ? parts.join(" + ") : "";
}

function misidentificationRowHtml(item, data) {
  const live = item.isActive !== false;
  const cls = live ? "is-live" : "is-refuted";
  const holder = holderLabel(data, item);
  const refutedBy = refutedByLabel(data, item);
  return `
    <article class="misident-item ${cls}">
      <div class="misident-item-time">
        <span class="misident-time">${escapeHtml(item.timestamp || "—")}</span>
        ${item.duration ? `<span class="misident-duration">${escapeHtml(item.duration)}</span>` : ""}
      </div>
      <div class="misident-item-body">
        <div class="misident-item-top">
          <strong class="misident-title">${escapeHtml(item.title || "误认")}</strong>
          <span class="misident-badge ${cls}">${live ? "仍成立" : "已被推翻"}</span>
        </div>
        <p class="misident-content"><b>${escapeHtml(holder)}</b> 误认：${escapeHtml(item.content)}</p>
        ${item.truth ? `<p class="misident-truth">真相：${escapeHtml(item.truth)}</p>` : ""}
        ${refutedBy ? `<p class="misident-refuted-by">推翻来源：${refutedBy}${item.refutedAt ? ` · ${escapeHtml(item.refutedAt)}` : ""}</p>` : ""}
      </div>
      <div class="misident-item-actions">
        <button type="button" data-action="misident-edit" data-mis-id="${escapeHtml(item.id)}" title="编辑">✎</button>
        <button type="button" data-action="misident-delete" data-mis-id="${escapeHtml(item.id)}" title="删除">✕</button>
      </div>
    </article>
  `;
}

function optionList(label, list, valueKey, labelKey) {
  return [
    `<option value="">— ${label} —</option>`,
    ...list.map((x) =>
      `<option value="${escapeHtml(x[valueKey])}">${escapeHtml(x[labelKey] || x.id)}</option>`
    )
  ].join("");
}

function misidentificationEditorPanelHtml(data, session, roles, acts, clues, items) {
  const d = session.draft;
  const isEdit = Boolean(session.editingId);
  const actOptions = acts.map((a) =>
    `<option value="${escapeHtml(a.id)}" ${d.actId === a.id ? "selected" : ""}>${escapeHtml(a.name || a.title || "未命名幕")}</option>`
  ).join("");
  const roleOptions = optionList("选择持有者", roles, "id", "name");
  const clueOptions = optionList("选择推翻线索（可空）", clues, "id", "name");
  const itemOptions = optionList("选择推翻物证（可空）", items, "id", "name");

  return `
    <div class="misident-editor-panel">
      <h3>${isEdit ? "编辑误认" : "新增误认"}</h3>

      <div class="misident-field-row">
        <label>所属幕
          <select class="field" data-misident-field="actId">${actOptions}</select>
        </label>
        <label>误认标题（如 K-01）
          <input class="field" type="text" data-misident-field="title" value="${escapeHtml(d.title)}" placeholder="例如 K-01" />
        </label>
      </div>

      <div class="misident-field-row">
        <label>形成时间
          <input class="field" type="text" data-misident-field="timestamp" value="${escapeHtml(d.timestamp)}" placeholder="例如 17:00 或 傍晚" />
        </label>
        <label>排序
          <input class="field" type="number" data-misident-field="sortOrder" value="${d.sortOrder}" min="0" max="9999" />
        </label>
      </div>

      <label>持有者
        <select class="field" data-misident-field="holderId">${roleOptions}</select>
      </label>
      <label>持有者标注
        <input class="field" type="text" data-misident-field="holderLabel" value="${escapeHtml(d.holderLabel)}" placeholder="未绑定角色时填写显示名" />
      </label>

      <label>误认内容
        <textarea class="field" rows="3" data-misident-field="content" placeholder="这个角色误认了什么…">${escapeHtml(d.content)}</textarea>
      </label>
      <label>真相
        <textarea class="field" rows="2" data-misident-field="truth" placeholder="事实是什么（纠正该误认）…">${escapeHtml(d.truth)}</textarea>
      </label>

      <div class="misident-field-row">
        <label>推翻线索（证据）
          <select class="field" data-misident-field="refutedByClueId">${clueOptions}</select>
        </label>
        <label>推翻物证
          <select class="field" data-misident-field="refutedByItemId">${itemOptions}</select>
        </label>
      </div>

      <div class="misident-field-row">
        <label>被推翻时间
          <input class="field" type="text" data-misident-field="refutedAt" value="${escapeHtml(d.refutedAt)}" placeholder="例如 18:20" />
        </label>
        <label>持续时间
          <input class="field" type="text" data-misident-field="duration" value="${escapeHtml(d.duration)}" placeholder="例如 17:40–19:30" />
        </label>
      </div>

      <label class="misident-active-toggle">
        <input type="checkbox" data-misident-field="isActive" ${d.isActive !== false ? "checked" : ""} />
        仍成立（未勾选表示该误认已被推翻）
      </label>

      <div class="misident-panel-actions">
        <button type="button" class="btn primary" data-action="misident-save">保存</button>
        <button type="button" class="btn outline" data-action="misident-cancel">取消</button>
      </div>
    </div>
  `;
}

// ── Bind DOM events ──
export function bindMisidentification(data, session) {
  const root = document.querySelector(`[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";

  root.querySelector("[data-action='misident-close']")?.addEventListener("click", closeMisidentification);
  root.querySelector("[data-action='misident-add']")?.addEventListener("click", () => openMisidentificationEditor(null));
  root.querySelector("[data-action='misident-filter-all']")?.addEventListener("click", () => setMisidentificationFilter("actId", ""));
  root.querySelectorAll("[data-action='misident-filter-act']").forEach((el) =>
    el.addEventListener("click", () => setMisidentificationFilter("actId", el.dataset.actId)));
  root.querySelector("[data-misident-filter='active']")?.addEventListener("change", (e) =>
    setMisidentificationFilter("active", e.target.value));

  root.querySelectorAll("[data-action='misident-edit']").forEach((el) =>
    el.addEventListener("click", () => openMisidentificationEditor(el.dataset.misId)));
  root.querySelectorAll("[data-action='misident-delete']").forEach((el) =>
    el.addEventListener("click", () => deleteMisidentification(el.dataset.misId)));

  root.querySelectorAll("[data-misident-field]").forEach((el) => {
    const field = el.dataset.misidentField;
    const eventType = el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input";
    el.addEventListener(eventType, () => {
      const value = el.type === "checkbox" ? el.checked : el.value;
      updateMisidentificationDraft(field, value);
    });
  });

  root.querySelector("[data-action='misident-save']")?.addEventListener("click", saveMisidentificationEditor);
  root.querySelector("[data-action='misident-cancel']")?.addEventListener("click", closeMisidentificationEditor);
}