import * as zhimuApi from "../api/index.js";
import { canEditWorldContent } from "../components/emptyState.js";
import { renderWorkspaceEditor, setWorkspaceSaving } from "../components/workspace-editor.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import { loadCloudData, render } from "../runtime/runtime-facade.js";
import { studioStore, worldStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import {
  beginWriterToolSession,
  clearWriterToolSession,
  getWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import {
  buildClueCardsMarkdown,
  buildHostRunbookMarkdown,
  buildRoleScriptsMarkdown,
  contentPackagePreviewHtml,
  contentPackageSummaryHtml,
  downloadTextFile,
  fileFingerprint
} from "./writer-transfer-files.js";
import {
  writerToolContextPanelHtml,
  writerToolGridPageHtml,
  writerToolGuidanceHtml
} from "./writer-tool-layout.js";

const MAX_CONTENT_PACKAGE_FILE_BYTES = 15 * 1024 * 1024;
const MAX_PLAIN_TEXT_FILE_BYTES = 500_000;

function exportSelectionsHtml(session, data, segments) {
  const summary = session.summary || {};
  const selections = session.draft.selections;
  const options = [
    ["json", `完整结构化归档 JSON（${Number(summary.roles || 0)} 角色 · ${Number(summary.chapters || 0)} 章节 · ${Number(summary.clues || 0)} 线索）`],
    ["roleScripts", `玩家剧本 Markdown（${data.roles?.length || 0} 角色，按角色分文件）`],
    ["clueCards", `线索清单 Markdown（${data.clues?.length || 0} 条）`],
    ["hostRunbook", `主持手册 Markdown（${segments.length} 个 Segment）`],
    ["snapshot", "保存创作版本快照（写入云端版本记录）"]
  ];
  return `<div class="writer-export-options">${options.map(([key, label]) => `<label class="check-label"><input type="checkbox" data-export-kind="${key}" ${selections[key] ? "checked" : ""}> ${escapeHtml(label)}</label>`).join("")}</div>`;
}

function exportPicked(session) {
  const names = {
    json: "完整结构化归档 JSON",
    roleScripts: "玩家剧本",
    clueCards: "线索清单",
    hostRunbook: "主持手册",
    snapshot: "创作版本快照"
  };
  return Object.entries(session.draft.selections).filter(([, enabled]) => enabled).map(([key]) => names[key]);
}

function exportWorkspaceBody(data, session) {
  const segments = worldStore.get().cloudSegments || [];
  if (session.status === "loading") return `<div class="writer-tool-empty-preview"><strong>正在核对可导出的内容…</strong><p>完成后可选择结构化备份、玩家稿、线索清单、主持手册和版本快照。</p></div>`;
  if (session.draft.step === 1) return `<section class="assistant-preview delivery-export-step"><p class="section-kicker">步骤 1 / 2</p><h3>选择交付物</h3><p class="wizard-intro">JSON 用于完整结构化归档，Markdown 可打印或二次排版。附件二进制需要从资产中心另行下载。</p>${exportSelectionsHtml(session, data, segments)}<div class="writer-transfer-inline-actions"><button type="button" class="primary-btn" data-action="writer-export-next">下一步：确认范围</button></div></section>`;
  const picked = exportPicked(session);
  return `<section class="assistant-preview delivery-export-step"><p class="section-kicker">步骤 2 / 2</p><h3>确认导出 · ${escapeHtml(data.world?.name || "剧本")}</h3>${contentPackageSummaryHtml(session.summary)}<div class="assistant-guide"><b>即将导出</b><span>${picked.length ? picked.join("、") : "未选择任何交付物"}</span></div><div class="writer-transfer-inline-actions"><button type="button" class="secondary-btn" data-action="writer-export-back">返回修改范围</button></div></section>`;
}

export function exportWorkspaceHtml(data, session) {
  return writerToolGridPageHtml({
    type: "export",
    contextHtml: writerToolContextPanelHtml({
      kicker: "DELIVERY PACKAGE",
      title: "导出与交付",
      intro: "把云端创作内容拆成适合迁移、排版、发稿和主持执行的交付物，并可在导出时保存版本锚点。",
      facts: [
        { label: "步骤", value: `${session.draft.step}/2` },
        { label: "已选择", value: exportPicked(session).length },
        { label: "权限", value: "主创" }
      ],
      bodyHtml: writerToolGuidanceHtml({
        title: "保密提醒",
        text: "下载文件离开平台后由本机和接收方保管。对外发稿前请检查隐藏真相、主持信息和玩家稿是否被错误打包。"
      })
    }),
    contentHtml: renderWorkspaceEditor({
        title: "创作内容交付",
        kicker: "SELECT · REVIEW · EXPORT",
        intro: "导出不会修改正文；勾选版本快照时会新增一条云端版本记录。",
        body: exportWorkspaceBody(data, session),
        submitLabel: session.savingAction ? "正在生成交付物…" : "生成并下载",
        submitAction: session.status === "ready" && session.draft.step === 2 ? "writer-export-run" : "",
        cancelAction: "writer-tool-close",
        cancelLabel: "返回创作中心",
        className: "writer-export-editor",
        status: session.error ? `<strong>导出未全部完成</strong><p>${escapeHtml(session.error)}</p>` : ""
    })
  });
}

export async function openExportWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能导出私有创作内容");
  const session = beginWriterToolSession("export", data, {
    status: "loading",
    summary: {},
    draft: {
      step: 1,
      selections: { json: true, roleScripts: false, clueCards: false, hostRunbook: false, snapshot: false }
    }
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    const summary = await zhimuApi.getContentPackageSummary();
    if (!writerToolSessionIsCurrent(session)) return;
    session.summary = summary || {};
    session.status = "ready";
    render();
  } catch (error) {
    if (!writerToolSessionIsCurrent(session)) return;
    session.status = "error";
    session.error = normalizeError(error, "导出范围加载失败");
    render();
  }
}

export function bindExportWorkspace(_data, session) {
  const root = document.querySelector('[data-writer-tool="export"]');
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";
  root.querySelectorAll("[data-export-kind]").forEach((element) => {
    element.addEventListener("change", () => {
      session.draft.selections[element.dataset.exportKind] = Boolean(element.checked);
    });
  });
  if (session.savingAction) setWorkspaceSaving(root.querySelector("[data-workspace-editor]"), true);
}

export function nextExportWorkspaceStep() {
  const session = getWriterToolSession(studioStore.get().cloudStudio);
  if (!session || session.type !== "export" || session.status !== "ready") return;
  session.draft.step = 2;
  render();
}

export function previousExportWorkspaceStep() {
  const session = getWriterToolSession(studioStore.get().cloudStudio);
  if (!session || session.type !== "export" || session.savingAction) return;
  session.draft.step = 1;
  render();
}

export async function runExportWorkspace() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (!session || session.type !== "export" || session.savingAction || !canEditWorldContent(data?.world)) return;
  session.savingAction = "export";
  session.error = "";
  render();
  const completed = [];
  const selections = session.draft.selections;
  const worldName = data.world?.name || "zhimu-backup";
  try {
    if (selections.json) {
      const payload = await zhimuApi.exportContentPackage();
      if (!writerToolSessionIsCurrent(session)) return;
      downloadTextFile(`${worldName}-zhimu-backup.json`, JSON.stringify(payload, null, 2), "application/json");
      completed.push("结构化归档");
    }
    if (selections.roleScripts) {
      for (const file of buildRoleScriptsMarkdown(data)) downloadTextFile(file.filename, file.content, "text/markdown;charset=utf-8");
      completed.push("玩家剧本");
    }
    if (selections.clueCards) {
      downloadTextFile(`${worldName}-线索清单.md`, buildClueCardsMarkdown(data), "text/markdown;charset=utf-8");
      completed.push("线索清单");
    }
    if (selections.hostRunbook) {
      downloadTextFile(`${worldName}-主持手册.md`, buildHostRunbookMarkdown(worldStore.get().cloudSegments || [], worldName), "text/markdown;charset=utf-8");
      completed.push("主持手册");
    }
    if (selections.snapshot) {
      await zhimuApi.createContentVersion({ label: `交付快照 ${new Date().toLocaleString("zh-CN")}` });
      if (!writerToolSessionIsCurrent(session)) return;
      completed.push("版本快照");
    }
    clearWriterToolSession(session);
    if (selections.snapshot) {
      try { await loadCloudData(); } catch { showToast(`已生成 ${completed.join("、")}；版本列表刷新失败，请手动刷新`); return; }
    }
    showToast(completed.length ? `已生成：${completed.join("、")}` : "未选择任何交付物");
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.error = `${normalizeError(error, "导出失败")}${completed.length ? `；已完成：${completed.join("、")}，请勿重复下载` : ""}`;
      session.savingAction = "";
      render();
    }
  }
}

function importFingerprint(session) {
  return `${fileFingerprint(session.file)}|${session.fileRevision || 0}|${session.draft.mode}`;
}

function importPreviewBody(session) {
  if (!session.preview) return `<div class="writer-tool-empty-preview"><strong>等待预览</strong><p>选择文件后先生成预览。更换文件或模式会使旧预览立即失效。</p></div>`;
  if (session.preview.plainText) return `<section class="assistant-preview"><div class="section-head"><div><h3>${escapeHtml(session.file?.name || "纯文本")}</h3><p>文本将新建为所选角色的一段草稿私人分幕。</p></div><span class="cloud-pill">仅预览</span></div><div class="tutorial-tip"><b>写入范围</b><span>不会覆盖现有分幕；导入后可进入角色工作台继续拆分和排版。</span></div></section>`;
  return contentPackagePreviewHtml(session.preview.result);
}

function importPreviewCanCommit(session) {
  if (!session.preview || session.previewFingerprint !== importFingerprint(session)) return false;
  if (session.preview.plainText) return true;
  const result = session.preview.result || {};
  return result.canImport !== false && !result.hasBlockingErrors;
}

export function importWorkspaceHtml(data, session) {
  const roles = data.roles || [];
  const newWorld = session.draft.mode === "new_world";
  const body = `<div class="writer-transfer-form">
    <label><span>导入模式</span><select class="field" data-import-field="mode"><option value="append" ${!newWorld ? "selected" : ""}>追加到当前世界</option><option value="new_world" ${newWorld ? "selected" : ""}>创建新世界并导入</option></select></label>
    ${newWorld ? `<label><span>新世界名称</span><input class="field" data-import-field="newWorldName" value="${escapeHtml(session.draft.newWorldName)}"></label><label><span>世界摘要</span><textarea class="field" rows="4" data-import-field="newWorldSummary">${escapeHtml(session.draft.newWorldSummary)}</textarea></label>` : ""}
    <label><span>内容文件</span><input class="field" type="file" accept=".json,.md,.markdown,.txt" data-import-file><small>${session.file ? `当前：${escapeHtml(session.file.name)}；重新选择会使旧预览失效。` : "JSON 用于结构化迁移；Markdown/TXT 写入角色私人分幕。"}</small></label>
    ${roles.length ? `<label><span>纯文本写入角色</span><select class="field" data-import-field="roleId">${roles.map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === session.draft.roleId ? "selected" : ""}>${escapeHtml(role.name)}</option>`).join("")}</select></label>` : `<div class="tutorial-tip"><b>当前没有角色</b><span>仍可导入完整 JSON 内容包；Markdown/TXT 需要先创建角色。</span></div>`}
    <div class="writer-transfer-inline-actions"><button type="button" class="secondary-btn" data-action="writer-import-preview">${session.savingAction === "preview" ? "正在生成预览…" : "生成导入预览"}</button></div>
    ${importPreviewBody(session)}
  </div>`;
  return writerToolGridPageHtml({
    type: "import",
    contextHtml: writerToolContextPanelHtml({
      kicker: "CONTENT MIGRATION",
      title: "导入内容",
      intro: "导入分为文件识别、影响预览和写入三步；文件或模式变化后，必须重新预览，避免把旧文件结果写进当前世界。",
      facts: [
        { label: "模式", value: newWorld ? "新世界" : "追加" },
        { label: "文件", value: session.file ? "已选择" : "未选择" },
        { label: "预览", value: session.preview ? "有效" : "待生成" }
      ],
      bodyHtml: writerToolGuidanceHtml({
        title: "不可逆边界",
        text: "追加导入只新增记录，不覆盖现有对象；创建新世界成功后即使页面刷新失败，也不要重复点击导入。"
      })
    }),
    contentHtml: renderWorkspaceEditor({
        title: "内容导入工作台",
        kicker: "SELECT · PREVIEW · IMPORT",
        intro: "预览与当前文件指纹绑定，无法拿旧预览提交新文件。",
        body,
        submitLabel: session.savingAction === "import" ? "正在写入…" : "确认导入",
        submitAction: importPreviewCanCommit(session) ? "writer-import-run" : "",
        cancelAction: "writer-tool-close",
        cancelLabel: "返回创作中心",
        className: "writer-import-editor",
        status: session.error ? `<strong>操作未完成</strong><p>${escapeHtml(session.error)}</p>` : ""
    })
  });
}

export function openImportWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能导入创作内容");
  const session = beginWriterToolSession("import", data, {
    draft: {
      mode: "append",
      newWorldName: data.world.name ? `${data.world.name} · 导入副本` : "导入的世界",
      newWorldSummary: data.world.summary || "",
      roleId: data.roles?.[0]?.id || ""
    },
    file: null,
    fileRevision: 0,
    requestId: zhimuApi.createIdempotencyKey(),
    parsedJson: null,
    preview: null,
    previewFingerprint: ""
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
}

function invalidateImportPreview(session) {
  session.parsedJson = null;
  session.preview = null;
  session.previewFingerprint = "";
  session.error = "";
}

export function bindImportWorkspace(_data, session) {
  const root = document.querySelector('[data-writer-tool="import"]');
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";
  root.querySelector("[data-import-file]")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0] || null;
    const maximum = file && /\.json$/i.test(file.name) ? MAX_CONTENT_PACKAGE_FILE_BYTES : MAX_PLAIN_TEXT_FILE_BYTES;
    if (file && file.size > maximum) {
      event.target.value = "";
      session.file = null;
      invalidateImportPreview(session);
      showToast(/\.json$/i.test(file.name) ? "结构化内容包不能超过 15MB" : "单个纯文本稿件不能超过 500KB，请拆分后导入");
      render();
      return;
    }
    session.file = file;
    session.fileRevision += 1;
    invalidateImportPreview(session);
    render();
  });
  root.querySelectorAll("[data-import-field]").forEach((element) => {
    const eventName = element.tagName === "SELECT" ? "change" : "input";
    element.addEventListener(eventName, () => {
      const field = element.dataset.importField;
      session.draft[field] = element.value;
      if (field === "mode") invalidateImportPreview(session);
      if (element.tagName === "SELECT") render();
    });
  });
  if (session.savingAction) setWorkspaceSaving(root.querySelector("[data-workspace-editor]"), true);
}

export async function previewImportWorkspace() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (!session || session.type !== "import" || session.savingAction || !session.file || !canEditWorldContent(data?.world)) {
    if (session && !session.file) showToast("请选择导入文件");
    return;
  }
  session.savingAction = "preview";
  session.error = "";
  const fingerprint = importFingerprint(session);
  render();
  try {
    if (!/\.json$/i.test(session.file.name)) {
      session.parsedJson = null;
      session.preview = { plainText: true };
    } else {
      const payload = JSON.parse(await session.file.text());
      if (!writerToolSessionIsCurrent(session)) return;
      const result = session.draft.mode === "new_world"
        ? await zhimuApi.previewNewWorldContentPackage(payload)
        : await zhimuApi.previewContentPackageImport(payload);
      if (!writerToolSessionIsCurrent(session) || fingerprint !== importFingerprint(session)) return;
      session.parsedJson = payload;
      session.preview = { plainText: false, result };
    }
    session.previewFingerprint = fingerprint;
    showToast("导入预览已生成，请确认后写入");
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      invalidateImportPreview(session);
      session.error = normalizeError(error, "导入预览失败");
    }
  } finally {
    if (writerToolSessionIsCurrent(session)) {
      session.savingAction = "";
      render();
    }
  }
}

async function refreshAfterCommittedImport(session, successMessage, newWorldId = "") {
  clearWriterToolSession(session);
  if (newWorldId) zhimuApi.selectWorld(newWorldId);
  try {
    await loadCloudData(true, true);
    showToast(successMessage);
  } catch {
    showToast(`${successMessage}；页面刷新失败，请手动刷新，切勿重复导入`);
  }
}

export async function runImportWorkspace() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (
    !session
    || session.type !== "import"
    || session.savingAction
    || !importPreviewCanCommit(session)
    || !canEditWorldContent(data?.world)
  ) return;
  session.savingAction = "import";
  session.error = "";
  render();
  try {
    if (/\.json$/i.test(session.file.name)) {
      if (session.draft.mode === "new_world") {
        const result = await zhimuApi.importContentPackageAsNewWorld({
          name: session.draft.newWorldName.trim(),
          summary: session.draft.newWorldSummary.trim(),
          requestId: session.requestId,
          data: session.parsedJson?.data ?? session.parsedJson
        });
        if (!writerToolSessionIsCurrent(session)) return;
        const message = result.deduplicated
          ? "已恢复此前完成的新世界导入，没有重复创建"
          : `已创建新世界并导入 ${result.imported.roles} 个角色、${result.imported.chapters} 个章节`;
        await refreshAfterCommittedImport(session, message, result.world.id);
      } else {
        const result = await zhimuApi.importContentPackage(session.parsedJson);
        if (!writerToolSessionIsCurrent(session)) return;
        const warnings = (result.warnings || []).length;
        await refreshAfterCommittedImport(session, warnings ? `导入完成：${result.imported.roles} 角色 · ${warnings} 条提示` : `导入完成：追加 ${result.imported.roles} 角色、${result.imported.sections} 分幕`);
      }
    } else {
      const roleId = session.draft.roleId;
      if (!roleId) throw new Error("请先创建角色席位");
      const sections = (data.sections || []).filter((section) => section.role_slot_id === roleId);
      const body = await session.file.text();
      if (!writerToolSessionIsCurrent(session)) return;
      await zhimuApi.createSection(session.worldId, roleId, {
        title: session.file.name.replace(/\.(md|markdown|txt)$/i, ""),
        body,
        sequence: sections.length + 1,
        publicationStatus: "draft"
      });
      if (!writerToolSessionIsCurrent(session)) return;
      await refreshAfterCommittedImport(session, "文档内容已写入角色分幕");
    }
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.error = normalizeError(error, "内容导入失败");
      session.savingAction = "";
      render();
    }
  }
}
