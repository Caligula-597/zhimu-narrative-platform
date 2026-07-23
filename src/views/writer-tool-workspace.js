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
  snapshot: () => import("./writer-snapshot-workspace.js")
};

const renderMethods = {
  manuscript: "manuscriptWorkspaceHtml",
  impact: "impactWorkspaceHtml",
  document: "documentWorkspaceHtml",
  export: "exportWorkspaceHtml",
  import: "importWorkspaceHtml",
  snapshot: "snapshotWorkspaceHtml"
};

const bindMethods = {
  manuscript: "bindManuscriptWorkspace",
  impact: "bindImpactWorkspace",
  document: "bindDocumentWorkspace",
  export: "bindExportWorkspace",
  import: "bindImportWorkspace",
  snapshot: "bindSnapshotWorkspace"
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
  if (!session || session.savingAction) return;
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
