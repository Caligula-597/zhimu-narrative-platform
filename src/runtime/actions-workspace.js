/** Workspace / auth / cloud refresh action dispatch — isolated from view-specific handlers. */
import { uiStore } from "../state/index.js";
import { callRuntime, go, loadCloudData, render } from "./runtime-facade.js";
import { activeRuntimeRoom } from "../components/emptyState.js";
import { togglePanelInDom } from "../components/collapse-panel.js";
import { callView } from "./view-registry.js";
(function (window) {
  function handleWorkspaceAction(action, el) {
    switch (action) {
      case "account":
      case "open-auth":
        callRuntime("openAuth");
        return true;
      case "world-library":
        callRuntime("openWorldLibrary");
        return true;
      case "load-segment-completion":
        callView("overview", "loadSegmentCompletion");
        return true;
      case "load-creator-analytics":
        callView("platformRuntime", "loadCreatorAnalytics");
        return true;
      case "load-quality-reports":
        callView("platformRuntime", "loadQualityReports");
        return true;
      case "record-quality-report":
        callView("platformRuntime", "recordQualityReportSnapshot");
        return true;
      case "load-clue-hit-rate":
        callView("clues", "loadClueHitRate");
        return true;
      case "open-catalog":
        callRuntime("openWorldLibrary", "catalog");
        return true;
      case "catalog-join":
        callRuntime("joinCatalogWorld", el?.dataset?.worldId);
        return true;
      case "world-rooms":
        callRuntime("openWorldRooms");
        return true;
      case "world-select":
        callRuntime("selectWorld", el?.dataset?.worldId);
        return true;
      case "world-delete":
        callRuntime("deleteWorld", el?.dataset?.worldId, el?.dataset?.worldName);
        return true;
      case "world-rename":
        callRuntime("openRenameWorldModal", el?.dataset?.worldId, el?.dataset?.worldName, el?.dataset?.worldSummary, true);
        return true;
      case "room-select":
        callRuntime("selectParallelRoom", el?.dataset?.roomId);
        return true;
      case "room-invite":
        callRuntime("openRoomInvite", el?.dataset?.roomId, el?.dataset?.inviteCode, el?.dataset?.roomName);
        return true;
      case "room-invite-current":
        callRuntime("openCurrentRoomInvite");
        return true;
      case "copy-invite-code":
        window.zhimuOnboarding?.markInviteSent?.();
        window.zhimuInviteLinks?.copyText?.(el?.dataset?.inviteCode, "邀请码");
        render();
        return true;
      case "copy-play-link":
        window.zhimuOnboarding?.markInviteSent?.();
        window.zhimuInviteLinks?.copyText?.(
          window.zhimuInviteLinks?.playerJoinUrl?.(el?.dataset?.inviteCode),
          "玩家链接"
        );
        render();
        return true;
      case "open-player-portal":
        window.open(
          window.zhimuInviteLinks?.playerJoinUrl?.(el?.dataset?.inviteCode),
          "_blank",
          "noopener,noreferrer"
        );
        return true;
      case "open-host-console":
        window.open(
          window.zhimuInviteLinks?.hostConsoleUrl?.(el?.dataset?.roomId),
          "_blank",
          "noopener,noreferrer"
        );
        return true;
      case "room-join":
        callRuntime("openJoinRoom", el?.dataset?.inviteCode);
        return true;
      case "room-create":
        callRuntime("createParallelRoom");
        return true;
      case "room-listing-on":
        callRuntime("setRoomPublicListing", el?.dataset?.roomId, true);
        return true;
      case "room-listing-off":
        callRuntime("setRoomPublicListing", el?.dataset?.roomId, false);
        return true;
      case "refresh-cloud":
        loadCloudData(true, true);
        return true;
      case "retry-view-module":
        render();
        return true;
      case "dismiss-onboarding":
        window.zhimuOnboarding?.dismiss?.();
        render();
        return true;
      case "dismiss-first-run":
        window.zhimuFirstRun?.dismiss?.();
        render();
        return true;
      case "open-play-official":
        window.open(window.zhimuFirstRun?.playOfficialUrl?.() || "https://play.getzhimu.com/?experience=official", "_blank", "noopener,noreferrer");
        return true;
      case "toggle-nav-advanced": {
        const panel = document.getElementById("nav-advanced");
        const expanded = panel && panel.hidden;
        if (panel) panel.hidden = !expanded;
        localStorage.setItem("zhimuNavAdvanced", expanded ? "1" : "0");
        window.zhimuNavShell?.syncNavAdvanced?.();
        return true;
      }
      case "onboarding-go-player":
        window.zhimuOnboarding?.markPlayerVisit?.();
        window.open(
          window.zhimuInviteLinks?.playerJoinUrl?.(activeRuntimeRoom()?.invite_code),
          "_blank",
          "noopener,noreferrer"
        );
        render();
        return true;
      case "onboarding-copy-invite": {
        const room = activeRuntimeRoom();
        if (!room?.invite_code) {
          callRuntime("openWorldRooms");
          return true;
        }
        window.zhimuOnboarding?.markInviteSent?.();
        window.zhimuInviteLinks?.copyText?.(room.invite_code, "邀请码");
        render();
        return true;
      }
      case "onboarding-go-archive":
        window.zhimuOnboarding?.markRecapVisit?.();
        go("archive");
        return true;
      case "refresh-host-room":
        callRuntime("refreshHostRoom", true);
        return true;
      case "refresh-host-events":
        callRuntime("refreshHostEvents", true);
        return true;
      case "refresh-host-players":
        callRuntime("refreshHostPlayers", true);
        return true;
      case "refresh-host-clue-matrix":
        callRuntime("refreshHostClueMatrix", true);
        return true;
      case "refresh-host-audit":
        callRuntime("refreshHostAuditLog", true);
        return true;
      case "open-account-hub":
      case "go-account": {
        const tab = el?.dataset?.hubTab === "assets" ? "assets" : "account";
        const ui = uiStore.get();
        if (ui.view === "account" && ui.accountHubTab !== tab) {
          void window.zhimuAccountHub?.switchAccountHubTab?.(tab);
          return true;
        }
        uiStore.set({ accountHubTab: tab });
        go("account");
        return true;
      }
      case "account-hub-tab":
        void window.zhimuAccountHub?.switchAccountHubTab?.(el?.dataset?.hubTab);
        return true;
      case "toggle-collapse-panel": {
        const panelId = el?.dataset?.panelId;
        if (!panelId) return true;
        const defaultOpen = el?.dataset?.defaultOpen !== "0";
        togglePanelInDom(panelId, defaultOpen, el);
        return true;
      }
      default:
        return false;
    }
  }

  window.zhimuActionsWorkspace = { handleWorkspaceAction };
})(window);
export {};
