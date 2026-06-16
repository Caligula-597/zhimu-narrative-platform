/** Workspace / auth / cloud refresh action dispatch — isolated from view-specific handlers. */
(function (window) {
  function handleWorkspaceAction(action, el) {
    const R = window.zhimuRuntime || {};

    switch (action) {
      case "account":
      case "open-auth":
        R.openAuth?.();
        return true;
      case "world-library":
        R.openWorldLibrary?.();
        return true;
      case "open-catalog":
        R.openWorldLibrary?.("catalog");
        return true;
      case "catalog-join":
        R.joinCatalogWorld?.(el?.dataset?.worldId);
        return true;
      case "world-rooms":
        R.openWorldRooms?.();
        return true;
      case "world-select":
        R.selectWorld?.(el?.dataset?.worldId);
        return true;
      case "world-delete":
        R.deleteWorld?.(el?.dataset?.worldId, el?.dataset?.worldName);
        return true;
      case "room-select":
        R.selectParallelRoom?.(el?.dataset?.roomId);
        return true;
      case "room-invite":
        R.openRoomInvite?.(el?.dataset?.roomId, el?.dataset?.inviteCode, el?.dataset?.roomName);
        return true;
      case "room-join":
        R.openJoinRoom?.(el?.dataset?.inviteCode);
        return true;
      case "room-create":
        R.createParallelRoom?.();
        return true;
      case "refresh-cloud":
        window.zhimuLoadCloudData?.(true, true);
        return true;
      case "dismiss-onboarding":
        window.zhimuOnboarding?.dismiss?.();
        window.zhimuRender?.();
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
        if (window.zhimuState?.cloudPlayer) window.zhimuRuntime?.go?.("player");
        else window.zhimuRuntime?.openJoinRoom?.();
        return true;
      case "onboarding-go-director":
        window.zhimuOnboarding?.markDirectorVisit?.();
        window.zhimuRuntime?.go?.("director");
        return true;
      case "refresh-host-room":
        R.refreshHostRoom?.(true);
        return true;
      case "refresh-host-events":
        R.refreshHostEvents?.(true);
        return true;
      case "refresh-host-players":
        R.refreshHostPlayers?.(true);
        return true;
      case "refresh-host-clue-matrix":
        R.refreshHostClueMatrix?.(true);
        return true;
      case "refresh-host-audit":
        R.refreshHostAuditLog?.(true);
        return true;
      case "open-account-hub":
      case "go-account": {
        const tab = el?.dataset?.hubTab === "assets" ? "assets" : "account";
        if (window.zhimuState?.view === "account" && window.zhimuState?.accountHubTab !== tab) {
          void window.zhimuAccountHub?.switchAccountHubTab?.(tab);
          return true;
        }
        window.zhimuState.accountHubTab = tab;
        R.go?.("account");
        return true;
      }
      case "account-hub-tab":
        void window.zhimuAccountHub?.switchAccountHubTab?.(el?.dataset?.hubTab);
        return true;
      case "toggle-collapse-panel": {
        const panelId = el?.dataset?.panelId;
        if (!panelId) return true;
        const defaultOpen = el?.dataset?.defaultOpen !== "0";
        window.zhimuCollapsePanel?.togglePanelInDom?.(panelId, defaultOpen, el);
        return true;
      }
      default:
        return false;
    }
  }

  window.zhimuActionsWorkspace = { handleWorkspaceAction };
})(window);
export {};
