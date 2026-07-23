import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import {
  clearWriterToolSession,
  getWriterToolSession
} from "./writer-tool-session.js";

const loadedModules = new Map();
const loadingModules = new Map();
const pendingOpenCalls = new Map();

const moduleLoaders = {
  manuscript: () => import("./writer-manuscript-workspace.js"),
  impact: () => import("./writer-impact-workspace.js"),
  document: () => import("./writer-document-workspace.js"),
  export: () => import("./writer-package-workspace.js"),
  import: () => import("./writer-package-workspace.js"),
  snapshot: () => import("./writer-snapshot-workspace.js"),
  review: () => import("./writer-review-workspace.js"),
  collaboration: () => import("./writer-collaboration-workspace.js"),
  preview: () => import("./writer-player-preview-workspace.js")
};

const renderMethods = {
  manuscript: "manuscriptWorkspaceHtml",
  impact: "impactWorkspaceHtml",
  document: "documentWorkspaceHtml",
  export: "exportWorkspaceHtml",
  import: "importWorkspaceHtml",
  snapshot: "snapshotWorkspaceHtml",
  review: "reviewWorkspaceHtml",
  collaboration: "collaborationWorkspaceHtml",
  preview: "playerPreviewWorkspaceHtml"
};

const bindMethods = {
  manuscript: "bindManuscriptWorkspace",
  impact: "bindImpactWorkspace",
  document: "bindDocumentWorkspace",
  export: "bindExportWorkspace",
  import: "bindImportWorkspace",
  snapshot: "bindSnapshotWorkspace",
  review: "bindReviewWorkspace",
  collaboration: "bindCollaborationWorkspace",
  preview: "bindPlayerPreviewWorkspace"
};

async function loadToolModule(type) {
  if (loadedModules.has(type)) return loadedModules.get(type);
  if (!loadingModules.has(type)) {
    const loader = moduleLoaders[type];
    if (!loader) throw new Error(`Unknown writer tool: ${type}`);
    loadingModules.set(type, loader().then((module) => {
      loadedModules.set(type, module);
      return module;
    }).finally(() => loadingModules.delete(type)));
  }
  return loadingModules.get(type);
}

async function invokeTool(type, method, ...args) {
  const invocationKey = method.startsWith("open") ? `${type}:${method}` : "";
  if (invocationKey && pendingOpenCalls.has(invocationKey)) return pendingOpenCalls.get(invocationKey);
  const invoke = async () => {
    try {
      const module = await loadToolModule(type);
      return await module[method]?.(...args);
    } catch {
      showToast("创作工具加载失败，请刷新页面后重试");
      return undefined;
    }
  };
  const promise = invoke();
  if (!invocationKey) return promise;
  pendingOpenCalls.set(invocationKey, promise);
  return promise.finally(() => pendingOpenCalls.delete(invocationKey));
}

export function writerToolWorkspaceHtml(data = studioStore.get().cloudStudio) {
  const session = getWriterToolSession(data);
  if (!session) return "";
  const module = loadedModules.get(session.type);
  const method = renderMethods[session.type];
  return module?.[method]?.(data, session) || "";
}

export function bindWriterToolWorkspace() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (!session) return;
  const module = loadedModules.get(session.type);
  const method = bindMethods[session.type];
  module?.[method]?.(data, session);
}

export function closeWriterToolWorkspace() {
  const session = getWriterToolSession(studioStore.get().cloudStudio);
  if (!session) return;
  if (session.savingAction || session.pendingActions?.size) {
    showToast("当前写入尚未完成，请等待结果后再离开");
    return;
  }
  if (session.dirty && !session.discardArmed) {
    session.discardArmed = true;
    render();
    showToast("当前草稿尚未保存，再次点击返回将放弃这些修改");
    return;
  }
  clearWriterToolSession(session);
  render();
}

export const openManuscriptWorkspace = (...args) => invokeTool("manuscript", "openManuscriptWorkspace", ...args);
export const saveManuscriptWorkspace = (...args) => invokeTool("manuscript", "saveManuscriptWorkspace", ...args);
export const syncManuscriptFromGraphWorkspace = (...args) => invokeTool("manuscript", "syncManuscriptFromGraphWorkspace", ...args);
export const syncManuscriptToGraphWorkspace = (...args) => invokeTool("manuscript", "syncManuscriptToGraphWorkspace", ...args);

export const openImpactWorkspace = (...args) => invokeTool("impact", "openImpactWorkspace", ...args);
export const openPlayerPreviewWorkspace = (...args) => invokeTool("preview", "openPlayerPreviewWorkspace", ...args);

export const openDocumentWorkspace = (...args) => invokeTool("document", "openDocumentWorkspace", ...args);
export const parseDocumentWorkspace = (...args) => invokeTool("document", "parseDocumentWorkspace", ...args);
export const importDocumentWorkspace = (...args) => invokeTool("document", "importDocumentWorkspace", ...args);

export const openExportWorkspace = (...args) => invokeTool("export", "openExportWorkspace", ...args);
export const nextExportWorkspaceStep = (...args) => invokeTool("export", "nextExportWorkspaceStep", ...args);
export const previousExportWorkspaceStep = (...args) => invokeTool("export", "previousExportWorkspaceStep", ...args);
export const runExportWorkspace = (...args) => invokeTool("export", "runExportWorkspace", ...args);

export const openImportWorkspace = (...args) => invokeTool("import", "openImportWorkspace", ...args);
export const previewImportWorkspace = (...args) => invokeTool("import", "previewImportWorkspace", ...args);
export const runImportWorkspace = (...args) => invokeTool("import", "runImportWorkspace", ...args);

export const openSnapshotWorkspace = (...args) => invokeTool("snapshot", "openSnapshotWorkspace", ...args);
export const saveSnapshotWorkspace = (...args) => invokeTool("snapshot", "saveSnapshotWorkspace", ...args);

export const openReviewWorkspace = (...args) => invokeTool("review", "openReviewWorkspace", ...args);
export const setReviewWorkspaceMode = (...args) => invokeTool("review", "setReviewWorkspaceMode", ...args);
export const setReviewFilter = (...args) => invokeTool("review", "setReviewFilter", ...args);
export const refreshReviewList = (...args) => invokeTool("review", "refreshReviewList", ...args);
export const createReviewFromWorkspace = (...args) => invokeTool("review", "createReviewFromWorkspace", ...args);
export const replyReviewFromWorkspace = (...args) => invokeTool("review", "replyReviewFromWorkspace", ...args);
export const updateReviewStatusFromWorkspace = (...args) => invokeTool("review", "updateReviewStatusFromWorkspace", ...args);
export const compareReviewVersions = (...args) => invokeTool("review", "compareReviewVersions", ...args);

export const openCollaborationWorkspace = (...args) => invokeTool("collaboration", "openCollaborationWorkspace", ...args);
export const refreshCollaborationWorkspace = (...args) => invokeTool("collaboration", "refreshCollaborationWorkspace", ...args);
export const inviteCollaboratorFromWorkspace = (...args) => invokeTool("collaboration", "inviteCollaboratorFromWorkspace", ...args);
export const saveCollaboratorRoleFromWorkspace = (...args) => invokeTool("collaboration", "saveCollaboratorRoleFromWorkspace", ...args);
export const removeCollaboratorFromWorkspace = (...args) => invokeTool("collaboration", "removeCollaboratorFromWorkspace", ...args);
export const resendCollaboratorInviteFromWorkspace = (...args) => invokeTool("collaboration", "resendCollaboratorInviteFromWorkspace", ...args);
export const revokeCollaboratorInviteFromWorkspace = (...args) => invokeTool("collaboration", "revokeCollaboratorInviteFromWorkspace", ...args);
export const copyCollaborationInviteLink = (...args) => invokeTool("collaboration", "copyCollaborationInviteLink", ...args);
export const dismissCollaborationInviteLink = (...args) => invokeTool("collaboration", "dismissCollaborationInviteLink", ...args);
