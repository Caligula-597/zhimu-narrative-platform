/**
 * NPC Script Editor — workspace (缺口 N).
 *
 * NPC 专属内容：独立 NPC 剧本 + 身份人生 + 显著数值(JSONB, 如酒力固定 5)。
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openNpcScript()
 *   closeNpcScript()
 *   npcScriptWorkspaceHtml(data, session)
 *   bindNpcScript(data, session)
 */

import * as npcApi from "../api/npc-script.js";
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
  buildNpcRecord,
  emptyNpcDraft,
  salientNumsToEntries,
  entriesToSalientNums
} from "../../shared/npc-script.js";

const TOOL_TYPE = "npc-script";

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const s = getWriterToolSession(data);
  return s?.type === TOOL_TYPE ? s : null;
}

// ── Open / Close ──
export async function openNpcScript() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用 NPC 剧本");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: { npcs: [] },
    draft: { ...emptyNpcDraft() },
    editingId: null,
    loading: true
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view.npcs = (await npcApi.listNpcs(session.worldId)) || [];
  } catch (error) {
    session.error = normalizeError(error, "读取 NPC 剧本失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function closeNpcScript() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

export function openNpcEditor(editingId = null) {
  const session = currentSession();
  if (!session) return;
  if (editingId) {
    const npc = session.view.npcs.find((r) => r.id === editingId);
    if (!npc) return;
    session.draft = buildNpcRecord(npc);
    session.editingId = npc.id;
  } else {
    session.draft = { ...emptyNpcDraft(), sequence: (session.view.npcs.length || 0) + 1 };
    session.editingId = null;
  }
  render();
}

export function closeNpcEditor() {
  const session = currentSession();
  if (!session) return;
  session.draft = { ...emptyNpcDraft() };
  session.editingId = null;
  render();
}

export function updateNpcDraft(field, value) {
  const session = currentSession();
  if (!session) return;
  session.draft[field] = value;
}

export function updateNpcNumEntry(index, field, value) {
  const session = currentSession();
  if (!session) return;
  const entries = salientNumsToEntries(session.draft.salientNums);
  if (!entries[index]) entries[index] = { key: "", value: 0 };
  entries[index][field] = field === "value" ? (Number(value) || 0) : value;
  session.draft.salientNums = entriesToSalientNums(entries);
}

export function addNpcNumEntry() {
  const session = currentSession();
  if (!session) return;
  const entries = salientNumsToEntries(session.draft.salientNums);
  entries.push({ key: "", value: 0 });
  session.draft.salientNums = entriesToSalientNums(entries);
  render();
}

export function removeNpcNumEntry(index) {
  const session = currentSession();
  if (!session) return;
  const entries = salientNumsToEntries(session.draft.salientNums);
  entries.splice(index, 1);
  session.draft.salientNums = entriesToSalientNums(entries);
  render();
}

export async function saveNpcEditor() {
  const session = currentSession();
  if (!session) return;
  const d = session.draft;
  if (!d.title && !d.summary && !d.bio && !Object.keys(d.salientNums || {}).length) {
    return showToast("请填写标题或基础内容，否则该记录无意义");
  }
  const body = {
    title: d.title || `NPC-${String(d.sequence || 0).padStart(2, "0")}`,
    sequence: d.sequence || 0,
    salientNums: d.salientNums || {},
    summary: d.summary,
    bio: d.bio,
    privateScript: d.privateScript
  };
  const op = session.editingId
    ? npcApi.updateNpc(session.worldId, session.editingId, body)
    : npcApi.createNpc(session.worldId, body);
  try {
    await op;
    showToast(session.editingId ? "已更新" : "已创建");
    session.editingId = null;
    session.draft = { ...emptyNpcDraft() };
    session.loading = true;
    session.view.npcs = (await npcApi.listNpcs(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "保存失败"));
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function deleteNpc(editingId) {
  const session = currentSession();
  if (!session || !editingId) return;
  if (!confirm("确定删除这条 NPC？")) return;
  try {
    await npcApi.deleteNpc(session.worldId, editingId);
    showToast("已删除");
    session.view.npcs = (await npcApi.listNpcs(session.worldId)) || [];
  } catch (error) {
    showToast(normalizeError(error, "删除失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

// ── Render ──
export function npcScriptWorkspaceHtml(data, session) {
  if (!session) return "";
  const npcs = session.view?.npcs || [];

  const listHtml = (npcs || []).length
    ? (npcs || []).map((n) => npcCardHtml(n)).join("")
    : `<div class="npc-empty">暂无 NPC</div>`;

  return `
    <style>
      .npc-shell{display:flex;flex-direction:column;gap:16px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .npc-header h2{margin:0 0 4px;font-size:20px;}
      .npc-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;}
      .npc-header .toolbar{display:flex;gap:8px;justify-content:flex-end;}
      .npc-list{display:flex;flex-direction:column;gap:10px;}
      .npc-card{padding:14px;border:1px solid var(--line,#dfe7e3);border-left:3px solid #8a4b6a;border-radius:10px;background:var(--card,#fff);}
      .npc-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px;}
      .npc-card-top strong{font-size:15px;}
      .npc-summary{color:var(--muted,#6b7a74);font-size:12px;margin-top:2px;}
      .npc-nums{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
      .npc-num-chip{padding:3px 10px;border-radius:999px;font-size:12px;background:#f7edf2;color:#8a4b6a;}
      .npc-num-chip b{color:var(--ink,#22302c);}
      .npc-card-actions{display:flex;gap:4px;}
      .npc-card-actions button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);}
      .npc-empty,.npc-error{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:24px;}
      .npc-error{color:#b22d3a;}
      .npc-editor-panel{margin-top:6px;padding:16px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px;}
      .npc-editor-panel h3{margin:0;font-size:15px;}
      .npc-editor-panel label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);flex:1;min-width:0;}
      .npc-row{display:flex;gap:12px;flex-wrap:wrap;}
      .npc-editor-panel .field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;font-size:13px;color:var(--ink,#22302c);background:var(--bg,#f7faf8);}
      .npc-num-editor{border:1px solid var(--line,#dfe7e3);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px;background:var(--bg,#f7faf8);}
      .npc-num-editor .npc-num-head{display:flex;justify-content:space-between;align-items:center;}
      .npc-num-editor .npc-num-head b{font-size:12px;color:var(--muted,#6b7a74);}
      .npc-num-tools{display:flex;gap:4px;}
      .npc-num-tools button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);}
      .npc-panel-actions{display:flex;gap:8px;justify-content:flex-end;}
      .npc-panel-actions .btn{padding:8px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;}
      .npc-panel-actions .btn.primary{background:var(--accent,#587b72);color:#fff;}
      .npc-panel-actions .btn.outline{background:transparent;border-color:var(--line,#dfe7e3);}
    </style>
    <section class="npc-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="npc-header">
        <h2>NPC 专属剧本编辑器</h2>
        <p class="npc-lede">登记 NPC 槽位的独立剧本、身份人生与显著数值（如酒力固定 5），供后续按槽位引用。</p>
        <div class="toolbar">
          <button type="button" class="btn primary" data-action="npc-add">+ 新增 NPC</button>
          <button type="button" class="btn quiet" data-action="npc-close">关闭</button>
        </div>
      </div>

      ${session.loading ? '<div class="loading-dots">加载中…</div>' : `<div class="npc-list">${listHtml}</div>`}
      ${session.error && !session.editingId ? `<div class="npc-error">${escapeHtml(session.error)}</div>` : ""}
      ${session.editingId !== undefined ? npcEditorPanelHtml(session) : ""}
    </section>
  `;
}

function npcCardHtml(npc) {
  const numEntries = salientNumsToEntries(npc.salientNums);
  const chips = numEntries.map((e) =>
    `<span class="npc-num-chip">${escapeHtml(e.key || "?")} = <b>${escapeHtml(String(e.value))}</b></span>`).join("");
  return `
    <article class="npc-card">
      <div class="npc-card-top">
        <div>
          <strong>${escapeHtml(npc.title || "未命名")}</strong>
          ${npc.summary ? `<p class="npc-summary">${escapeHtml(npc.summary)}</p>` : ""}
        </div>
        <div class="npc-card-actions">
          <button type="button" data-action="npc-edit" data-npc-id="${escapeHtml(npc.id)}" title="编辑">✎</button>
          <button type="button" data-action="npc-delete" data-npc-id="${escapeHtml(npc.id)}" title="删除">✕</button>
        </div>
      </div>
      ${chips ? `<div class="npc-nums">${chips}</div>` : ""}
    </article>
  `;
}

function npcEditorPanelHtml(session) {
  const d = session.draft;
  const isEdit = Boolean(session.editingId);
  const numEntries = salientNumsToEntries(d.salientNums);
  const numsHtml = (numEntries.length ? numEntries : [{ key: "", value: 0 }]).map((e, i) => `
    <div class="npc-num-editor">
      <div class="npc-num-head">
        <b>显著数值 ${i + 1}</b>
        <div class="npc-num-tools">
          <button type="button" data-action="npc-num-remove" data-index="${i}">✕</button>
        </div>
      </div>
      <label>数值名
        <input class="field" type="text" data-npc-num-field="${i}::key" value="${escapeHtml(e.key)}" placeholder="例如 酒力" />
      </label>
      <label>数值
        <input class="field" type="number" step="any" data-npc-num-field="${i}::value" value="${escapeHtml(String(e.value))}" placeholder="例如 5" />
      </label>
    </div>
  `).join("");

  return `
    <div class="npc-editor-panel">
      <h3>${isEdit ? "编辑 NPC" : "新增 NPC"}</h3>
      <div class="npc-row">
        <label>槽位标题（如 NPC-01 柳诗诗）
          <input class="field" type="text" data-npc-field="title" value="${escapeHtml(d.title)}" placeholder="例如 NPC-01 柳诗诗" />
        </label>
        <label>排序
          <input class="field" type="number" data-npc-field="sequence" value="${escapeHtml(String(d.sequence ?? 0))}" />
        </label>
      </div>
      <label>一句话定位
        <input class="field" type="text" data-npc-field="summary" value="${escapeHtml(d.summary)}" placeholder="这个 NPC 的角色定位…" />
      </label>

      <div class="npc-row">
        <label>显著数值 <button type="button" class="btn quiet compact" data-action="npc-num-add">+ 添加数值</button></label>
      </div>
      ${numsHtml}

      <label>身份人生
        <textarea class="field" rows="3" data-npc-field="bio" placeholder="出身、经历、谋略、与玩家的关系…">${escapeHtml(d.bio)}</textarea>
      </label>
      <label>独立 NPC 剧本
        <textarea class="field" rows="5" data-npc-field="privateScript" placeholder="这个 NPC 自己的完整剧本/行动线…">${escapeHtml(d.privateScript)}</textarea>
      </label>

      <div class="npc-panel-actions">
        <button type="button" class="btn primary" data-action="npc-save">保存</button>
        <button type="button" class="btn outline" data-action="npc-cancel">取消</button>
      </div>
    </div>
  `;
}

// ── Bind ──
export function bindNpcScript(data, session) {
  const root = document.querySelector(`[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";

  root.querySelector("[data-action='npc-close']")?.addEventListener("click", closeNpcScript);
  root.querySelector("[data-action='npc-add']")?.addEventListener("click", () => openNpcEditor(null));
  root.querySelectorAll("[data-action='npc-edit']").forEach((el) =>
    el.addEventListener("click", () => openNpcEditor(el.dataset.npcId)));
  root.querySelectorAll("[data-action='npc-delete']").forEach((el) =>
    el.addEventListener("click", () => deleteNpc(el.dataset.npcId)));

  root.querySelectorAll("[data-npc-field]").forEach((el) => {
    const field = el.dataset.npcField;
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateNpcDraft(field, el.value));
  });

  root.querySelectorAll("[data-npc-num-field]").forEach((el) => {
    const [indexStr, field] = el.dataset.npcNumField.split("::");
    const index = parseInt(indexStr, 10);
    const eventType = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(eventType, () => updateNpcNumEntry(index, field, el.value));
  });

  root.querySelector("[data-action='npc-num-add']")?.addEventListener("click", addNpcNumEntry);
  root.querySelectorAll("[data-action='npc-num-remove']").forEach((el) =>
    el.addEventListener("click", () => removeNpcNumEntry(parseInt(el.dataset.index, 10))));

  root.querySelector("[data-action='npc-save']")?.addEventListener("click", saveNpcEditor);
  root.querySelector("[data-action='npc-cancel']")?.addEventListener("click", closeNpcEditor);
}