/**
 * One-time mechanical split of monolithic app.js into src/ modules.
 * Preserves function bodies verbatim; wraps each module in window.zhimu* IIFE.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
const lines = src.split("\n");

const fnStarts = [];
for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const line = raw.trimStart();
  if (/^(async )?function \w+/.test(line)) {
    const m = line.match(/^(?:async )?function (\w+)/);
    if (m) fnStarts.push({ name: m[1], start: i });
  } else if (/^const wizardSteps =/.test(line)) {
    fnStarts.push({ name: "wizardSteps", start: i });
  }
}
for (let i = 0; i < fnStarts.length; i++) {
  fnStarts[i].end = (fnStarts[i + 1]?.start ?? lines.length) - 1;
}

const blocks = Object.fromEntries(fnStarts.map((f) => [f.name, lines.slice(f.start, f.end + 1).join("\n")]));

const fileGroups = {
  "src/utils/format.js": [
    "formatRelativeTime", "formatTime", "formatBytes", "escapeHtml", "roleParts",
    "hostOperationLabel", "hostPlayerColor", "logActivityType", "chapterPublicationLabel", "chapterFlowClass"
  ],
  "src/components/toast.js": ["showToast", "pendingHostEventCount", "updateNotifyBadge"],
  "src/components/emptyState.js": [
    "activeRuntimeRoom", "runtimeEmpty", "cloudStatus", "stat", "flow", "activity", "readingRow",
    "task", "taskAction", "capability", "check", "voiceOption"
  ],
  "src/components/modal.js": [
    "closeModal", "openModal", "studioModal", "studioField", "studioValues", "studioSelect"
  ],
  "src/views/overview.js": ["overviewRuntimeProgress", "overview"],
  "src/views/studio.js": [
    "studioCloud", "studioNodes", "studioNode", "studioNodeList", "studioVisibleNodes", "studioFilterButton",
    "studioCompactSelection", "studioDefaultPositions", "studioNodePosition", "studioNodeRecord", "studioNodeAnchors",
    "setStudioNodePosition", "setStudioNodeAnchors", "closestStudioAnchorPair", "studioNodeName", "studioEdges",
    "studioSelection", "studioEditField", "studioEditSelect", "studioEditValues", "studioNodeEditPanel",
    "bindStudioDragging", "addStudioAnchor", "deleteStudioAnchor", "refreshStudioConnectors", "autoLayoutStudio",
    "saveSelectedStudioNode", "deleteSelectedStudioNode", "deleteStudioEdge", "openStudioChapter", "openStudioNodeMenu",
    "openStudioScene", "openStudioClue", "openStudioPoint", "openStudioConnection", "openStudioDragConnection"
  ],
  "src/views/writer.js": [
    "writer", "placeholderModule", "creatorTool", "openCreatorSection", "openCreatorRole", "openCreatorChapter",
    "runCreatorChecks", "openStoryManuscript", "storyManuscriptStatus", "openCollaboration", "openWorldLogs",
    "openDocumentParser", "fileToBase64", "openDeepseekAssistant", "deepseekProposalPreview", "openStoryAssistant",
    "storyAssistantPreview",     "openCreatorPreview", "exportCreatorPackage", "openCreatorImport", "importCreatorPackage",
  ],
  "src/views/assets.js": ["assets", "deleteCloudAsset", "openAssetUpload", "uploadSelectedAsset"],
  "src/views/rules.js": [
    "rules", "rulePayload", "openRuleEditor", "toggleCloudRule", "deleteCloudRule", "validateCloudRules"
  ],
  "src/views/director.js": [
    "director", "hostPlayerTableRows", "directorPlayers", "hostEventRows", "hostActionSummary",
    "hostClueMatrixLabel", "hostClueMatrixCard", "openHostPlayerDetail", "openHostEventContext",
    "openHostGrantClueModal", "openHostUnlockSectionModal", "openHostUnlockSceneModal", "openHostLogModal"
  ],
  "src/views/player.js": [
    "player", "voiceHub", "voiceChat", "currentCloudScene", "reader", "notebookCard", "explorationRows",
    "cloudClueRows", "sharedClueSection", "openVoiceRooms", "openCreateVoiceRoom", "openInviteVoiceRoom",
    "joinVoiceRoom", "refreshVoiceMessages", "sendVoiceMessage", "openNotebook", "completeCloudReading",
    "addCloudNote", "addCloudClueNote", "investigateCloud", "readCloudClue", "shareCloudClue", "openClueNoteModal",
    "dismissHostEvent", "executeHostEvent"
  ],
  "src/views/archive.js": [
    "archive", "checkpointPlayerSummary", "checkpointClueSummary", "openCreateCheckpointModal", "openCheckpointDetail"
  ],
  "src/views/settings.js": ["settings"],
  "src/runtime/wizard.js": [
    "wizardSteps", "openWizard", "wizardContent", "wizardForm", "automationStepContent", "automationTemplate", "collectWizardDraft",
    "choice", "currentRoles", "currentContent", "roleModeMeta", "roleStepContent", "contentModeMeta", "contentStepContent",
    "seat", "openRoleEditor", "roleEditorContent", "importRoleDocument", "saveRoleEditor", "deleteRoleEditor", "finishWizard"
  ],
  "src/runtime/auth-world.js": [
    "openAuth", "openWorldLibrary", "selectWorld", "openWorldRooms", "createParallelRoom", "selectParallelRoom",
    "openRoomInvite", "openJoinRoom"
  ],
  "src/runtime/data.js": [
    "loadCloudData", "clearRuntimeState", "applyHostPlayersPayload", "refreshPlayerHome", "refreshExploration",
    "syncDirectorPolling", "refreshDirectorPoll", "refreshHostEvents", "refreshHostPlayers", "refreshHostClueMatrix",
    "refreshHostRoom", "disconnectRoomEventStream", "scheduleRoomEventReconnect", "connectRoomEventStream",
    "handleRoomEvent", "streamUserIdForRoom", "enhanceCloudPanels"
  ],
  "src/runtime/actions.js": ["bindDynamic", "handle", "openCapabilities"]
};

const moduleHeader = (file) => {
  const isView = file.includes("/views/");
  const viewName = isView ? path.basename(file, ".js") : "";
  return `/* Auto-split from app.js — ${path.basename(file)} */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const F = window.zhimuFormat || {};
  const U = window.zhimuUi || {};
  const T = window.zhimuToast || {};
  const M = window.zhimuModal || {};
  const R = window.zhimuRuntime || {};
  const V = window.zhimuViews || {};
  const escapeHtml = F.escapeHtml || ((v="") => String(v));
  const formatTime = F.formatTime || (() => "");
  const formatBytes = F.formatBytes || (() => "");
  const formatRelativeTime = F.formatRelativeTime || (() => "");
  const roleParts = F.roleParts || (() => ({ name: "", role: "" }));
  const hostOperationLabel = F.hostOperationLabel || ((t,m) => m || t);
  const hostPlayerColor = F.hostPlayerColor || (() => "#666");
  const activeRuntimeRoom = U.activeRuntimeRoom || (() => null);
  const cloudStatus = U.cloudStatus || (() => "");
  const runtimeEmpty = U.runtimeEmpty || (() => "");
  const stat = U.stat || (() => "");
  const flow = U.flow || (() => "");
  const activity = U.activity || (() => "");
  const readingRow = U.readingRow || (() => "");
  const task = U.task || (() => "");
  const taskAction = U.taskAction || (() => "");
  const capability = U.capability || (() => "");
  const check = U.check || (() => "");
  const voiceOption = U.voiceOption || (() => "");
  const showToast = T.showToast || (() => {});
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
  const go = R.go || (() => {});
  const render = R.render || (() => {});
  const loadCloudData = R.loadCloudData || (async () => {});
  const bindDynamic = R.bindDynamic || (() => {});
  const handle = R.handle || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  const openRuleEditor = V.rules?.openRuleEditor || (() => {});
  const hostClueMatrixCard = V.director?.hostClueMatrixCard || (() => "");
  const hostEventRows = V.director?.hostEventRows || (() => "");
  const hostPlayerTableRows = V.director?.hostPlayerTableRows || (() => {});
  const explorationRows = V.player?.explorationRows || (() => "");
  const cloudClueRows = V.player?.cloudClueRows || (() => "");
  const sharedClueSection = V.player?.sharedClueSection || (() => "");
  const reader = V.player?.reader || (() => "");
  const notebookCard = V.player?.notebookCard || (() => "");
  const voiceHub = V.player?.voiceHub || (() => "");
  const studioNodeName = V.studio?.studioNodeName || (() => "");
  const studioNodeList = V.studio?.studioNodeList || (() => []);
  const studioNodeRecord = V.studio?.studioNodeRecord || (() => null);
  const studioNodeAnchors = V.studio?.studioNodeAnchors || (() => []);
  const studioNodePosition = V.studio?.studioNodePosition || (() => ({ x: 0, y: 0 }));
  const studioEditField = V.studio?.studioEditField || (() => "");
  const studioEditSelect = V.studio?.studioEditSelect || (() => "");
  const studioEditValues = V.studio?.studioEditValues || (() => ({}));
  const overviewRuntimeProgress = V.overview?.overviewRuntimeProgress || (() => ({ percent: 0, label: "" }));
  const logActivityType = F.logActivityType || (() => "ok");
  const chapterPublicationLabel = F.chapterPublicationLabel || ((s) => s);
  const chapterFlowClass = F.chapterFlowClass || (() => "");
  window.zhimuViews = window.zhimuViews || {};
  ${isView ? `const viewExports = window.zhimuViews.${viewName} = window.zhimuViews.${viewName} || {};\n` : ""}`;
};

const moduleFooter = (file, fnNames) => {
  const isView = file.includes("/views/");
  const viewName = isView ? path.basename(file, ".js") : "";
  const base = path.basename(file, ".js");
  let exports = "";
  if (file.includes("utils/format.js")) {
    exports = `window.zhimuFormat = { formatRelativeTime, formatTime, formatBytes, escapeHtml, roleParts, hostOperationLabel, hostPlayerColor, logActivityType, chapterPublicationLabel, chapterFlowClass };`;
  } else if (file.includes("components/toast.js")) {
    exports = `window.zhimuToast = { showToast, pendingHostEventCount, updateNotifyBadge };`;
  } else if (file.includes("components/emptyState.js")) {
    exports = `window.zhimuUi = { activeRuntimeRoom, runtimeEmpty, cloudStatus, stat, flow, activity, readingRow, task, taskAction, capability, check, voiceOption };`;
  } else if (file.includes("components/modal.js")) {
    exports = `window.zhimuModal = { closeModal, openModal, studioModal, studioField, studioValues, studioSelect };`;
  } else if (isView) {
    const main = viewName === "studio" ? "studioCloud" : viewName;
    const extra = fnNames.filter((n) => n !== main && !n.startsWith("open") && n !== main);
    exports = fnNames.map((n) => `viewExports.${n} = ${n};`).join("\n  ");
  } else if (file.includes("runtime/data.js")) {
    exports = `window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, { loadCloudData, clearRuntimeState, go: window.zhimuRuntime?.go, render: window.zhimuRuntime?.render, applyHostPlayersPayload, refreshPlayerHome, refreshExploration, syncDirectorPolling, refreshDirectorPoll, refreshHostEvents, refreshHostPlayers, refreshHostClueMatrix, refreshHostRoom, disconnectRoomEventStream, scheduleRoomEventReconnect, connectRoomEventStream, handleRoomEvent, streamUserIdForRoom, enhanceCloudPanels });`;
  } else if (file.includes("runtime/actions.js")) {
    exports = `window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, { bindDynamic, handle, openCapabilities });`;
  } else if (file.includes("runtime/wizard.js")) {
    exports = `window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, { openWizard, finishWizard });`;
  } else if (file.includes("runtime/auth-world.js")) {
    exports = `window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, { openAuth, openWorldLibrary, selectWorld, openWorldRooms, createParallelRoom, selectParallelRoom, openRoomInvite, openJoinRoom });`;
  }
  return `\n  ${exports}\n})(window);\n`;
};

const assigned = new Set();
for (const [file, names] of Object.entries(fileGroups)) {
  const uniq = [...new Set(names)];
  const body = uniq.map((n) => {
    if (!blocks[n]) throw new Error(`Missing function ${n} for ${file}`);
    assigned.add(n);
    return blocks[n];
  }).join("\n\n");
  const outPath = path.join(root, file);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, moduleHeader(file) + body + moduleFooter(file, uniq));
}

const unassigned = fnStarts.map((f) => f.name).filter((n) => !assigned.has(n));
if (unassigned.length) {
  console.warn("Unassigned functions (add to fileGroups):", unassigned.join(", "));
}

// Copy state + api
fs.mkdirSync(path.join(root, "src/api"), { recursive: true });
if (fs.existsSync(path.join(root, "state.js"))) {
  fs.copyFileSync(path.join(root, "state.js"), path.join(root, "src/state.js"));
}
// API client: src/api/client.js (single source of truth)

console.log("Split complete. Unassigned:", unassigned.length);
