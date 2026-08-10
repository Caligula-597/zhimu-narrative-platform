/* Global data-action dispatcher — domain handlers live in actions-*.js */
import { uiStore } from "../state/index.js";
import { callRuntime, registerRuntime } from "./runtime-facade.js";
import { callView } from "./view-registry.js";
import { dispatchActionHandlers } from "../../shared/action-dispatch.js";
import { handleShellAction } from "./actions-shell.js";

const enhanceCloudPanels = () => callRuntime("enhanceCloudPanels");

const dispatchers = [
  () => window.zhimuActionsCreativeConstitution?.handleCreativeConstitutionAction,
  () => window.zhimuActionsStoryDiagnostics?.handleStoryDiagnosticsAction,
  () => window.zhimuActionsAiPlaytest?.handleAiPlaytestAction,
  () => window.zhimuActionsCreatorCockpit?.handleCreatorCockpitAction,
  () => window.zhimuActionsBible?.handleBibleAction,
  () => window.zhimuActionsWorkspace?.handleWorkspaceAction,
  () => window.zhimuActionsCreatorWorkspaces?.handleCreatorWorkspacesAction,
  () => window.zhimuActionsArchive?.handleArchiveAction,
  () => window.zhimuActionsPlayer?.handlePlayerAction,
  () => window.zhimuActionsStudio?.handleStudioAction,
  () => window.zhimuActionsWriter?.handleWriterAction,
  () => window.zhimuActionsRules?.handleRulesAction,
  () => window.zhimuActionsMiniGames?.handleMiniGamesAction,
  () => window.zhimuActionsTabletopMap?.handleTabletopMapAction,
  () => window.zhimuActionsAssets?.handleAssetsAction,
  () => window.zhimuActionsOps?.handleOpsAction,
  () => window.zhimuActionsClues?.handleCluesAction
];

export function bindDynamic() {
  enhanceCloudPanels();
  const view = uiStore.get().view;
  if (view === "studio") {
    callView("studio", "bindStudioDragging");
    callView("studio", "bindStudioCreateEditor");
  }
  if (view === "clues") {
    callView("clues", "bindCluesSearch");
    callView("clues", "bindClueEditor");
  }
  if (view === "miniGames") callView("miniGames", "bindMiniGameEditor");
  if (view === "tabletopMap") callView("tabletopMap", "bindTabletopMapEditor");
  if (view === "rules") callView("rules", "bindRuleEditor");
  if (view === "rooms") callView("rooms", "bindRoomWorkspace");
  if (view === "account") callView("accountHub", "bindAccountHubView");
  if (view === "player") callView("player", "bindPlayerReader");
  if (view === "structure") callView("creatorWorkspaces", "bindSegmentRefTypeSelect");
  if (view === "constitution") callView("creativeConstitution", "bindCreativeConstitutionForm");
  if (view === "playtest") callView("aiPlaytestLab", "bindAiPlaytestForm");
  if (view === "writer") {
    void callView("writer", "loadWriterRoleArchives");
    callView("writer", "bindWriterSectionEditor");
    callView("writer", "bindWriterMetadataEditor");
    callView("writer", "bindWriterToolWorkspace");
  }
  window.zhimuActionsCreatorCockpit?.maybeAutoLoadCockpit?.(view);
  window.zhimuActionsStoryDiagnostics?.maybeAutoLoadDiagnostics?.(view);
  window.zhimuActionsAiPlaytest?.maybeAutoLoadAiPlaytest?.(view);
  window.zhimuActionsCreatorWorkspaces?.maybeAutoLoadWorkspace?.(view);
  window.zhimuSearchFocus?.applyAfterRender?.();
}

export async function handle(action, el) {
  const handled = await dispatchActionHandlers(dispatchers.map((getFn) => getFn()), action, el);
  if (handled) return;
  if (action === "import") return handle("creator-import", el);
  return handleShellAction(action, el);
}

registerRuntime({ bindDynamic, handle });
