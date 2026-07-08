/* Global data-action dispatcher — domain handlers live in actions-*.js */
import { showToast } from "../components/toast.js";
import { openFeedbackForm } from "../components/feedback-button.js";
import { uiStore } from "../state/index.js";
import { callRuntime, registerRuntime } from "./runtime-facade.js";
import { callView } from "./view-registry.js";
import * as M from "../components/modal.js";
  const openModal = M.openModal || (() => {});
  const enhanceCloudPanels = () => callRuntime("enhanceCloudPanels");
  const openWizard = () => callRuntime("openWizard");

  const dispatchers = [
    () => window.zhimuActionsCreatorCockpit?.handleCreatorCockpitAction,
    () => window.zhimuActionsBible?.handleBibleAction,
    () => window.zhimuActionsWorkspace?.handleWorkspaceAction,
    () => window.zhimuActionsCreatorWorkspaces?.handleCreatorWorkspacesAction,
    () => window.zhimuActionsArchive?.handleArchiveAction,
    () => window.zhimuActionsPlayer?.handlePlayerAction,
    () => window.zhimuActionsDirector?.handleDirectorAction,
    () => window.zhimuActionsStudio?.handleStudioAction,
    () => window.zhimuActionsWriter?.handleWriterAction,
    () => window.zhimuActionsRules?.handleRulesAction,
    () => window.zhimuActionsMiniGames?.handleMiniGamesAction,
    () => window.zhimuActionsAssets?.handleAssetsAction,
    () => window.zhimuActionsOps?.handleOpsAction,
    () => window.zhimuActionsClues?.handleCluesAction
  ];

export function bindDynamic() {
    enhanceCloudPanels();
    document.querySelectorAll("[data-action]").forEach((el) => {
      if (el.type === "checkbox" || el.tagName === "SELECT") el.onchange = () => handle(el.dataset.action, el);
      else el.onclick = () => handle(el.dataset.action, el);
    });
    const view = uiStore.get().view;
    if (view === "studio") callView("studio", "bindStudioDragging");
    if (view === "clues") callView("clues", "bindCluesSearch");
    if (view === "account") callView("accountHub", "bindAccountHubView");
    if (view === "player") callView("player", "bindPlayerReader");
    if (view === "structure") callView("creatorWorkspaces", "bindSegmentRefTypeSelect");
    if (view === "writer") void callView("writer", "loadWriterRoleArchives");
    window.zhimuActionsCreatorCockpit?.maybeAutoLoadCockpit?.(view);
    window.zhimuActionsCreatorWorkspaces?.maybeAutoLoadWorkspace?.(view);
    window.zhimuSearchFocus?.applyAfterRender?.();
  }

export function handle(action, el) {
    for (const getFn of dispatchers) {
      const fn = getFn();
      if (typeof fn === "function" && fn(action, el)) return;
    }
    if (action === "save-node" || action === "save-settings") return showToast("配置已保存");
    if (action === "explore") {
      return openModal("调查进行中", `你开始调查「${el.dataset.place}」。系统将根据角色状态、持有物品和已解读线索展示可发现的内容。`, "确认调查");
    }
    if (action === "export") return showToast("世界数据已准备导出");
    if (action === "import") return handle("creator-import", el);
    if (action === "token") return showToast("实体小卡功能暂不可用");
    if (action === "open-wizard") return openWizard();
    if (action === "open-creator-guide") return window.zhimuGuide?.openCreatorGuide?.();
    if (action === "open-error-guide") return window.zhimuGuide?.openErrorGuide?.();
    if (action === "report-issue") {
      const subject = el?.dataset?.reportSubject || "";
      const body = el?.dataset?.reportBody || "";
      return openFeedbackForm("bug", subject, body);
    }
    if (action === "unavailable") return showToast(`${el.dataset.feature || "该功能"}暂不可用`);
  }

registerRuntime({ bindDynamic, handle });
