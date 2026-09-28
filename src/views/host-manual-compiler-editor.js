/**
 * Host Manual Compiler — workspace (缺口6).
 *
 * Deterministically aggregates every preceding locked内容 module into a
 * versioned 主持手册整册. Provides two modes:
 *   · compile mode — one-click re-compiles a new version from source data
 *   · editor mode  — per-section editing (unlocking) + appending custom sections
 *
 * Exports (workspace module, opened via writer-tool mechanism):
 *   openHostManualCompiler()
 *   closeHostManualCompiler()
 *   hostManualCompilerWorkspaceHtml(data, session)
 *   bindHostManualCompiler(data, session)
 */

import * as hostManualApi from "../api/host-manual.js";
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
  buildHostManual,
  emptyHostManualDraft,
  HOST_MANUAL_SECTION_TEMPLATES
} from "../../shared/host-manual.js";

const TOOL_TYPE = "host-manual-compiler";

function emptySectionDraft() {
  return { title: "", body: "" };
}

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const s = getWriterToolSession(data);
  return s?.type === TOOL_TYPE ? s : null;
}

async function loadManual(session) {
  session.loading = true;
  try {
    const [manual, versions] = await Promise.all([
      hostManualApi.getHostManual(session.worldId),
      hostManualApi.listHostManualVersions(session.worldId)
    ]);
    session.view.manual = manual || buildHostManual();
    session.view.versions = versions || [];
  } catch (error) {
    session.error = normalizeError(error, "读取主持手册失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function openHostManualCompiler() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用主持手册编译器");
  const session = beginWriterToolSession(TOOL_TYPE, data, {
    view: {
      manual: emptyHostManualDraft(),
      versions: []
    },
    loading: true,
    compiling: false,
    editingSectionId: null,
    sectionDraft: emptySectionDraft(),
    error: ""
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  await loadManual(session);
}

export function closeHostManualCompiler() {
  const session = currentSession();
  if (!session) return;
  clearWriterToolSession(session);
  render();
}

export async function compileNow() {
  const session = currentSession();
  if (!session || session.compiling) return;
  if (!confirm("将基于当前全部前序已锁定内容重新编译并生成新的主持手册版本，确定继续？")) return;
  session.compiling = true;
  session.error = "";
  render();
  try {
    await hostManualApi.compileHostManual(session.worldId);
    showToast("编译完成，已生成新版本");
    await loadManual(session);
  } catch (error) {
    session.error = normalizeError(error, "编译失败");
    showToast(session.error);
  } finally {
    session.compiling = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function selectVersion(version) {
  const session = currentSession();
  if (!session || !version) return;
  session.loading = true;
  session.editingSectionId = null;
  render();
  try {
    session.view.manual = (await hostManualApi.getHostManual(session.worldId, { version })) || buildHostManual();
  } catch (error) {
    session.error = normalizeError(error, "读取版本失败");
    showToast(session.error);
  } finally {
    session.loading = false;
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export function editSection(sectionId) {
  const session = currentSession();
  if (!session) return;
  const section = session.view.manual?.sections.find((s) => s.id === sectionId);
  if (!section) return;
  session.editingSectionId = sectionId;
  session.sectionDraft = { title: section.title, body: section.body };
  render();
}

export function cancelEditSection() {
  const session = currentSession();
  if (!session) return;
  session.editingSectionId = null;
  session.sectionDraft = emptySectionDraft();
  render();
}

export function updateSectionDraft(field, value) {
  const session = currentSession();
  if (!session) return;
  session.sectionDraft[field] = value;
}

export async function saveSection() {
  const session = currentSession();
  if (!session || !session.editingSectionId) return;
  const d = session.sectionDraft;
  if (!d.title.trim()) return showToast("章节标题不能为空");
  try {
    await hostManualApi.updateHostManualSection(session.worldId, session.editingSectionId, {
      title: d.title,
      body: d.body
    });
    showToast("已保存");
    session.editingSectionId = null;
    session.sectionDraft = emptySectionDraft();
    const manual = await hostManualApi.getHostManual(session.worldId, { version: session.view.manual.version });
    session.view.manual = manual || session.view.manual;
  } catch (error) {
    showToast(normalizeError(error, "保存失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

export async function addSection() {
  const session = currentSession();
  if (!session) return;
  const title = prompt("自定义章节标题");
  if (!title || !title.trim()) return;
  const body = prompt("章节内容（支持 Markdown）") || "";
  try {
    await hostManualApi.addHostManualSection(session.worldId, { title: title.trim(), body });
    showToast("已新增章节");
    const manual = await hostManualApi.getHostManual(session.worldId, { version: session.view.manual.version });
    session.view.manual = manual || session.view.manual;
  } catch (error) {
    showToast(normalizeError(error, "新增失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

export async function removeSection(sectionId) {
  const session = currentSession();
  if (!session) return;
  if (!confirm("确定删除该章节？")) return;
  try {
    await hostManualApi.deleteHostManualSection(session.worldId, sectionId);
    showToast("已删除");
    const manual = await hostManualApi.getHostManual(session.worldId, { version: session.view.manual.version });
    session.view.manual = manual || session.view.manual;
  } catch (error) {
    showToast(normalizeError(error, "删除失败"));
  }
  if (writerToolSessionIsCurrent(session)) render();
}

const TITLE_BY_KEY = new Map(HOST_MANUAL_SECTION_TEMPLATES.map((t) => [t.key, t.title]));

export function hostManualCompilerWorkspaceHtml(data, session) {
  if (!session) return "";
  const manual = session.view?.manual;
  const sections = manual?.sections || [];
  const versions = session.view?.versions || [];

  const versionPickerHtml = versions.length
    ? `<select class="hm-version" data-action="hm-version" title="选择手册版本">
        ${versions.map((v) => `<option value="${v.version}" ${v.version === manual?.version ? "selected" : ""}>v${v.version} · ${escapeHtml(v.title)}</option>`).join("")}
      </select>`
    : "";

  const staleBadgeHtml = manual && manual.sourceFingerprint ? "" : "";

  const emptyHtml = manual && sections.length === 0
    ? `<div class="hm-empty">
        <p>尚未生成主持手册。点击「编译生成」将从作品全部前序已锁定内容（概览/幕次/角色/行动时间线/场景/线索/物件/规则/主持阶段/误认/关系/结局）确定性聚合一整册主持稿。</p>
        <button type="button" class="hm-btn hm-btn-primary" data-action="hm-compile">编译生成</button>
      </div>`
    : "";

  const listHtml = sections.length
    ? sections.map((s) => sectionCardHtml(s, session)).join("")
    : "";

  return `
    <style>
      .hm-shell{display:flex;flex-direction:column;gap:16px;padding:18px;color:var(--ink,#22302c);font-size:14px;}
      .hm-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
      .hm-header h2{margin:0 0 4px;font-size:20px;}
      .hm-lede{margin:0 0 12px;color:var(--muted,#6b7a74);font-size:12px;line-height:1.6;max-width:720px;}
      .hm-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
      .hm-version{padding:6px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;background:var(--bg,#f7faf8);font-size:13px;color:var(--ink,#22302c);max-width:260px;}
      .hm-btn{padding:8px 14px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;}
      .hm-btn-primary{background:var(--accent,#587b72);color:#fff;}
      .hm-btn-outline{background:transparent;border-color:var(--line,#dfe7e3);}
      .hm-btn-quiet{background:transparent;border:none;color:var(--muted,#6b7a74);}
      .hm-empty,.hm-error{color:var(--muted,#6b7a74);font-size:13px;text-align:center;padding:28px;line-height:1.7;}
      .hm-empty{border:1px dashed var(--line,#dfe7e3);border-radius:12px;}
      .hm-error{color:#b22d3a;}
      .hm-meta{font-size:12px;color:var(--muted,#6b7a74);}
      .hm-list{display:flex;flex-direction:column;gap:10px;}
      .hm-card{padding:14px;border:1px solid var(--line,#dfe7e3);border-left:3px solid #587b72;border-radius:10px;background:var(--card,#fff);}
      .hm-card.custom{border-left-color:#8a6a2a;}
      .hm-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
      .hm-card-top strong{font-size:15px;}
      .hm-badge{font-size:10px;padding:2px 8px;border-radius:999px;font-weight:700;background:#e3f1e8;color:#2f6b4f;}
      .hm-badge.custom{background:#fff6e6;color:#8a6a2a;}
      .hm-actions{display:flex;gap:4px;align-items:center;}
      .hm-actions button{border:0;background:transparent;cursor:pointer;color:var(--muted,#6b7a74);font-size:12px;}
      .hm-body{margin:10px 0 0;white-space:pre-wrap;word-break:break-word;line-height:1.7;font-size:13px;color:#33413b;max-height:360px;overflow:auto;}
      .hm-body:empty{display:none;}
      .hm-edit-panel{margin-top:10px;padding:12px;border:1px solid var(--line,#dfe7e3);border-radius:10px;background:var(--bg,#f7faf8);display:flex;flex-direction:column;gap:10px;}
      .hm-edit-panel label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted,#6b7a74);}
      .hm-edit-panel .field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:8px;font-size:13px;color:var(--ink,#22302c);background:var(--card,#fff);font-family:inherit;}
      .hm-edit-panel textarea.field{min-height:220px;resize:vertical;line-height:1.6;}
      .hm-edit-actions{display:flex;gap:8px;justify-content:flex-end;}
      .loading-dots{color:var(--muted,#6b7a74);}
    </style>
    <section class="hm-shell" data-writer-tool="${TOOL_TYPE}">
      <div class="hm-header">
        <div>
          <h2>主持手册编译器</h2>
          <p class="hm-lede">一键从作品全部前序已锁定内容（CFG/SIT/A时间线/K误认/R关系/O物品/M规则/E线索/X结局/C角色本）确定性聚合生成整册主持稿，落库版本化；可在"章节编辑器"中微调每一章。</p>
        </div>
        <div class="hm-toolbar">
          ${versionPickerHtml}
          <button type="button" class="hm-btn hm-btn-outline" data-action="hm-add-section">+ 自定义章节</button>
          <button type="button" class="hm-btn hm-btn-primary" data-action="hm-compile">${session.compiling ? "编译中…" : "编译生成"}</button>
          <button type="button" class="hm-btn hm-btn-quiet" data-action="hm-close">关闭</button>
        </div>
      </div>
      ${manual ? `<div class="hm-meta">当前版本 v${manual.version} · ${manual.title}${manual.sourceFingerprint ? ` · 指纹 ${manual.sourceFingerprint}` : ""}</div>` : ""}
      ${session.error && !session.editingSectionId ? `<div class="hm-error">${escapeHtml(session.error)}</div>` : ""}
      ${session.loading ? '<div class="loading-dots">加载中…</div>' : emptyHtml + (listHtml ? `<div class="hm-list">${listHtml}</div>` : "")}
    </section>
  `;
}

function sectionCardHtml(section, session) {
  const isEditing = session.editingSectionId === section.id;
  const isCustom = TITLE_BY_KEY.has(section.sectionKey) === false;
  const badge = isCustom ? "自定义" : "系统";
  const bodyHtml = isEditing ? editPanelHtml(section, session) : "";
  const title = escapeHtml(section.title || TITLE_BY_KEY.get(section.sectionKey) || section.sectionKey);

  return `
    <div class="hm-card ${isCustom ? "custom" : ""}" data-section-id="${escapeHtml(section.id)}">
      <div class="hm-card-top">
        <strong>${title}</strong>
        <div class="hm-actions">
          <span class="hm-badge ${isCustom ? "custom" : ""}">${badge}</span>
          ${session.editingSectionId === section.id
            ? ""
            : `<button type="button" data-action="hm-edit" data-section-id="${escapeHtml(section.id)}">编辑</button>
               <button type="button" data-action="hm-delete" data-section-id="${escapeHtml(section.id)}">删除</button>`}
        </div>
      </div>
      ${isEditing ? bodyHtml : `<div class="hm-body">${escapeHtml(section.body || "")}</div>`}
    </div>
  `;
}

function editPanelHtml(section, session) {
  const d = session.sectionDraft || emptySectionDraft();
  return `
    <div class="hm-edit-panel">
      <label>章节标题
        <input class="field" data-field="hm-title" value="${escapeHtml(d.title || "")}" />
      </label>
      <label>章节内容（Markdown）
        <textarea class="field" data-field="hm-body">${escapeHtml(d.body || "")}</textarea>
      </label>
      <div class="hm-edit-actions">
        <button type="button" class="hm-btn hm-btn-outline" data-action="hm-cancel-edit">取消</button>
        <button type="button" class="hm-btn hm-btn-primary" data-action="hm-save-section">保存</button>
      </div>
    </div>
  `;
}

export function bindHostManualCompiler(data, session) {
  const root = document.querySelector(`section[data-writer-tool="${TOOL_TYPE}"]`);
  if (!root) return;
  const readSectionId = (el) => el?.dataset?.sectionId || el?.closest?.("[data-section-id]")?.dataset?.sectionId || null;

  root.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    switch (action) {
      case "hm-compile": compileNow(); break;
      case "hm-close": closeHostManualCompiler(); break;
      case "hm-add-section": addSection(); break;
      case "hm-edit": editSection(readSectionId(actionEl)); break;
      case "hm-cancel-edit": cancelEditSection(); break;
      case "hm-save-section": saveSection(); break;
      case "hm-delete": removeSection(readSectionId(actionEl)); break;
      default:
        break;
    }
  });

  root.addEventListener("change", (event) => {
    if (event.target.dataset.action === "hm-version") {
      selectVersion(Number(event.target.value));
    }
  });

  root.addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    if (field === "hm-title") updateSectionDraft("title", event.target.value);
    if (field === "hm-body") updateSectionDraft("body", event.target.value);
  });
}