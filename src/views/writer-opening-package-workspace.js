import * as zhimuApi from "../api/index.js";
import { canEditWorldContent } from "../components/emptyState.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import { setWorkspaceSaving } from "../components/workspace-editor.js";
import { go, loadCloudData, render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import { fileToBase64 } from "./writer-transfer-files.js";
import {
  beginWriterToolSession,
  clearWriterToolSession,
  getWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import { openingPackageWorkspaceHtml } from "./writer-opening-package-view.js";

export { openingPackageWorkspaceHtml } from "./writer-opening-package-view.js";

const CREATION_TYPE = "murder_mystery";

function editableOpeningPackageSession() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (!session || session.type !== "opening-package") return null;
  if (!canEditWorldContent(data?.world)) {
    showToast("当前身份不能导入创作内容");
    return null;
  }
  return session;
}

function invalidatePreview(session) {
  session.preview = null;
  session.commitArmed = false;
  session.error = "";
  session.stageSchemaDecision = "";
  session.stageSchema = null;
  session.stageSchemaEditing = false;
  session.stageSchemaDraftItems = null;
}

function buildStageSchemaPayload(session) {
  const decision = session.stageSchemaDecision;
  if (!decision) return {};
  if (decision === "reject") {
    return {
      stageSchemaDecision: "reject",
      stageSchema: {
        source: "REJECTED_AS_HEADINGS",
        label: "",
        items: []
      }
    };
  }
  const items = (session.stageSchema?.items || session.preview?.stageSchemaProposal?.items || [])
    .map((item, index) => ({
      order: Number(item.order) || index + 1,
      name: String(item.name || "").trim()
    }))
    .filter((item) => item.name);
  return {
    stageSchemaDecision: decision,
    stageSchema: {
      source: decision === "manual" ? "MANUAL" : "USER_CONFIRMED",
      label: items.map((item) => item.name).join(" / "),
      items
    }
  };
}

async function filePayload(file, roleName = "") {
  const contentBase64 = await fileToBase64(file);
  return {
    filename: file.name,
    contentBase64,
    ...(roleName ? { roleName } : {})
  };
}

async function buildCommitPayload(session) {
  if (!session.hostFile) throw new Error("请先上传主持手册");
  const payload = {
    creationType: CREATION_TYPE,
    rightsConfirmed: true,
    hostHandbook: await filePayload(session.hostFile),
    roleScripts: await Promise.all(
      (session.roleFiles || []).map((item) => filePayload(item.file, item.roleName))
    )
  };
  if (session.clueDocFile) {
    payload.clueTextDoc = await filePayload(session.clueDocFile);
  }
  if (session.clueImageFiles?.length) {
    payload.clueImages = await Promise.all(
      session.clueImageFiles.map((item) => filePayload(item.file))
    );
  }
  Object.assign(payload, buildStageSchemaPayload(session));
  return payload;
}

function stepGuards(session) {
  const step = Number(session.draft.step || 1);
  if (step === 1 && !session.draft.rightsConfirmed) {
    showToast("请先确认版权与授权");
    return false;
  }
  if (step === 2 && !session.hostFile) {
    showToast("请上传主持手册 docx");
    return false;
  }
  if (step === 3 && !session.roleFiles?.length) {
    showToast("请至少上传一份角色剧本，或返回跳过（不建议）");
    return false;
  }
  return true;
}

export function openOpeningPackageWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能导入创作内容");
  const session = beginWriterToolSession("opening-package", data, {
    draft: { step: 1, rightsConfirmed: false },
    hostFile: null,
    roleFiles: [],
    clueDocFile: null,
    clueImageFiles: [],
    preview: null,
    commitArmed: false,
    savingAction: "",
    error: "",
    stageSchemaDecision: "",
    stageSchema: null,
    stageSchemaEditing: false,
    stageSchemaDraftItems: null
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  try {
    render();
  } catch (error) {
    clearWriterToolSession(session);
    console.error("[opening-package] render failed", error);
    showToast("开本包向导打开失败，请刷新后重试");
  }
}

export function bindOpeningPackageWorkspace(data, session) {
  const root = document.querySelector('[data-writer-tool="opening-package"]');
  if (!root || root.dataset.bound || !session || !canEditWorldContent(data?.world)) return;
  root.dataset.bound = "1";

  root.querySelector("[data-opening-check=\"rightsConfirmed\"]")?.addEventListener("change", (event) => {
    session.draft.rightsConfirmed = Boolean(event.target.checked);
    invalidatePreview(session);
    render();
  });

  root.querySelector("[data-opening-host-file]")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    session.hostFile = file || null;
    invalidatePreview(session);
    render();
  });

  root.querySelector("[data-opening-role-files]")?.addEventListener("change", (event) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    session.roleFiles = [...(session.roleFiles || []), ...files.map((file) => ({ file }))];
    invalidatePreview(session);
    render();
  });

  root.querySelector("[data-opening-clue-doc-file]")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    session.clueDocFile = file || null;
    invalidatePreview(session);
    render();
  });

  root.querySelector("[data-opening-clue-image-files]")?.addEventListener("change", (event) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    session.clueImageFiles = [...(session.clueImageFiles || []), ...files.map((file) => ({ file }))];
    invalidatePreview(session);
    render();
  });

  if (session.savingAction) setWorkspaceSaving(root.querySelector("[data-workspace-editor]"), true);
}

export function nextOpeningPackageStep() {
  const session = editableOpeningPackageSession();
  if (!session || session.savingAction) return;
  if (!stepGuards(session)) return;
  session.draft.step = Math.min(6, Number(session.draft.step || 1) + 1);
  invalidatePreview(session);
  render();
}

export function backOpeningPackageStep() {
  const session = editableOpeningPackageSession();
  if (!session || session.savingAction) return;
  session.draft.step = Math.max(1, Number(session.draft.step || 1) - 1);
  invalidatePreview(session);
  render();
}

export function skipOpeningPackageStep() {
  const session = editableOpeningPackageSession();
  if (!session || session.savingAction) return;
  const step = Number(session.draft.step || 1);
  if (step === 4) session.clueDocFile = null;
  if (step === 5) session.clueImageFiles = [];
  session.draft.step = Math.min(6, step + 1);
  invalidatePreview(session);
  render();
}

export async function previewOpeningPackageWorkspace() {
  const session = editableOpeningPackageSession();
  if (!session || session.savingAction) return;
  if (!session.draft.rightsConfirmed) return showToast("请先确认版权与授权");
  if (!session.hostFile) return showToast("请先上传主持手册");
  session.savingAction = "preview";
  session.error = "";
  render();
  try {
    const payload = await buildCommitPayload(session);
    const preview = await zhimuApi.previewOpeningPackage(payload);
    if (!writerToolSessionIsCurrent(session)) return;
    session.preview = preview;
    session.commitArmed = false;
    session.stageSchemaDecision = "";
    session.stageSchema = null;
    session.stageSchemaEditing = false;
    session.stageSchemaDraftItems = preview?.stageSchemaProposal?.items
      ? preview.stageSchemaProposal.items.map((item) => ({ ...item }))
      : null;
    showToast(
      preview?.stageSchemaProposal
        ? "预览已生成；请确认是否设为统一游戏阶段"
        : "预览已生成，请核对后写入"
    );
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.error = normalizeError(error, "预览生成失败");
    }
  } finally {
    if (writerToolSessionIsCurrent(session)) {
      session.savingAction = "";
      render();
    }
  }
}

export async function commitOpeningPackageWorkspace() {
  const session = editableOpeningPackageSession();
  if (!session || session.savingAction || !session.preview) return;
  if (session.preview.stageSchemaProposal?.items?.length && !session.stageSchemaDecision) {
    showToast("检测到统一阶段建议，请先选择「是 / 不是 / 手动编辑」");
    return;
  }
  if (!session.commitArmed) {
    session.commitArmed = true;
    render();
    showToast("写入会追加角色分幕、线索与主持手册；请再次点击确认");
    return;
  }
  session.savingAction = "commit";
  session.error = "";
  render();
  try {
    const payload = await buildCommitPayload(session);
    const result = await zhimuApi.commitOpeningPackage(payload);
    if (!writerToolSessionIsCurrent(session)) return;
    clearWriterToolSession(session);
    await loadCloudData(true, true);
    go("importSource");
    const created = result?.created || {};
    showToast(
      `开本包已写入 · 角色 ${created.roleSections || 0} 段 · 线索文字 ${created.cluesText || 0} · 线索图 ${created.cluesImage || 0}`
    );
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.error = normalizeError(error, "开本包写入失败");
      session.commitArmed = false;
      session.savingAction = "";
      render();
    }
  }
}

export function confirmOpeningPackageStageSchema() {
  const session = editableOpeningPackageSession();
  if (!session?.preview?.stageSchemaProposal) return;
  const items = (session.preview.stageSchemaProposal.items || []).map((item, index) => ({
    order: Number(item.order) || index + 1,
    name: String(item.name || "").trim()
  }));
  session.stageSchemaDecision = "confirm";
  session.stageSchemaEditing = false;
  session.stageSchema = {
    source: "USER_CONFIRMED",
    label: items.map((item) => item.name).join(" / "),
    items
  };
  session.commitArmed = false;
  showToast("已设为统一游戏阶段");
  render();
}

export function rejectOpeningPackageStageSchema() {
  const session = editableOpeningPackageSession();
  if (!session?.preview?.stageSchemaProposal) return;
  session.stageSchemaDecision = "reject";
  session.stageSchemaEditing = false;
  session.stageSchema = {
    source: "REJECTED_AS_HEADINGS",
    label: "",
    items: []
  };
  session.commitArmed = false;
  showToast("已按章节标题处理，不设统一阶段");
  render();
}

export function editOpeningPackageStageSchema() {
  const session = editableOpeningPackageSession();
  if (!session?.preview?.stageSchemaProposal) return;
  session.stageSchemaEditing = true;
  session.stageSchemaDecision = "manual";
  session.stageSchemaDraftItems = (
    session.stageSchema?.items ||
    session.preview.stageSchemaProposal.items ||
    []
  ).map((item, index) => ({
    order: Number(item.order) || index + 1,
    name: String(item.name || "").trim()
  }));
  session.commitArmed = false;
  render();
}

export function saveOpeningPackageStageSchemaManual() {
  const session = editableOpeningPackageSession();
  if (!session) return;
  const root = document.querySelector('[data-writer-tool="opening-package"]');
  const inputs = [...(root?.querySelectorAll("[data-opening-stage-edit]") || [])];
  const items = inputs
    .map((input, index) => ({
      order: index + 1,
      name: String(input.value || "").trim()
    }))
    .filter((item) => item.name);
  if (!items.length) {
    showToast("请至少填写一个阶段名称");
    return;
  }
  session.stageSchemaDecision = "manual";
  session.stageSchemaEditing = false;
  session.stageSchemaDraftItems = items;
  session.stageSchema = {
    source: "MANUAL",
    label: items.map((item) => item.name).join(" / "),
    items
  };
  session.commitArmed = false;
  showToast("已保存手动阶段");
  render();
}

export function cancelOpeningPackageStageSchemaManual() {
  const session = editableOpeningPackageSession();
  if (!session) return;
  session.stageSchemaEditing = false;
  if (!session.stageSchema?.items?.length) {
    session.stageSchemaDecision = "";
    session.stageSchema = null;
  }
  render();
}
