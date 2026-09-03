import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import * as storyAssistantWorkspace from "./writer-story-assistant-workspace.js";
import * as openingPackageWorkspace from "./writer-opening-package-workspace.js";
import {
  clearWriterToolSession,
  getWriterToolSession
} from "./writer-tool-session.js";

const loadedModules = new Map([
  ["story-assistant", storyAssistantWorkspace],
  ["opening-package", openingPackageWorkspace]
]);
const loadingModules = new Map();
const pendingOpenCalls = new Map();

const moduleLoaders = {
  timeline: () => import("./timeline-editor.js"),
  manuscript: () => import("./writer-manuscript-workspace.js"),
  impact: () => import("./writer-impact-workspace.js"),
  document: () => import("./writer-document-workspace.js"),
  export: () => import("./writer-package-workspace.js"),
  import: () => import("./writer-package-workspace.js"),
  snapshot: () => import("./writer-snapshot-workspace.js"),
  review: () => import("./writer-review-workspace.js"),
  collaboration: () => import("./writer-collaboration-workspace.js"),
  logs: () => import("./writer-world-logs-workspace.js"),
  "story-assistant": () => Promise.resolve(storyAssistantWorkspace),
  "opening-package": () => Promise.resolve(openingPackageWorkspace),
  "world-engine": () => import("./world-engine-workspace.js"),
  misidentification: () => import("./misidentification-editor.js"),
  "relationship-arc": () => import("./relationship-arc-editor.js"),
  "knowledge-matrix": () => import("./knowledge-matrix-editor.js"),
  "ending-branch": () => import("./ending-branch-editor.js"),
  "host-manual-compiler": () => import("./host-manual-compiler-editor.js"),
  "object-lifecycle": () => import("./object-lifecycle-editor.js"),
  "history-causal": () => import("./history-causal-editor.js"),
  "runtime-machine": () => import("./runtime-state-machine-editor.js"),
  "val-consistency": () => import("./val-consistency-editor.js"),
  "econ-system": () => import("./econ-editor.js"),
  "npc-script": () => import("./npc-script-editor.js"),
  "location-state": () => import("./location-state-editor.js")
};

const renderMethods = {
  timeline: "timelineEditorWorkspaceHtml",
  manuscript: "manuscriptWorkspaceHtml",
  impact: "impactWorkspaceHtml",
  document: "documentWorkspaceHtml",
  export: "exportWorkspaceHtml",
  import: "importWorkspaceHtml",
  snapshot: "snapshotWorkspaceHtml",
  review: "reviewWorkspaceHtml",
  collaboration: "collaborationWorkspaceHtml",
  logs: "worldLogsWorkspaceHtml",
  "story-assistant": "storyAssistantWorkspaceHtml",
  "opening-package": "openingPackageWorkspaceHtml",
  "world-engine": "worldEngineWorkspaceHtml",
  misidentification: "misidentificationWorkspaceHtml",
  "relationship-arc": "relationshipArcWorkspaceHtml",
  "knowledge-matrix": "knowledgeMatrixWorkspaceHtml",
  "ending-branch": "endingWorkspaceHtml",
  "host-manual-compiler": "hostManualCompilerWorkspaceHtml",
  "object-lifecycle": "objectLifecycleWorkspaceHtml",
  "history-causal": "historyCausalWorkspaceHtml",
  "runtime-machine": "runtimeStateMachineWorkspaceHtml",
  "val-consistency": "valConsistencyWorkspaceHtml",
  "econ-system": "econSystemWorkspaceHtml",
  "npc-script": "npcScriptWorkspaceHtml",
  "location-state": "locationStateWorkspaceHtml"
};

const bindMethods = {
  timeline: "bindTimeline",
  manuscript: "bindManuscriptWorkspace",
  impact: "bindImpactWorkspace",
  document: "bindDocumentWorkspace",
  export: "bindExportWorkspace",
  import: "bindImportWorkspace",
  snapshot: "bindSnapshotWorkspace",
  review: "bindReviewWorkspace",
  collaboration: "bindCollaborationWorkspace",
  logs: "bindWorldLogsWorkspace",
  "story-assistant": "bindStoryAssistantWorkspace",
  "opening-package": "bindOpeningPackageWorkspace",
  "world-engine": "bindWorldEngineWorkspace",
  misidentification: "bindMisidentification",
  "relationship-arc": "bindRelationshipArc",
  "knowledge-matrix": "bindKnowledgeMatrix",
  "ending-branch": "bindEnding",
  "host-manual-compiler": "bindHostManualCompiler",
  "object-lifecycle": "bindObjectLifecycle",
  "history-causal": "bindHistoryCausal",
  "val-consistency": "bindValConsistency",
  "econ-system": "bindEconSystem",
  "npc-script": "bindNpcScript",
  "location-state": "bindLocationState"
};

async function loadToolModule(type) {
  if (loadedModules.has(type)) return loadedModules.get(type);
  if (!loadingModules.has(type)) {
    const loader = moduleLoaders[type];
    if (!loader) throw new Error(`Unknown writer tool: ${type}`);
    loadingModules.set(type, loader().then((module) => {
      loadedModules.set(type, module);
      return module;
    }).catch((error) => {
      console.error(`[writer-tool] failed to load module "${type}"`, error);
      throw error;
    }).finally(() => loadingModules.delete(type)));
  }
  return loadingModules.get(type);
}

/** Prefetch common writer tools so first open does not fail on slow/chunk-miss networks. */
export function warmWriterToolModules(types = ["story-assistant", "opening-package", "document", "world-engine"]) {
  for (const type of types) {
    if (loadedModules.has(type) || loadingModules.has(type)) continue;
    void loadToolModule(type).catch(() => {});
  }
}

async function invokeTool(type, method, ...args) {
  const invocationKey = method.startsWith("open") ? `${type}:${method}` : "";
  if (invocationKey && pendingOpenCalls.has(invocationKey)) return pendingOpenCalls.get(invocationKey);
  const invoke = async () => {
    try {
      const module = await loadToolModule(type);
      return await module[method]?.(...args);
    } catch (error) {
      console.error(`[writer-tool] ${type}.${method} failed`, error);
      const hint = type === "story-assistant"
        ? "结构提取模块加载失败。若你要上传 Word，请用「上传 Word 剧本」或工具箱「文档解析」。"
        : type === "document"
          ? "文档导入模块加载失败，请强制刷新页面（Ctrl+Shift+R）后重试。"
          : "创作工具加载失败，请强制刷新页面后重试。";
      showToast(hint);
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
export const openWorldLogsWorkspace = (...args) => invokeTool("logs", "openWorldLogsWorkspace", ...args);
export const setWorldLogFilter = (...args) => invokeTool("logs", "setWorldLogFilter", ...args);
export const applyWorldLogFilters = (...args) => invokeTool("logs", "applyWorldLogFilters", ...args);
export const clearWorldLogFilters = (...args) => invokeTool("logs", "clearWorldLogFilters", ...args);
export const refreshWorldLogs = (...args) => invokeTool("logs", "refreshWorldLogs", ...args);
export const loadMoreWorldLogs = (...args) => invokeTool("logs", "loadMoreWorldLogs", ...args);
async function invokeStoryAssistant(method, ...args) {
  const fn = storyAssistantWorkspace[method];
  if (typeof fn !== "function") {
    console.error(`[writer-tool] story-assistant.${method} is missing on module namespace`);
    showToast("结构提取模块未就绪，请强制刷新页面（Ctrl+Shift+R）后重试");
    return undefined;
  }
  try {
    return await fn(...args);
  } catch (error) {
    console.error(`[writer-tool] story-assistant.${method} failed`, error);
    const detail = String(error?.message || error).slice(0, 120);
    showToast(detail ? `结构提取失败：${detail}` : "结构提取失败，请强制刷新页面后重试");
    return undefined;
  }
}

export const openStoryAssistantWorkspace = (...args) => invokeStoryAssistant("openStoryAssistantWorkspace", ...args);
export const analyzeStoryAssistantWorkspace = (...args) => invokeStoryAssistant("analyzeStoryAssistantWorkspace", ...args);
export const importStoryAssistantWorkspace = (...args) => invokeStoryAssistant("importStoryAssistantWorkspace", ...args);

export const openWorldEngineWorkspace = (...args) => invokeTool("world-engine", "openWorldEngineWorkspace", ...args);
export const seedWorldEngineWorkspace = (...args) => invokeTool("world-engine", "seedWorldEngineWorkspace", ...args);
export const renderWorldEngineWorkspace = (...args) => invokeTool("world-engine", "renderWorldEngineWorkspace", ...args);

export const openMisidentificationWorkspace = (...args) => invokeTool("misidentification", "openMisidentification", ...args);
export const closeMisidentificationWorkspace = (...args) => invokeTool("misidentification", "closeMisidentification", ...args);
export const openRelationshipArcWorkspace = (...args) => invokeTool("relationship-arc", "openRelationshipArc", ...args);
export const closeRelationshipArcWorkspace = (...args) => invokeTool("relationship-arc", "closeRelationshipArc", ...args);
export const openKnowledgeMatrixWorkspace = (...args) => invokeTool("knowledge-matrix", "openKnowledgeMatrix", ...args);
export const closeKnowledgeMatrixWorkspace = (...args) => invokeTool("knowledge-matrix", "closeKnowledgeMatrix", ...args);
export const openEndingWorkspace = (...args) => invokeTool("ending-branch", "openEnding", ...args);
export const closeEndingWorkspace = (...args) => invokeTool("ending-branch", "closeEnding", ...args);
export const openHostManualCompilerWorkspace = (...args) => invokeTool("host-manual-compiler", "openHostManualCompiler", ...args);
export const closeHostManualCompilerWorkspace = (...args) => invokeTool("host-manual-compiler", "closeHostManualCompiler", ...args);
export const openObjectLifecycleWorkspace = (...args) => invokeTool("object-lifecycle", "openObjectLifecycle", ...args);
export const closeObjectLifecycleWorkspace = (...args) => invokeTool("object-lifecycle", "closeObjectLifecycle", ...args);
export const openTimelineWorkspace = (...args) => invokeTool("timeline", "openTimeline", ...args);
export const closeTimelineWorkspace = (...args) => invokeTool("timeline", "closeTimeline", ...args);
export const openHistoryCausalWorkspace = (...args) => invokeTool("history-causal", "openHistoryCausal", ...args);
export const closeHistoryCausalWorkspace = (...args) => invokeTool("history-causal", "closeHistoryCausal", ...args);
export const openRuntimeStateMachineWorkspace = (...args) => invokeTool("runtime-machine", "openRuntimeStateMachine", ...args);
export const closeRuntimeStateMachineWorkspace = (...args) => invokeTool("runtime-machine", "closeRuntimeStateMachine", ...args);
export const openValConsistencyWorkspace = (...args) => invokeTool("val-consistency", "openValConsistency", ...args);
export const closeValConsistencyWorkspace = (...args) => invokeTool("val-consistency", "closeValConsistency", ...args);
export const openEconSystemWorkspace = (...args) => invokeTool("econ-system", "openEconSystem", ...args);
export const closeEconSystemWorkspace = (...args) => invokeTool("econ-system", "closeEconSystem", ...args);
export const openNpcScriptWorkspace = (...args) => invokeTool("npc-script", "openNpcScript", ...args);
export const closeNpcScriptWorkspace = (...args) => invokeTool("npc-script", "closeNpcScript", ...args);
export const openLocationStateWorkspace = (...args) => invokeTool("location-state", "openLocationState", ...args);
export const closeLocationStateWorkspace = (...args) => invokeTool("location-state", "closeLocationState", ...args);
export const searchWorldEngineWorkspace = (...args) => invokeTool("world-engine", "searchWorldEngineWorkspace", ...args);
export const commitWorldEngineWorkspace = (...args) => invokeTool("world-engine", "commitWorldEngineWorkspace", ...args);
export const lowerWorldEngineWorkspace = (...args) => invokeTool("world-engine", "lowerWorldEngineWorkspace", ...args);
export const searchWorldEngineEpistemicWorkspace = (...args) => invokeTool("world-engine", "searchWorldEngineEpistemicWorkspace", ...args);

export const openOpeningPackageWorkspace = (...args) => invokeTool("opening-package", "openOpeningPackageWorkspace", ...args);
export const nextOpeningPackageStep = (...args) => invokeTool("opening-package", "nextOpeningPackageStep", ...args);
export const backOpeningPackageStep = (...args) => invokeTool("opening-package", "backOpeningPackageStep", ...args);
export const skipOpeningPackageStep = (...args) => invokeTool("opening-package", "skipOpeningPackageStep", ...args);
export const previewOpeningPackageWorkspace = (...args) => invokeTool("opening-package", "previewOpeningPackageWorkspace", ...args);
export const commitOpeningPackageWorkspace = (...args) => invokeTool("opening-package", "commitOpeningPackageWorkspace", ...args);
export const confirmOpeningPackageStageSchema = (...args) => invokeTool("opening-package", "confirmOpeningPackageStageSchema", ...args);
export const rejectOpeningPackageStageSchema = (...args) => invokeTool("opening-package", "rejectOpeningPackageStageSchema", ...args);
export const editOpeningPackageStageSchema = (...args) => invokeTool("opening-package", "editOpeningPackageStageSchema", ...args);
export const saveOpeningPackageStageSchemaManual = (...args) => invokeTool("opening-package", "saveOpeningPackageStageSchemaManual", ...args);
export const cancelOpeningPackageStageSchemaManual = (...args) => invokeTool("opening-package", "cancelOpeningPackageStageSchemaManual", ...args);

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
