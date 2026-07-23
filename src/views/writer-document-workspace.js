import * as zhimuApi from "../api/index.js";
import { canEditWorldContent } from "../components/emptyState.js";
import { renderWorkspaceEditor, setWorkspaceSaving } from "../components/workspace-editor.js";
import { showToast } from "../components/toast.js";
import { normalizeError } from "../components/status-ui.js";
import { loadCloudData, render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { creatorTerms, normalizeCreationType } from "../../shared/creator-terminology.js";
import {
  beginWriterToolSession,
  clearWriterToolSession,
  getWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import { fileFingerprint, fileToBase64 } from "./writer-transfer-files.js";

const CREATION_TYPES = [
  { id: "murder_mystery", name: "剧本杀 · 角色本 / 公共幕 / 线索" },
  { id: "tabletop_rpg", name: "跑团 · PC / 章节 / HO / KP 信息" },
  { id: "interactive_story", name: "互动叙事 · 角色 / 章节 / 信息卡" }
];
const MAX_DOCUMENT_FILE_BYTES = 5 * 1024 * 1024;

function optionsHtml(items, selectedId) {
  return items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

function documentTargetOptions(data, selectedId, creationType) {
  const terms = creatorTerms(creationType || data.world?.settings?.creationType);
  const items = [
    { id: "structured", name: `智能结构导入 · 新建草稿${terms.roleShort}/${terms.act}/${terms.scene}/${terms.clue}` },
    { id: "manuscript", name: "完整剧情母稿" },
    ...(data.roles || []).map((role) => ({ id: role.id, name: `${terms.role} · ${role.name}` }))
  ];
  return optionsHtml(items, selectedId);
}

function extractionLabel(extraction, contentMode) {
  if (contentMode === "pages" || extraction?.method === "pdf_pages" || extraction?.method === "image_file") return `图片导入 · ${extraction?.pageCount || "?"} 页`;
  if (extraction?.method === "pdf_ocr") return `OCR 识别 · ${extraction.ocrPages || extraction.pageCount || "?"} 页`;
  if (extraction?.method === "pdf_text") return `PDF 文字层 · ${extraction.pageCount || "?"} 页`;
  if (extraction?.method === "docx") return "Word 文档";
  if (extraction?.method === "feishu_docx") return `飞书云文档 · ${extraction.blockCount || 0} 个内容块`;
  if (extraction?.method === "plain_text") return "纯文本";
  return "";
}

function documentPreviewHtml(parsed, creationType) {
  if (!parsed) return `<div class="writer-tool-empty-preview"><strong>等待解析</strong><p>解析结果会先显示在这里；复核结构、分段和警告后才能导入。</p></div>`;
  const warnings = (parsed.warnings || []).map((warning) => `<p class="tutorial-tip"><span>${escapeHtml(warning)}</span></p>`).join("");
  const modeLabel = extractionLabel(parsed.extraction, parsed.contentMode);
  const previewImage = parsed.previewImageBase64 ? `<figure class="document-page-preview"><img alt="文档首页预览" src="data:image/png;base64,${parsed.previewImageBase64}"></figure>` : "";
  const sections = parsed.contentMode === "pages" ? "" : (parsed.sections || []).slice(0, 8).map((section) => `<article><strong>${escapeHtml(section.title)}</strong><span>${escapeHtml(String(section.body || "").slice(0, 120))}${String(section.body || "").length > 120 ? "…" : ""}</span></article>`).join("");
  const structure = parsed.structure;
  const terms = creatorTerms(creationType);
  const counts = structure?.counts || {};
  const structureSummary = `${terms.roleShort} ${Number(counts.role || 0)} · ${terms.act} ${Number(counts.act || 0)} · ${terms.scene} ${Number(counts.scene || 0)} · ${terms.clue} ${Number(counts.clue || 0)} · ${terms.secret} ${Number(counts.secret || 0)}`;
  const candidates = structure?.candidates || [];
  const structurePreview = candidates.length ? `<section class="document-structure-preview"><h4>结构识别 · ${escapeHtml(structureSummary)}</h4>${candidates.slice(0, 12).map((item) => `<article><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.type)} · ${escapeHtml(item.confidence)}${item.parentActTitle ? ` · ${escapeHtml(item.parentActTitle)}` : ""}</span></article>`).join("")}${Number(structure.candidateCount || 0) > 12 ? `<p class="muted-note">另有 ${Number(structure.candidateCount) - 12} 项，导入后可在对应工作区逐项复核。</p>` : ""}</section>` : "";
  const summary = parsed.contentMode === "pages" ? `${Number(parsed.pageCount || 0)} 页图片分幕` : `${Number(parsed.characterCount || 0)} 字符 · ${Number(parsed.sectionCount || 0)} 个分段`;
  return `<section class="assistant-preview document-workspace-preview"><div class="section-head"><div><h3>${escapeHtml(parsed.filename || "解析结果")}</h3><p>${summary}${modeLabel ? ` · ${escapeHtml(modeLabel)}` : ""}</p></div><span class="cloud-pill">仅预览</span></div>${warnings}${structurePreview}${previewImage}<div class="document-section-preview">${sections}</div></section>`;
}

function canImportDocument(session) {
  if (!session.parsed || !session.draft.rightsConfirmed || session.previewFingerprint !== session.sourceFingerprint) return false;
  const target = session.draft.target;
  if (session.parsed.contentMode === "pages") return target !== "manuscript" && target !== "structured" && Boolean(session.file && session.fileBase64);
  if (target === "structured") return Boolean(session.parsed.structure?.candidateCount);
  return true;
}

function documentSourceFingerprint(session) {
  const source = session.draft.source;
  const sourceId = source === "feishu" ? session.draft.feishuUrl.trim() : fileFingerprint(session.file);
  return [source, sourceId, session.fileRevision || 0, session.draft.creationType, session.draft.allowOcr].join("|");
}

function documentContextHtml(data, session) {
  const parsed = session.parsed;
  return `<aside class="writer-tool-context">
    <p class="section-kicker">DOCUMENT INGESTION</p>
    <h2>稿件解析与结构化导入</h2>
    <p>先解析、再复核、最后写入。系统识别角色、幕、场景、线索和秘密，不会把整份文档直接塞进单一编辑器。</p>
    <dl class="writer-metadata-facts">
      <div><dt>解析状态</dt><dd>${parsed ? "已预览" : "待解析"}</dd></div>
      <div><dt>分段</dt><dd>${Number(parsed?.sectionCount || parsed?.pageCount || 0)}</dd></div>
      <div><dt>目标</dt><dd>${session.draft.target === "structured" ? "结构化" : session.draft.target === "manuscript" ? "母稿" : "角色本"}</dd></div>
    </dl>
    <div class="writer-metadata-guidance"><strong>版权与保密</strong><p>只导入你拥有或获授权处理的稿件。私有稿件不会自动公开或用于平台训练；调用外部 AI 能力前应另行确认供应商与数据范围。</p></div>
    ${session.file ? `<div class="writer-tool-file"><strong>已选择文件</strong><span>${escapeHtml(session.file.name)} · ${Math.ceil(session.file.size / 1024)} KB</span></div>` : ""}
  </aside>`;
}

function documentEditorHtml(data, session) {
  const fileMode = session.draft.source === "file";
  const body = `<div class="writer-transfer-form">
    <label><span>创作类型</span><select class="field" data-document-field="creationType">${optionsHtml(CREATION_TYPES, session.draft.creationType)}</select></label>
    <label><span>稿件来源</span><select class="field" data-document-field="source"><option value="file" ${fileMode ? "selected" : ""}>本地文件</option><option value="feishu" ${!fileMode ? "selected" : ""}>飞书云文档</option></select></label>
    ${fileMode ? `<label><span>选择文档</span><input class="field" type="file" accept=".txt,.md,.markdown,.docx,.pdf,.jpg,.jpeg,.png,.webp" data-document-file><small>${session.file ? `当前：${escapeHtml(session.file.name)}；重新选择会立即使旧预览失效。` : "支持 TXT、Markdown、DOCX、PDF 和常见图片。"}</small></label>` : `<label><span>飞书文档链接</span><input class="field" type="url" inputmode="url" value="${escapeHtml(session.draft.feishuUrl)}" placeholder="https://...feishu.cn/docx/..." data-document-field="feishuUrl"><small>需给平台文档应用授予只读权限；平台不保存飞书访问凭据。</small></label>`}
    <label><span>写入目标</span><select class="field" data-document-field="target">${documentTargetOptions(data, session.draft.target, session.draft.creationType)}</select></label>
    ${fileMode ? `<label class="checkbox-line"><input type="checkbox" data-document-check="allowOcr" ${session.draft.allowOcr ? "checked" : ""}> 图片型 PDF 尝试 OCR 为文字（较慢，需复核）</label><label><span>PDF 图片导入布局</span><select class="field" data-document-field="pageLayout"><option value="single_section" ${session.draft.pageLayout === "single_section" ? "selected" : ""}>整份 PDF 合并为一个分幕</option><option value="one_section_per_page" ${session.draft.pageLayout === "one_section_per_page" ? "selected" : ""}>每页单独一个分幕</option></select></label>` : ""}
    <label class="checkbox-line writer-rights-check"><input type="checkbox" data-document-check="rightsConfirmed" ${session.draft.rightsConfirmed ? "checked" : ""}> 我确认拥有该稿件或已取得处理与导入授权</label>
    <div class="writer-transfer-inline-actions"><button type="button" class="secondary-btn" data-action="writer-document-parse">${session.savingAction === "parse" ? "正在解析…" : "解析并生成预览"}</button></div>
    ${documentPreviewHtml(session.parsed, session.draft.creationType)}
  </div>`;
  return renderWorkspaceEditor({
    title: "文档导入工作台",
    kicker: "PARSE · REVIEW · COMMIT",
    intro: "来源或解析参数变化后，旧预览会自动作废，必须重新解析。",
    body,
    submitLabel: session.savingAction === "import" ? "正在导入…" : "确认写入云端",
    submitAction: canImportDocument(session) ? "writer-document-import" : "",
    cancelAction: "writer-tool-close",
    cancelLabel: "返回创作中心",
    className: "writer-document-editor",
    status: session.error ? `<strong>操作未完成</strong><p>${escapeHtml(session.error)}</p>` : ""
  });
}

export function documentWorkspaceHtml(data, session) {
  return `<section class="writer-tool-workspace" data-writer-tool-workspace data-writer-tool="document">
    <button type="button" class="workspace-back-btn" data-action="writer-tool-close">← 返回创作中心</button>
    <div class="writer-tool-grid writer-tool-grid-wide">
      ${documentContextHtml(data, session)}
      ${documentEditorHtml(data, session)}
    </div>
  </section>`;
}

function invalidateDocumentPreview(session) {
  session.parsed = null;
  session.previewFingerprint = "";
  session.error = "";
}

export function openDocumentWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能导入或修改稿件");
  const session = beginWriterToolSession("document", data, {
    draft: {
      creationType: normalizeCreationType(data.world?.settings?.creationType),
      source: "file",
      target: "structured",
      feishuUrl: "",
      allowOcr: false,
      pageLayout: "single_section",
      rightsConfirmed: false
    },
    file: null,
    fileRevision: 0,
    fileBase64: "",
    parsed: null,
    sourceFingerprint: "",
    previewFingerprint: ""
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
}

export function bindDocumentWorkspace(data, session) {
  const root = document.querySelector('[data-writer-tool="document"]');
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";
  root.querySelector("[data-document-file]")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0] || null;
    if (file && file.size > MAX_DOCUMENT_FILE_BYTES) {
      event.target.value = "";
      session.file = null;
      session.fileBase64 = "";
      invalidateDocumentPreview(session);
      showToast("文档不能超过 5MB，请压缩图片或拆分后再导入");
      render();
      return;
    }
    session.file = file;
    session.fileRevision += 1;
    session.fileBase64 = "";
    session.sourceFingerprint = documentSourceFingerprint(session);
    invalidateDocumentPreview(session);
    render();
  });
  root.querySelectorAll("[data-document-field]").forEach((element) => {
    const eventName = element.tagName === "SELECT" ? "change" : "input";
    const updateField = () => {
      const field = element.dataset.documentField;
      session.draft[field] = element.value;
      if (field === "source") {
        session.file = null;
        session.fileBase64 = "";
      }
      if (field === "source" || field === "creationType" || field === "feishuUrl") {
        session.sourceFingerprint = documentSourceFingerprint(session);
        invalidateDocumentPreview(session);
      }
      if (field === "target" && session.parsed?.contentMode === "pages" && (element.value === "manuscript" || element.value === "structured")) {
        showToast("图片分幕只能导入到角色私人剧本");
      }
      if (element.tagName === "SELECT") render();
    };
    element.addEventListener(eventName, updateField);
    if (element.tagName !== "SELECT") {
      element.addEventListener("change", () => {
        updateField();
        render();
      });
    }
  });
  root.querySelectorAll("[data-document-check]").forEach((element) => {
    element.addEventListener("change", () => {
      const field = element.dataset.documentCheck;
      session.draft[field] = Boolean(element.checked);
      if (field === "allowOcr") {
        session.sourceFingerprint = documentSourceFingerprint(session);
        invalidateDocumentPreview(session);
      }
      render();
    });
  });
  if (session.savingAction) setWorkspaceSaving(root.querySelector("[data-workspace-editor]"), true);
}

function editableDocumentSession() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (!session || session.type !== "document" || !canEditWorldContent(data?.world)) return null;
  return session;
}

export async function parseDocumentWorkspace() {
  const session = editableDocumentSession();
  if (!session || session.savingAction) return;
  if (!session.draft.rightsConfirmed) return showToast("请先确认稿件版权与处理授权");
  if (session.draft.source === "file" && !session.file) return showToast("请先选择文档");
  if (session.draft.source === "feishu" && !session.draft.feishuUrl.trim()) return showToast("请粘贴飞书文档链接");
  session.savingAction = "parse";
  session.error = "";
  session.sourceFingerprint = documentSourceFingerprint(session);
  const requestFingerprint = session.sourceFingerprint;
  render();
  try {
    let parsed;
    if (session.draft.source === "feishu") {
      parsed = await zhimuApi.parseFeishuDocument({
        url: session.draft.feishuUrl.trim(),
        creationType: session.draft.creationType,
        rightsConfirmed: true
      });
    } else {
      session.fileBase64 ||= await fileToBase64(session.file);
      if (!writerToolSessionIsCurrent(session)) return;
      parsed = await zhimuApi.parseDocument({
        filename: session.file.name,
        contentType: session.file.type || undefined,
        contentBase64: session.fileBase64,
        allowOcr: session.draft.allowOcr,
        parseMode: session.draft.allowOcr ? "text" : "auto",
        creationType: session.draft.creationType,
        rightsConfirmed: true
      });
    }
    if (!writerToolSessionIsCurrent(session) || requestFingerprint !== documentSourceFingerprint(session)) return;
    session.parsed = parsed;
    session.previewFingerprint = requestFingerprint;
    showToast(parsed.contentMode === "pages" ? "识别为图片文档，请选择角色并复核页面" : "结构识别完成，请复核后再导入");
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      invalidateDocumentPreview(session);
      session.error = normalizeError(error, "文档解析失败");
    }
  } finally {
    if (writerToolSessionIsCurrent(session)) {
      session.savingAction = "";
      render();
    }
  }
}

export async function importDocumentWorkspace() {
  const session = editableDocumentSession();
  if (!session || session.savingAction || !canImportDocument(session)) return;
  session.savingAction = "import";
  session.error = "";
  render();
  let committedMessage = "";
  try {
    const target = session.draft.target;
    if (session.parsed.contentMode === "pages") {
      await zhimuApi.importDocumentPages({
        filename: session.file.name,
        contentType: session.file.type || undefined,
        contentBase64: session.fileBase64,
        roleSlotId: target,
        layout: session.draft.pageLayout,
        rightsConfirmed: true
      });
      committedMessage = "图片分幕已上传，玩家端可翻页阅读";
    } else {
      const resolvedTarget = target === "structured" ? "structured" : target === "manuscript" ? "manuscript" : "role_script";
      const result = await zhimuApi.importParsedDocument({
        target: resolvedTarget,
        roleSlotId: resolvedTarget === "role_script" ? target : null,
        creationType: session.draft.creationType,
        rightsConfirmed: true,
        document: {
          filename: session.parsed.filename,
          text: session.parsed.text,
          sections: session.parsed.sections
        }
      });
      const created = Object.values(result.created || {}).reduce((sum, count) => sum + Number(count || 0), 0);
      committedMessage = resolvedTarget === "structured" ? `结构化草稿已导入：${created} 项写入` : "文档内容已写入云端";
    }
    if (!writerToolSessionIsCurrent(session)) return;
    clearWriterToolSession(session);
    try {
      await loadCloudData();
      showToast(committedMessage);
    } catch {
      showToast(`${committedMessage}；页面刷新失败，请手动刷新，切勿重复导入`);
    }
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.error = normalizeError(error, "文档导入失败");
      session.savingAction = "";
      render();
    }
  }
}
