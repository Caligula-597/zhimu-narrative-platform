import { getWorldId } from "../session.js";
import { state } from "../state.js";
import {
  createHostRoomCreateWorkspace,
  hostRoomCreateIsPending,
  hostRoomCreateNavigationBlockReason,
  updateHostRoomDraft
} from "./host-room-create-model.js";
import { createHostRoomCreateService } from "./host-room-create-service.js";

const NAVIGATION_ACTIONS = new Set([
  "landing-back-worlds",
  "world-select",
  "room-select",
  "show-auth",
  "logout"
]);

export function createHostRoomCreateController({
  render,
  showToast,
  enterRoom
}) {
  const service = createHostRoomCreateService({ render, showToast });

  function afterRender(callback) {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
    else queueMicrotask(callback);
  }

  function reveal() {
    if (typeof document === "undefined") return;
    const workspace = document.querySelector("[data-host-room-create-workspace]");
    workspace?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    workspace?.querySelector?.("input, button")?.focus?.({ preventScroll: true });
  }

  function open() {
    const worldId = getWorldId();
    if (!state.user) {
      showToast("请先登录后再创建运行房");
      return;
    }
    if (!worldId) {
      showToast("请先选择剧本世界");
      return;
    }
    const existing = state.hostRoomCreateWorkspace;
    if (existing) {
      showToast(existing.status === "success"
        ? "运行房已经创建，请先进入或返回列表"
        : "已有建房草稿，请先完成或放弃当前草稿");
      afterRender(reveal);
      return;
    }
    state.hostRoomCreateWorkspace = createHostRoomCreateWorkspace(worldId);
    render();
    afterRender(reveal);
  }

  function close() {
    const workspace = state.hostRoomCreateWorkspace;
    if (!workspace) return;
    if (hostRoomCreateIsPending(workspace) || workspace.status === "uncertain") {
      showToast("运行房仍在创建或等待核对，暂时不能关闭");
      return;
    }
    if (workspace.dirty && workspace.status !== "confirm-discard") {
      workspace.status = "confirm-discard";
      workspace.message = "当前运行房草稿尚未创建。再次点击“放弃草稿”才会离开。";
      render();
      return;
    }
    state.hostRoomCreateWorkspace = null;
    render();
    afterRender(() => {
      if (typeof document === "undefined") return;
      document.querySelector?.('[data-action="create-room"]')?.focus?.();
    });
  }

  function handleField(element) {
    const field = element?.dataset?.hostRoomCreateField;
    if (!field || !state.hostRoomCreateWorkspace) return false;
    updateHostRoomDraft(
      state.hostRoomCreateWorkspace,
      field,
      field === "publicListing" ? element.checked : element.value
    );
    return true;
  }

  async function handleAction(action) {
    if (NAVIGATION_ACTIONS.has(action) && state.hostRoomCreateWorkspace) {
      const reason = hostRoomCreateNavigationBlockReason(state.hostRoomCreateWorkspace);
      if (reason) {
        showToast(reason);
        afterRender(reveal);
        return true;
      }
      state.hostRoomCreateWorkspace = null;
    }
    switch (action) {
      case "create-room":
        open();
        return true;
      case "host-room-create-close":
        close();
        return true;
      case "host-room-create-submit":
        void service.submit();
        return true;
      case "host-room-create-reconcile":
        void service.reconcile();
        return true;
      case "host-room-create-enter": {
        const roomId = state.hostRoomCreateWorkspace?.createdRoom?.id;
        if (roomId) await enterRoom(roomId);
        return true;
      }
      default:
        return false;
    }
  }

  return {
    handleAction,
    handleField,
    navigationBlockReason: () => hostRoomCreateNavigationBlockReason(state.hostRoomCreateWorkspace),
    reset: () => {
      state.hostRoomCreateWorkspace = null;
    }
  };
}
