/**
 * Economic System Editor — workspace (缺口 E).
 *
 * World economic records grouped by category 银两初始/拍卖/宝箱/经济规则.
 * Downstream (机制生成流线) is not yet built: only the reserved bridge
 * econToMechanismPipeline / ECON_MECHANISM_BRIDGE_RESERVED is surfaced here.
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openEconSystem()
 *   closeEconSystem()
 *   econSystemWorkspaceHtml(data, session)
 *   bindEconSystem(data, session)
 */

import * as econApi from "../api/econ.js";
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
  buildEconRecord,
  emptyEconDraft,
  ECON_CATEGORIES,
  ECON_CATEGORY_LABELS,
  ECON_MECHANISM_BRIDGE_RESERVED,
  ECON_TO_MECHANISM_KIT_HINT
} from "../../shared/econ.js";

const TOOL_TYPE = "econ-system";

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const s = getWriterToolSession(data);
  return s?.type === TOOL_TYPE ? s : null;
}

// ── Open / Close ──
export async function openEconSystem() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用经济系统");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: { records: [] },
    draft: { ...emptyEconDraft() },
    editingId: null,
    loading: true
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view.records = (await econApi.listEconRecords(session.worldId)) || [];
  } catch (error) {
    session.error = normalizeError(error, "读取经济系统失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function closeEconSystem() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

export function openEconEditor(category = "initial", editingId = null) {
  const session = currentSession();
  if (!session) return;
  if (editingId) {
    const record = session.view.records.find((r) => r.id === editingId);
    if (!record) return;
    session.draft = buildEconRecord(record);
    session.editingId = record.id;
  } else {
    session.draft = { ...emptyEconDraft(), category, sequence: (session.view.records.filter((r) => r.category === category).length || 0) + 1 };
    session.editingId = null;
  }
  render();
}

export function closeEconEditor() {
  const session = currentSession();
  if (!session) return;
  session.draft = { ...emptyEconDraft() };
  session.editingId = null;
  render();
}

export function updateEconDraft(field, value) {
  const session = currentSession();
  if (!session) return;
  session.draft[field] = value;
}

export async function saveEconEditor() {
  const session = currentSession();
  if (!session) return;
  const d = session.draft;
  if (!d.summary && !d.note && !d.actorLabel && d.amount == null) {
    return showToast("请填写基础信息或说明，否则该记录无意义");
  }
  const catTitle = ECON_CATEGORY_LABELS[d.category] || d.category;
  const body = {
    title: d.title || `ECON-${String(d.sequence || 0).padStart(2, "0")} · ${catTitle}`,
    category: d.category,
    sequence: d.sequence || 0,
    actorLabel: d.actorLabel,
    amount: (d.amount == null ? 0 : Number(d.amount)),
    source: d.source,
    note: d.note,
    summary: d.summary
  };
  const op = session.editingId
    ? econApi.updateEconRecord(session.worldId, session.editingId, body)
    : econApi.createEconRecord(session.worldId, body);
  try {
    await op;
    showToast(session.editingId ? "已更新" : "已创建");
    session.editingId = null;
    session.draft = { ...emptyEconDraft() };
    session.loading = true;
    session.view.records = (await econApi.listEconRecords(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "保存失败"));
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function deleteEconRecord(editingId) {
  const session = currentSession();
  if (!session || !editingId) return;
  if (!confirm("确定删除这条经济记录？")) return;
  try {
    await econApi.deleteEconRecord(session.worldId, editingId);
    showToast("已删除");
    session.view.records = (await econApi.listEconRecords(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "删除失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

// ── Render ──
export function econSystemWorkspaceHtml(data, session) {
  if (!session) return "";
  const records = session.view?.records || [];

  const sectionHtml = ECON_CATEGORIES.map((cat) => {
    const scoped = (records || []).filter((r) => r.category === cat.key);
    const cards = scoped.length
      ? scoped.map((r) => econCardHtml(r)).join("")
      : `<div class="econ-empty">暂无${escapeHtml(cat.label)}记录</div>`;
    const total = scoped.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    return `
      <article class="econ-section" data-econ-section="${cat.key}">
        <div class="econ-section-head">
          <div>
            <h3>${escapeHtml(cat.label)}</h3>
            <p class="econ-count">${scoped.length} 条 · 数值合计 ${total}</p>
          </div>
          <button type="button" class="btn primary" data-action="econ-add" data-category="${cat.key}">+ 新增</button>
        </div>
        <div class="econ-list">${cards}</div>
        ${ECON_TO_MECHANISM_KIT_HINT[cat.key] ? `<p class="econ-kit-hint">机制生成流线预留：${escapeHtml(cat.label)} → ${escapeHtml(ECON_TO_MECHANISM_KIT_HINT[cat.key])}</p>` : ""}
      </article>
    `;
  }).join("");

  return `
    <style>
      .econ-shell{display:flex;flex-direction:column;gap:16px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .econ-header h2{margin:0 0 4px;font-size:20px;}
      .econ-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;}
      .econ-header .toolbar{display:flex;gap:8px;justify-content:flex-end;}
      .econ-bridge{border:1px solid var(--line,#dfe7e3);border-left:4px solid #4569a8;border-radius:8px;padding:10px 12px;background:var(--card,#fff);color:var(--muted,#6b7a74);font-size:12px;}
      .econ-bridge b{color:#24406b;}
      .econ-section{border:1px solid var(--line,#dfe7e3);border-radius:12px;padding:14px;background:var(--card,#fff);}
      .econ-section-head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
      .econ-section-head h3{margin:0;font-size:15px;}
      .econ-count,.econ-kit-hint{margin:2px 0 0;color:var(--muted,#6b7a74);font-size:12px;}
      .econ-kit-hint{margin-top:10px;color:#4569a8;}
      .econ-list{display:flex;flex-direction:column;gap:8px;margin-top:10px;}
      .econ-card{padding:12px;border:1px solid var(--line,#dfe7e3);border-left:3px solid #4569a8;border-radius:8px;background:var(--bg,#f7faf8);}
      .econ-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px;}
      .econ-card-top strong{font-size:14px;}
      .econ-amount{font-weight:700;color:#4569a8;}
      .econ-sub{color:var(--muted,#6b7a74);font-size:12px;margin-top:2px;}
      .econ-card-actions{display:flex;gap:4px;}
      .econ-card-actions button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);}
      .econ-empty{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:16px;}
      .econ-error{color:#b22d3a;font-size:13px;text-align:center;padding:12px;}
      .econ-editor-panel{margin-top:6px;padding:16px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px;}
      .econ-editor-panel h3{margin:0;font-size:15px;}
      .econ-editor-panel label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);flex:1;min-width:0;}
      .econ-row{display:flex;gap:12px;flex-wrap:wrap;}
      .econ-editor-panel .field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;font-size:13px;color:var(--ink,#22302c);background:var(--bg,#f7faf8);}
      .econ-panel-actions{display:flex;gap:8px;justify-content:flex-end;}
      .econ-panel-actions .btn{padding:8px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;}
      .econ-panel-actions .btn.primary{background:var(--accent,#587b72);color:#fff;}
      .econ-panel-actions .btn.outline{background:transparent;border-color:var(--line,#dfe7e3);}
    </style>
    <section class="econ-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="econ-header">
        <h2>经济系统编辑器</h2>
        <p class="econ-lede">维护世界经济事实：银两初始资源（CFG-05）、拍卖、宝箱、经济规则闭环。产出将作为"机制生成流线"的上游输入。</p>
        <div class="toolbar">
          <button type="button" class="btn quiet" data-action="econ-close">关闭</button>
        </div>
      </div>

      <div class="econ-bridge">机制生成流线<strong>未建成 · 已预留接口</strong>（${ECON_MECHANISM_BRIDGE_RESERVED ? "bridge reserved" : ""}）。生成流线就绪后，本编辑器记录将折叠为<b>主持端可操控、玩家端可操控的小游戏系统</b>。</div>

      ${session.loading ? '<div class="loading-dots">加载中…</div>' : sectionHtml}
      ${session.error && !session.editingId ? `<div class="econ-error">${escapeHtml(session.error)}</div>` : ""}
      ${session.editingId !== undefined ? econEditorPanelHtml(session) : ""}
    </section>
  `;
}

function econCardHtml(record) {
  return `
    <article class="econ-card">
      <div class="econ-card-top">
        <strong>${escapeHtml(record.title || "未命名")}</strong>
        <div class="econ-card-actions">
          <button type="button" data-action="econ-edit" data-row-id="${escapeHtml(record.id)}" title="编辑">✎</button>
          <button type="button" data-action="econ-delete" data-row-id="${escapeHtml(record.id)}" title="删除">✕</button>
        </div>
      </div>
      <div class="econ-top-row">
        ${record.actorLabel ? `<span class="econ-sub">涉及：${escapeHtml(record.actorLabel)}</span>` : ""}
        <span class="econ-amount">¥ ${Number(record.amount) || 0}</span>
      </div>
      ${record.summary ? `<p class="econ-sub">${escapeHtml(record.summary)}</p>` : ""}
      ${record.source ? `<p class="econ-sub">来源：${escapeHtml(record.source)}</p>` : ""}
      ${record.note ? `<p class="econ-sub">说明：${escapeHtml(record.note)}</p>` : ""}
    </article>
  `;
}

function econEditorPanelHtml(session) {
  const d = session.draft;
  const isEdit = Boolean(session.editingId);
  const catOpts = ECON_CATEGORIES.map((c) =>
    `<option value="${c.key}" ${d.category === c.key ? "selected" : ""}>${c.label}</option>`).join("");
  return `
    <div class="econ-editor-panel">
      <h3>${isEdit ? "编辑经济记录" : "新增经济记录"}</h3>
      <div class="econ-row">
        <label>分类
          <select class="field" data-econ-field="category">${catOpts}</select>
        </label>
        <label>排序
          <input class="field" type="number" data-econ-field="sequence" value="${escapeHtml(String(d.sequence ?? 0))}" />
        </label>
      </div>
      <div class="econ-row">
        <label>记录标题（如 ECON-01）
          <input class="field" type="text" data-econ-field="title" value="${escapeHtml(d.title)}" placeholder="例如 ECON-01" />
        </label>
        <label>涉及角色/势力
          <input class="field" type="text" data-econ-field="actorLabel" value="${escapeHtml(d.actorLabel)}" placeholder="角色或势力标签" />
        </label>
      </div>
      <label>数值（银两/物品量）
        <input class="field" type="number" step="any" data-econ-field="amount" value="${escapeHtml(String(d.amount ?? 0))}" />
      </label>
      <label>作用概述
        <textarea class="field" rows="2" data-econ-field="summary" placeholder="这条记录在经济闭环中的作用…">${escapeHtml(d.summary)}</textarea>
      </label>
      <label>来源
        <input class="field" type="text" data-econ-field="source" value="${escapeHtml(d.source)}" placeholder="章节 / 条目编号 / 备注出处" />
      </label>
      <label>说明 / 结算规则
        <textarea class="field" rows="2" data-econ-field="note" placeholder="拍卖规则、宝箱奖励、银两流转结算…">${escapeHtml(d.note)}</textarea>
      </label>
      <div class="econ-panel-actions">
        <button type="button" class="btn primary" data-action="econ-save">保存</button>
        <button type="button" class="btn outline" data-action="econ-cancel">取消</button>
      </div>
    </div>
  `;
}

// ── Bind ──
export function bindEconSystem(data, session) {
  const root = document.querySelector(`[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";

  root.querySelector("[data-action='econ-close']")?.addEventListener("click", closeEconSystem);
  root.querySelectorAll("[data-action='econ-add']").forEach((el) =>
    el.addEventListener("click", () => openEconEditor(el.dataset.category, null)));
  root.querySelectorAll("[data-action='econ-edit']").forEach((el) =>
    el.addEventListener("click", () => openEconEditor(null, el.dataset.rowId)));
  root.querySelectorAll("[data-action='econ-delete']").forEach((el) =>
    el.addEventListener("click", () => deleteEconRecord(el.dataset.rowId)));

  root.querySelectorAll("[data-econ-field]").forEach((el) => {
    const field = el.dataset.econField;
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateEconDraft(field, el.value));
  });

  root.querySelector("[data-action='econ-save']")?.addEventListener("click", saveEconEditor);
  root.querySelector("[data-action='econ-cancel']")?.addEventListener("click", closeEconEditor);
}