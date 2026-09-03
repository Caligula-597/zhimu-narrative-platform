import { escapeHtml } from "../utils/format.js";
import { renderWorkspaceEditor } from "../components/workspace-editor.js";
import {
  writerToolContextPanelHtml,
  writerToolGridPageHtml,
  writerToolGuidanceHtml
} from "./writer-tool-layout.js";

const STEPS = [
  { step: 1, title: "开始", kicker: "STEP 1 / 6" },
  { step: 2, title: "主持手册", kicker: "STEP 2 / 6" },
  { step: 3, title: "角色剧本", kicker: "STEP 3 / 6" },
  { step: 4, title: "线索文字", kicker: "STEP 4 / 6" },
  { step: 5, title: "线索图片", kicker: "STEP 5 / 6" },
  { step: 6, title: "确认写入", kicker: "STEP 6 / 6" }
];

function fileRow(label, file) {
  if (!file) return `<div class="opening-package-empty">${escapeHtml(label)}：尚未选择</div>`;
  return `<div class="writer-tool-file"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(file.name)} · ${Math.ceil(file.size / 1024)} KB</span></div>`;
}

function fileListHtml(label, files = []) {
  if (!files.length) return `<div class="opening-package-empty">${escapeHtml(label)}：尚未选择（可跳过）</div>`;
  return `<div class="opening-package-file-list"><strong>${escapeHtml(label)}</strong><ul>${files.map((item) => `<li>${escapeHtml(item.file?.name || item.name || "文件")}</li>`).join("")}</ul></div>`;
}

function previewSummaryHtml(preview) {
  if (!preview) return `<div class="opening-package-empty">尚未生成预览，请点击「生成总览预览」。</div>`;
  const host = preview.hostHandbook;
  const roles = preview.roleScripts || [];
  const clues = preview.clueTextDoc;
  const images = preview.clueImages || [];
  return `<section class="opening-package-preview">
    <div class="opening-package-preview-grid">
      <article><b>主持手册</b><span>${escapeHtml(host?.filename || "")}</span><small>${Number(host?.characterCount || 0)} 字</small></article>
      <article><b>角色剧本</b><span>${roles.length} 个文件</span><small>${roles.map((item) => escapeHtml(item.roleName || item.filename)).join("、")}</small></article>
      <article><b>线索文字</b><span>${clues ? escapeHtml(clues.filename) : "未上传"}</span><small>${clues ? `${Number(clues.clueCount || 0)} 条线索` : "可选"}</small></article>
      <article><b>线索图片</b><span>${images.length} 张</span><small>${images.length ? "将绑定同名线索或新建图片线索" : "可选"}</small></article>
    </div>
  </section>`;
}

function stageSchemaConfirmHtml(session) {
  const proposal = session.preview?.stageSchemaProposal;
  if (!proposal?.items?.length) return "";

  const decision = session.stageSchemaDecision || "";
  const editing = decision === "manual" || session.stageSchemaEditing;
  const items = session.stageSchemaDraftItems || proposal.items;
  const statusLine = decision === "confirm"
    ? `<p class="opening-package-stage-status">已确认：设为统一游戏阶段（${escapeHtml(proposal.label || "")}）</p>`
    : decision === "reject"
      ? `<p class="opening-package-stage-status">已确认：仅作章节标题，不设统一阶段</p>`
      : decision === "manual" && !session.stageSchemaEditing
        ? `<p class="opening-package-stage-status">已手动设定：${escapeHtml((session.stageSchema?.label) || items.map((i) => i.name).join(" / "))}</p>`
        : `<p class="opening-package-stage-hint">请确认后再写入世界（可不改，但建议先选一项）。</p>`;

  const listHtml = editing
    ? `<ol class="opening-package-stage-edit-list">${items.map((item, index) => `
        <li>
          <label><span>阶段 ${index + 1}</span>
            <input class="field" type="text" data-opening-stage-edit="${index}" value="${escapeHtml(item.name || "")}" maxlength="80">
          </label>
        </li>`).join("")}</ol>
        <div class="writer-transfer-inline-actions">
          <button type="button" class="primary-btn" data-action="opening-package-stage-manual-save">保存手动阶段</button>
          <button type="button" class="secondary-btn" data-action="opening-package-stage-manual-cancel">取消</button>
        </div>`
    : `<ol class="opening-package-stage-list">${(proposal.items || []).map((item) => `<li>${escapeHtml(`${item.order}. ${item.name}`)}</li>`).join("")}</ol>
        <div class="writer-transfer-inline-actions opening-package-stage-actions">
          <button type="button" class="primary-btn" data-action="opening-package-stage-confirm">是，设为统一阶段</button>
          <button type="button" class="secondary-btn" data-action="opening-package-stage-reject">不是，只作为章节标题</button>
          <button type="button" class="secondary-btn" data-action="opening-package-stage-manual">手动编辑</button>
        </div>`;

  const promptLines = String(proposal.prompt || "")
    .split(/\n/)
    .map((line) => escapeHtml(line))
    .join("<br>");

  return `<section class="opening-package-stage-schema" data-opening-stage-schema>
    <h4>统一游戏阶段确认</h4>
    <p class="opening-package-stage-prompt">${promptLines}</p>
    ${listHtml}
    ${statusLine}
  </section>`;
}

function stepBodyHtml(session) {
  const step = Number(session.draft.step || 1);
  if (step === 1) {
    return `<section class="opening-package-step">
      <p class="section-kicker">${STEPS[0].kicker}</p>
      <h3>按开本包上传剧本素材</h3>
      <p class="wizard-intro">请分别上传主持手册、各角色玩家剧本、线索文字版与线索图片。系统会按你选择的槽位落位，不再从一本合稿里猜结构。</p>
      <ol class="opening-package-guide">
        <li><strong>主持手册</strong> — 开本前主持必看（docx）</li>
        <li><strong>角色剧本</strong> — 玩家可看私人本（多个 docx 或 zip）</li>
        <li><strong>线索文字</strong> — 线索 docx，便于检索与主持提示（可选）</li>
        <li><strong>线索图片</strong> — jpg/png 线索卡，可 zip 批量（可选）</li>
      </ol>
      <label class="checkbox-line writer-rights-check"><input type="checkbox" data-opening-check="rightsConfirmed" ${session.draft.rightsConfirmed ? "checked" : ""}> 我确认拥有这些稿件或已取得处理与导入授权</label>
    </section>`;
  }
  if (step === 2) {
    return `<section class="opening-package-step">
      <p class="section-kicker">${STEPS[1].kicker}</p>
      <h3>主持手册（必传）</h3>
      <p>上传主持开本前必看全文。将写入「主持手册全文」，主持端可读。</p>
      <label><span>选择 docx</span><input class="field" type="file" accept=".docx,.zip" data-opening-host-file></label>
      ${fileRow("已选主持手册", session.hostFile)}
    </section>`;
  }
  if (step === 3) {
    return `<section class="opening-package-step">
      <p class="section-kicker">${STEPS[2].kicker}</p>
      <h3>角色剧本（玩家可看）</h3>
      <p>每个角色一份 docx，或上传含多个 docx 的 zip。文件名建议用角色名，如「莫怀.docx」。</p>
      <label><span>添加角色剧本</span><input class="field" type="file" accept=".docx,.zip" multiple data-opening-role-files></label>
      ${fileListHtml("已选角色剧本", session.roleFiles)}
    </section>`;
  }
  if (step === 4) {
    return `<section class="opening-package-step">
      <p class="section-kicker">${STEPS[3].kicker}</p>
      <h3>线索文字版（可选）</h3>
      <p>线索 docx 会解析为系统内线索条目，供主持检索与发放记录。</p>
      <label><span>选择 docx</span><input class="field" type="file" accept=".docx,.zip" data-opening-clue-doc-file></label>
      ${fileRow("已选线索文字", session.clueDocFile)}
      <button type="button" class="text-btn" data-action="opening-package-skip">跳过此步 →</button>
    </section>`;
  }
  if (step === 5) {
    return `<section class="opening-package-step">
      <p class="section-kicker">${STEPS[4].kicker}</p>
      <h3>线索图片版（可选）</h3>
      <p>上传 jpg/png 线索卡，或 zip 批量。文件名尽量与线索名一致，便于自动配对。</p>
      <label><span>添加图片</span><input class="field" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.zip" multiple data-opening-clue-image-files></label>
      ${fileListHtml("已选线索图片", session.clueImageFiles)}
      <button type="button" class="text-btn" data-action="opening-package-skip">跳过此步 →</button>
    </section>`;
  }
  return `<section class="opening-package-step">
    <p class="section-kicker">${STEPS[5].kicker}</p>
    <h3>总览与写入</h3>
    <p>确认各槽位文件无误后写入世界。角色分幕与线索默认为草稿，不会直接发布给玩家。</p>
    ${previewSummaryHtml(session.preview)}
    ${stageSchemaConfirmHtml(session)}
    <div class="writer-transfer-inline-actions">
      <button type="button" class="secondary-btn" data-action="opening-package-preview-run"${session.savingAction === "preview" ? " disabled" : ""}>${session.savingAction === "preview" ? "正在生成预览…" : "生成总览预览"}</button>
    </div>
  </section>`;
}

function navActionsHtml(session) {
  const step = Number(session.draft.step || 1);
  const back = step > 1 ? `<button type="button" class="secondary-btn" data-action="opening-package-back">上一步</button>` : "";
  const next = step < 6 ? `<button type="button" class="primary-btn" data-action="opening-package-next">下一步</button>` : "";
  return `<div class="writer-transfer-inline-actions opening-package-nav">${back}${next}</div>`;
}

export function openingPackageWorkspaceHtml(data, session) {
  const stepMeta = STEPS.find((item) => item.step === session.draft.step) || STEPS[0];
  return writerToolGridPageHtml({
    type: "opening-package",
    wide: true,
    className: "opening-package-workspace",
    contextHtml: writerToolContextPanelHtml({
      kicker: "OPENING PACKAGE",
      title: "开本包上传向导",
      intro: "按槽位引导上传主持手册、角色本、线索文字与线索图片，确认后一次性写入世界。",
      facts: [
        { label: "当前步骤", value: `${session.draft.step}/6` },
        { label: "步骤名", value: stepMeta.title },
        { label: "主持手册", value: session.hostFile ? "已选" : "待上传" }
      ],
      bodyHtml: writerToolGuidanceHtml({
        title: "与「单 docx 智能拆稿」的区别",
        text: "本向导由你指定每个文件属于哪类素材；「文档解析」仍适合结构规范的单本文稿自动拆分。"
      })
    }),
    contentHtml: renderWorkspaceEditor({
      title: stepMeta.title,
      kicker: stepMeta.kicker,
      intro: "上一步下一步可返回修改；最后一步需生成预览后再写入。",
      body: `${stepBodyHtml(session)}${navActionsHtml(session)}`,
      submitLabel: session.commitArmed ? "再次点击确认写入" : "确认写入世界",
      submitAction: session.draft.step === 6 && session.preview ? "opening-package-commit" : "",
      cancelAction: "writer-tool-close",
      cancelLabel: "返回创作中心",
      className: "opening-package-editor",
      status: session.error ? `<strong>操作未完成</strong><p>${escapeHtml(session.error)}</p>` : ""
    })
  });
}
