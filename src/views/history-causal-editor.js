/**
 * Historical Causality Table Editor — workspace (缺口 H).
 *
 * Covers 《长生叹》H-01~H-26 history events as a causal chain. Each link is
 * cause → event → effect, ordered by sequence + 年代(whenText). Enables editing
 * the 500-year world history that shaped the present situation.
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openHistoryCausal()
 *   closeHistoryCausal()
 *   historyCausalWorkspaceHtml(data, session)
 *   bindHistoryCausal(data, session)
 */

import * as historyApi from "../api/history-causal.js";
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
  buildHistoryCausal,
  emptyHistoryCausalDraft
} from "../../shared/history-causal.js";

const TOOL_TYPE = "history-causal";

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const s = getWriterToolSession(data);
  return s?.type === TOOL_TYPE ? s : null;
}

function nextSequence(links) {
  return (links || []).reduce((max, l) => Math.max(max, Number(l.sequence) || 0), 0) + 1;
}

// ── Open / Close ──
export async function openHistoryCausal() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用历史因果表");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: { links: [] },
    draft: emptyHistoryCausalDraft(),
    editingId: null,
    loading: true
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view.links = (await historyApi.listHistoryCausalLinks(session.worldId)) || [];
  } catch (error) {
    session.error = normalizeError(error, "读取历史因果表失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function closeHistoryCausal() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

export function openHistoryCausalEditor(editingId = null) {
  const session = currentSession();
  if (!session) return;
  if (editingId) {
    const link = session.view.links.find((l) => l.id === editingId);
    if (!link) return;
    session.draft = buildHistoryCausal(link);
    session.editingId = link.id;
  } else {
    session.draft = { ...emptyHistoryCausalDraft(), sequence: nextSequence(session.view.links) };
    session.editingId = null;
  }
  render();
}

export function closeHistoryCausalEditor() {
  const session = currentSession();
  if (!session) return;
  session.draft = emptyHistoryCausalDraft();
  session.editingId = null;
  render();
}

export function updateHistoryCausalDraft(field, value) {
  const session = currentSession();
  if (!session) return;
  session.draft[field] = field === "sequence" ? Number(value) || 1 : value;
}

export async function saveHistoryCausalEditor() {
  const session = currentSession();
  if (!session) return;
  const d = session.draft;
  if (!d.title && !d.eventText) {
    return showToast("请至少填写历史事件标题或事件内容");
  }
  const body = {
    title: d.title || `H-${String(d.sequence).padStart(2, "0")}`,
    sequence: Number(d.sequence) || 1,
    whenText: d.whenText || "",
    actors: d.actors || "",
    causeText: d.causeText || "",
    eventText: d.eventText || "",
    effectText: d.effectText || "",
    summary: d.summary || ""
  };
  const op = session.editingId
    ? historyApi.updateHistoryCausalLink(session.worldId, session.editingId, body)
    : historyApi.createHistoryCausalLink(session.worldId, body);
  try {
    await op;
    showToast(session.editingId ? "已更新" : "已创建");
    session.editingId = null;
    session.draft = emptyHistoryCausalDraft();
    session.loading = true;
    session.view.links = (await historyApi.listHistoryCausalLinks(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "保存失败"));
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function deleteHistoryCausal(editingId) {
  const session = currentSession();
  if (!session || !editingId) return;
  if (!confirm("确定删除这条历史因果记录？")) return;
  try {
    await historyApi.deleteHistoryCausalLink(session.worldId, editingId);
    showToast("已删除");
    session.view.links = (await historyApi.listHistoryCausalLinks(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "删除失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

// ── Render ──
export function historyCausalWorkspaceHtml(data, session) {
  if (!session) return "";
  const links = session.view?.links || [];

  const listHtml = links.length
    ? `<div class="hc-list">${links.map(historyCardHtml).join("")}</div>`
    : `<div class="hc-empty">暂无历史因果记录</div>`;

  return `
    <style>
      .hc-shell{display:flex;flex-direction:column;gap:16px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .hc-header h2{margin:0 0 4px;font-size:20px;}
      .hc-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;}
      .hc-header .toolbar{display:flex;gap:8px;justify-content:flex-end;}
      .hc-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;}
      .hc-chip{padding:4px 10px;border-radius:999px;font-size:12px;background:#eef3f0;color:#3c514a;}
      .hc-list{display:flex;flex-direction:column;gap:10px;}
      .hc-card{padding:14px;border:1px solid var(--line,#dfe7e3);border-left:3px solid #587b72;border-radius:10px;background:var(--card,#fff);}
      .hc-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;}
      .hc-card-top strong{font-size:15px;}
      .hc-seq{color:var(--muted,#6b7a74);font-size:12px;}
      .hc-when{display:inline-block;margin:2px 0 6px;padding:2px 8px;border-radius:6px;background:#f2e9d8;color:#7a5b1e;font-size:12px;}
      .hc-fields{margin-top:8px;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.6;}
      .hc-fields div b{color:var(--muted,#6b7a74);font-weight:600;margin-right:6px;}
      .hc-card-actions{display:flex;gap:4px;}
      .hc-card-actions button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);}
      .hc-empty,.hc-error{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:24px;}
      .hc-error{color:#b22d3a;}
      .hc-editor-panel{margin-top:6px;padding:16px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px;}
      .hc-editor-panel h3{margin:0;font-size:15px;}
      .hc-editor-panel label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);flex:1;min-width:0;}
      .hc-row{display:flex;gap:12px;flex-wrap:wrap;}
      .hc-editor-panel .field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;font-size:13px;color:var(--ink,#22302c);background:var(--bg,#f7faf8);}
      .hc-panel-actions{display:flex;gap:8px;justify-content:flex-end;}
      .hc-panel-actions .btn{padding:8px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;}
      .hc-panel-actions .btn.primary{background:var(--accent,#587b72);color:#fff;}
      .hc-panel-actions .btn.outline{background:transparent;border-color:var(--line,#dfe7e3);}
    </style>
    <section class="hc-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="hc-header">
        <h2>历史因果表编辑器</h2>
        <p class="hc-lede">把世界历史整理成一条因果链：每个历史事件记录<强>前因 → 事件 → 后果</强>，并按年代排序，支撑"谁引发了当今局势"的设定。</p>
        <div class="toolbar">
          <button type="button" class="btn primary" data-action="hc-add">+ 新增历史事件</button>
          <button type="button" class="btn quiet" data-action="hc-close">关闭</button>
        </div>
      </div>

      ${session.loading ? '<div class="loading-dots">加载中…</div>' : `<div class="hc-list">${listHtml}</div>`}
      ${session.error && !session.editingId ? `<div class="hc-error">${escapeHtml(session.error)}</div>` : ""}
      ${session.editingId !== undefined ? hcEditorPanelHtml(session) : ""}
    </section>
  `;
}

function historyCardHtml(link) {
  const fields = [
    link.causeText && ["前因", link.causeText],
    link.eventText && ["事件", link.eventText],
    link.effectText && ["后果", link.effectText],
    link.summary && ["概述", link.summary]
  ].filter(Boolean);
  const actors = link.actors || "";
  return `
    <article class="hc-card">
      <div class="hc-card-top">
        <div>
          <strong>${escapeHtml(link.title || "未命名事件")}</strong>
          ${link.whenText ? `<span class="hc-when">${escapeHtml(link.whenText)}</span>` : ""}
          <p class="hc-seq">#${Number(link.sequence) || 0}${actors ? ` · 涉及：${escapeHtml(actors)}` : ""}</p>
        </div>
        <div class="hc-card-actions">
          <button type="button" data-action="hc-edit" data-link-id="${escapeHtml(link.id)}" title="编辑">✎</button>
          <button type="button" data-action="hc-delete" data-link-id="${escapeHtml(link.id)}" title="删除">✕</button>
        </div>
      </div>
      ${fields.length ? `<div class="hc-fields">${fields.map(([label, text]) => `<div><b>${label}</b>${escapeHtml(text)}</div>`).join("")}</div>` : ""}
    </article>
  `;
}

function hcEditorPanelHtml(session) {
  const d = session.draft;
  const isEdit = Boolean(session.editingId);
  return `
    <div class="hc-editor-panel">
      <h3>${isEdit ? "编辑历史事件" : "新增历史事件"}</h3>
      <div class="hc-row">
        <label>事件编号（如 H-01）
          <input class="field" type="text" data-hc-field="title" value="${escapeHtml(d.title)}" placeholder="例如 H-01" />
        </label>
        <label>因果序号
          <input class="field" type="number" min="0" data-hc-field="sequence" value="${Number(d.sequence) || 1}" />
        </label>
        <label>年代/纪年
          <input class="field" type="text" data-hc-field="whenText" value="${escapeHtml(d.whenText)}" placeholder="例如 前 480 年" />
        </label>
      </div>
      <label>涉及角色/势力
        <input class="field" type="text" data-hc-field="actors" value="${escapeHtml(d.actors)}" placeholder="逗号分隔，如 秦、白眉、山海道" />
      </label>
      <label>前因（什么导致了该事件）
        <textarea class="field" rows="3" data-hc-field="causeText" placeholder="哪些矛盾、交易或人物选择累积成了这个事件…">${escapeHtml(d.causeText)}</textarea>
      </label>
      <label>事件本身（发生了什么）
        <textarea class="field" rows="3" data-hc-field="eventText" placeholder="此刻发生了什么，改变了什么…">${escapeHtml(d.eventText)}</textarea>
      </label>
      <label>后果（改变了什么，引出哪个后续事件）
        <textarea class="field" rows="3" data-hc-field="effectText" placeholder="事件之后世界如何变化，指向哪个下一环…">${escapeHtml(d.effectText)}</textarea>
      </label>
      <label>概述（在整条因果链中的作用）
        <textarea class="field" rows="2" data-hc-field="summary" placeholder="这条因果如何塑造当今的局势…">${escapeHtml(d.summary)}</textarea>
      </label>

      <div class="hc-panel-actions">
        <button type="button" class="btn primary" data-action="hc-save">保存</button>
        <button type="button" class="btn outline" data-action="hc-cancel">取消</button>
      </div>
    </div>
  `;
}

// ── Bind ──
export function bindHistoryCausal(data, session) {
  const root = document.querySelector(`[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";

  root.querySelector("[data-action='hc-close']")?.addEventListener("click", closeHistoryCausal);
  root.querySelector("[data-action='hc-add']")?.addEventListener("click", () => openHistoryCausalEditor(null));
  root.querySelectorAll("[data-action='hc-edit']").forEach((el) =>
    el.addEventListener("click", () => openHistoryCausalEditor(el.dataset.linkId)));
  root.querySelectorAll("[data-action='hc-delete']").forEach((el) =>
    el.addEventListener("click", () => deleteHistoryCausal(el.dataset.linkId)));

  root.querySelectorAll("[data-hc-field]").forEach((el) => {
    const field = el.dataset.hcField;
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateHistoryCausalDraft(field, el.value));
  });

  root.querySelector("[data-action='hc-save']")?.addEventListener("click", saveHistoryCausalEditor);
  root.querySelector("[data-action='hc-cancel']")?.addEventListener("click", closeHistoryCausalEditor);
}