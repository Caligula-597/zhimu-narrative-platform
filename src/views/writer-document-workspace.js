import * as zhimuApi from "../api/index.js";
import { canEditWorldContent } from "../components/emptyState.js";
import { renderWorkspaceEditor, setWorkspaceSaving } from "../components/workspace-editor.js";
import { showToast } from "../components/toast.js";
import { normalizeError } from "../components/status-ui.js";
import { loadCloudData, render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { creatorTerms } from "../../shared/creator-terminology.js";
import { narrativeProfileFromSettings } from "../../shared/narrative-profile.js";
import {
  beginWriterToolSession,
  clearWriterToolSession,
  getWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import { fileFingerprint, fileToBase64 } from "./writer-transfer-files.js";
import {
  writerToolContextPanelHtml,
  writerToolGridPageHtml,
  writerToolGuidanceHtml
} from "./writer-tool-layout.js";

const DOCUMENT_PRODUCT = "murder_mystery";
const MAX_DOCUMENT_FILE_BYTES = 5 * 1024 * 1024;

function optionsHtml(items, selectedId) {
  return items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

function documentTargetOptions(data, selectedId) {
  const terms = creatorTerms(DOCUMENT_PRODUCT);
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

function proseDiagnosticsHtml(report) {
  if (!report) return "";
  const issueRows = (report.issues || []).slice(0, 6).map((issue) =>
    `<article class="revision-row ${issue.severity === "high" ? "must_fix" : "should_fix"}"><div class="revision-head"><span class="cloud-pill">${issue.severity === "high" ? "重点复核" : "抽查"}</span><b>${escapeHtml(issue.sectionTitle || (issue.paragraph ? `第 ${issue.paragraph} 段` : "全文"))}</b></div>${issue.excerpt ? `<p><strong>原文</strong> ${escapeHtml(issue.excerpt)}</p>` : ""}<p><strong>依据</strong> ${escapeHtml(issue.message || "")}</p><p><strong>建议</strong> ${escapeHtml(issue.action || "")}</p></article>`
  ).join("");
  const rhythmRows = (report.rhythm?.observations || []).slice(0, 8).map((item) => {
    const examples = (item.samples || []).length
      ? `<p><strong>样本</strong> ${escapeHtml(item.samples.join(" ｜ "))}</p>`
      : "";
    return `<article class="revision-row should_fix"><div class="revision-head"><span class="cloud-pill">统计观察</span><b>${escapeHtml(item.message || item.code || "叙事呼吸")}</b></div><p><strong>分布</strong> ${escapeHtml(item.evidence || "")}</p>${examples}<p><strong>人工复核</strong> ${escapeHtml(item.reviewQuestion || "")}</p></article>`;
  }).join("");
  const summary = report.summary || {};
  const reviewRequired = report.review?.required === true;
  const reviewLabel = reviewRequired ? "需要作者复核" : "未记录异常";
  const reviewReason = report.review?.reason
    ? `<p class="prose-diagnostics-reason"><strong>${reviewLabel}</strong> · ${escapeHtml(report.review.reason)}</p>`
    : "";
  const sample = report.rhythm?.sample || {};
  const stats = [
    `硬边界 ${Number(summary.hardBoundaryIssues || 0)}`,
    `叙事呼吸观察 ${Number(summary.rhythmObservations || 0)}`,
    `正文段 ${Number(sample.paragraphs || 0)}`,
    `对白轮次 ${Number(sample.dialogueTurns || 0)}`
  ].map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  return `<section class="prose-diagnostics ${reviewRequired ? "needs-review" : "observed"}"><div class="section-head"><div><p class="section-kicker">上传稿件 · 可解释文本诊断</p><h4>硬边界与 Narrative Rhythm / 叙事呼吸</h4><p>只展示原文证据和统计分布，不计算文学分数。</p></div><span class="cloud-pill">${reviewLabel}</span></div>${reviewReason}<div class="proposal-stats">${stats}</div>${issueRows ? `<div class="revision-list"><h4>硬边界与可定位问题</h4>${issueRows}</div>` : ""}${rhythmRows ? `<div class="revision-list"><h4>Narrative Rhythm / 叙事呼吸</h4>${rhythmRows}</div>` : `<p class="muted-note">当前样本未触发已登记的统计异常；这不等于系统对文学质量作出通过判断。</p>`}<p class="muted-note">${escapeHtml(report.disclaimer || "")}</p></section>`;
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
  const roles = candidates.filter((item) => item.type === "role");
  const acts = candidates.filter((item) => item.type === "act");
  const other = candidates.filter((item) => item.type !== "role" && item.type !== "act");
  const gate = structure?.gate;
  const kindLabel =
    gate?.documentKind === "host_handbook"
      ? "主持手册"
      : gate?.documentKind === "role_book"
        ? "角色本"
        : gate?.documentKind === "mixed"
          ? "混合稿"
          : "未分类";
  const planRows = (gate?.plan || parsed.structurePlan || [])
    .slice(0, 8)
    .map((item) => `<li><strong>${escapeHtml(String(item.step || ""))}.</strong> ${escapeHtml(item.label || item.action || "")}</li>`)
    .join("");
  const gatePlanHtml = planRows
    ? `<section class="document-structure-plan"><h4>机械门禁 · 下一步</h4><p class="muted-note">文稿类型：${escapeHtml(kindLabel)}${gate?.readyForImport === false ? " · 暂不建议直接结构化导入" : " · 可预览后导入"}</p><ol>${planRows}</ol></section>`
    : "";
  const listBlock = (title, items) =>
    items.length
      ? `<div class="document-structure-group"><h5>${escapeHtml(title)}</h5>${items
          .slice(0, 12)
          .map(
            (item) =>
              `<article><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.type)} · ${escapeHtml(item.confidence)}${item.parentActTitle ? ` · ${escapeHtml(item.parentActTitle)}` : ""}</span></article>`
          )
          .join("")}${items.length > 12 ? `<p class="muted-note">另有 ${items.length - 12} 项</p>` : ""}</div>`
      : "";
  const structurePreview = candidates.length
    ? `<section class="document-structure-preview"><h4>结构分组 · ${escapeHtml(structureSummary)}</h4>${listBlock("角色", roles)}${listBlock("章节 / 分幕", acts)}${listBlock("其他", other)}</section>`
    : "";
  const summary = parsed.contentMode === "pages" ? `${Number(parsed.pageCount || 0)} 页图片分幕` : `${Number(parsed.characterCount || 0)} 字符 · ${Number(parsed.sectionCount || 0)} 个分段`;
  return `<section class="assistant-preview document-workspace-preview"><div class="section-head"><div><h3>${escapeHtml(parsed.filename || "解析结果")}</h3><p>${summary}${modeLabel ? ` · ${escapeHtml(modeLabel)}` : ""}</p></div><span class="cloud-pill">仅预览</span></div>${warnings}${gatePlanHtml}${proseDiagnosticsHtml(parsed.proseDiagnostics)}${structurePreview}${previewImage}<div class="document-section-preview">${sections}</div></section>`;
}

function canImportDocument(session) {
  if (!session.parsed || !session.draft.rightsConfirmed || session.previewFingerprint !== session.sourceFingerprint) return false;
  const target = session.draft.target;
  if (session.parsed.contentMode === "pages") return target !== "manuscript" && target !== "structured" && Boolean(session.file && session.fileBase64);
  if (session.parsed.proseDiagnostics?.review?.required === true && !session.draft.proseReviewConfirmed) return false;
  if (target === "structured") return Boolean(session.parsed.structure?.candidateCount);
  return true;
}

function documentSourceFingerprint(session) {
  const source = session.draft.source;
  const sourceId = source === "feishu" ? session.draft.feishuUrl.trim() : fileFingerprint(session.file);
  return [DOCUMENT_PRODUCT, source, sourceId, session.fileRevision || 0, session.draft.allowOcr].join("|");
}

function documentContextHtml(data, session) {
  const parsed = session.parsed;
  return writerToolContextPanelHtml({
    kicker: "DOCUMENT INGESTION",
    title: "稿件解析与结构化导入",
    intro: "先解析、再复核、最后写入。系统识别角色、幕、场景、线索和秘密，不会把整份文档直接塞进单一编辑器。",
    facts: [
      { label: "解析状态", value: parsed ? "已预览" : "待解析" },
      { label: "分段", value: Number(parsed?.sectionCount || parsed?.pageCount || 0) },
      { label: "目标", value: session.draft.target === "structured" ? "结构化" : session.draft.target === "manuscript" ? "母稿" : "角色本" }
    ],
    bodyHtml: `${writerToolGuidanceHtml({
      title: "版权与保密",
      text: "只导入你拥有或获授权处理的稿件。私有稿件不会自动公开或用于平台训练；调用外部 AI 能力前应另行确认供应商与数据范围。"
    })}
    ${session.file ? `<div class="writer-tool-file"><strong>已选择文件</strong><span>${escapeHtml(session.file.name)} · ${Math.ceil(session.file.size / 1024)} KB</span></div>` : ""}`
  });
}

function documentEditorHtml(data, session) {
  const fileMode = session.draft.source === "file";
  const needsProseReview = session.parsed?.contentMode === "text" && session.parsed.proseDiagnostics?.review?.required === true;
  const body = `<div class="writer-transfer-form">
    <div class="field" aria-readonly="true"><strong>项目类型</strong> · 剧本杀稿件</div>
    <label><span>稿件来源</span><select class="field" data-document-field="source"><option value="file" ${fileMode ? "selected" : ""}>本地文件</option><option value="feishu" ${!fileMode ? "selected" : ""}>飞书云文档</option></select></label>
    ${fileMode ? `<label><span>选择文档</span><input class="field" type="file" accept=".docx,.zip" data-document-file><small>${session.file ? `当前：${escapeHtml(session.file.name)}；重新选择会立即使旧预览失效。` : "稿件解析仅支持 Word .docx；也可上传含 .docx 的 ZIP。图片与音频请走素材库。"}</small></label>` : `<label><span>飞书文档链接</span><input class="field" type="url" inputmode="url" value="${escapeHtml(session.draft.feishuUrl)}" placeholder="https://...feishu.cn/docx/..." data-document-field="feishuUrl"><small>需给平台文档应用授予只读权限；平台不保存飞书访问凭据。</small></label>`}
    <label><span>写入目标</span><select class="field" data-document-field="target">${documentTargetOptions(data, session.draft.target)}</select></label>
    ${fileMode ? "" : ""}
    <label class="checkbox-line writer-rights-check"><input type="checkbox" data-document-check="rightsConfirmed" ${session.draft.rightsConfirmed ? "checked" : ""}> 我确认拥有该稿件或已取得处理与导入授权</label>
    <div class="writer-transfer-inline-actions"><button type="button" class="secondary-btn" data-action="writer-document-parse">${session.savingAction === "parse" ? "正在解析…" : "解析并生成预览"}</button></div>
    ${documentPreviewHtml(session.parsed, DOCUMENT_PRODUCT)}
    ${needsProseReview ? `<label class="checkbox-line prose-diagnostics-review-check"><input type="checkbox" data-document-check="proseReviewConfirmed" ${session.draft.proseReviewConfirmed ? "checked" : ""}> 我已阅读硬边界证据与叙事呼吸统计观察，并由自己判断是否继续导入</label><p class="muted-note">未确认前不会写入。系统没有给出文学分数，也不替作者判定稿件好坏。</p>` : ""}
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
  return writerToolGridPageHtml({
    type: "document",
    wide: true,
    contextHtml: documentContextHtml(data, session),
    contentHtml: documentEditorHtml(data, session)
  });
}

function invalidateDocumentPreview(session) {
  session.parsed = null;
  session.previewFingerprint = "";
  session.error = "";
}

export function openDocumentWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (narrativeProfileFromSettings(data.world.settings || {}).creationType !== DOCUMENT_PRODUCT) {
    return showToast("稿件解析只属于剧本杀工作区，当前项目不能调用");
  }
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能导入或修改稿件");
  const session = beginWriterToolSession("document", data, {
    draft: {
      source: "file",
      target: "structured",
      feishuUrl: "",
      allowOcr: false,
      pageLayout: "single_section",
      rightsConfirmed: false,
      proseReviewConfirmed: false
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
      if (field === "source" || field === "feishuUrl") {
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
  if (
    !session || session.type !== "document" || !canEditWorldContent(data?.world)
    || narrativeProfileFromSettings(data?.world?.settings || {}).creationType !== DOCUMENT_PRODUCT
  ) return null;
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
        creationType: DOCUMENT_PRODUCT,
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
        creationType: DOCUMENT_PRODUCT,
        rightsConfirmed: true
      });
    }
    if (!writerToolSessionIsCurrent(session) || requestFingerprint !== documentSourceFingerprint(session)) return;
    session.parsed = parsed;
    session.draft.proseReviewConfirmed = false;
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
        creationType: DOCUMENT_PRODUCT,
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
