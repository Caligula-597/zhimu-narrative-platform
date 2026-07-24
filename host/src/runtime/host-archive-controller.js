import { activeRuntimeRoom } from "../components/ui.js";
import { state } from "../state.js";
import {
  createHostArchiveWorkspace,
  hostArchiveHasDirtyDraft,
  hostArchiveIsLocked,
  hostArchiveIsPending,
  updateHostArchiveField
} from "./host-archive-model.js";
import { createHostArchiveService } from "./host-archive-service.js";

export function createHostArchiveController({ render, showToast }) {
  const service = createHostArchiveService({ render, showToast });
  let openerAction = "";

  function afterRender(callback) {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
    else queueMicrotask(callback);
  }

  function revealWorkspace() {
    if (typeof document === "undefined") return;
    const workspace = document.querySelector("[data-host-archive-workspace]");
    workspace?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    workspace?.querySelector?.("[data-host-archive-field]")?.focus?.({ preventScroll: true });
  }

  function focusOpener() {
    if (!openerAction || typeof document === "undefined") return;
    document.querySelector(`[data-action="${openerAction}"]`)?.focus?.();
  }

  function open(kind, element = null) {
    const room = activeRuntimeRoom();
    if (!room) {
      showToast("请先选择运行房");
      return;
    }
    openerAction = element?.dataset?.action || (kind === "recap" ? "create-recap" : "create-checkpoint");
    const current = state.hostArchiveWorkspace;
    if (current && current.roomId === room.id) {
      if (hostArchiveIsLocked(current) && current.kind !== kind) {
        showToast("当前归档提交尚未核对完成，请先处理当前草稿");
        afterRender(revealWorkspace);
        return;
      }
      current.kind = kind;
      current.confirm = null;
      render();
      afterRender(revealWorkspace);
      return;
    }
    state.hostArchiveWorkspace = createHostArchiveWorkspace({ room, kind });
    render();
    afterRender(revealWorkspace);
    void service.loadHistory(state.hostArchiveWorkspace.id);
  }

  function close() {
    const workspace = state.hostArchiveWorkspace;
    if (!workspace) return;
    if (hostArchiveIsPending(workspace)) {
      showToast("归档仍在提交或核对，请等待服务器返回");
      return;
    }
    if (hostArchiveHasDirtyDraft(workspace) || workspace.status === "uncertain") {
      workspace.confirm = { type: "discard" };
      render();
      return;
    }
    state.hostArchiveWorkspace = null;
    render();
    afterRender(focusOpener);
  }

  function discardAndClose() {
    state.hostArchiveWorkspace = null;
    render();
    afterRender(focusOpener);
  }

  function handleField(element) {
    const field = element?.dataset?.hostArchiveField;
    if (!field || !state.hostArchiveWorkspace) return false;
    updateHostArchiveField(state.hostArchiveWorkspace, field, element.value);
    return true;
  }

  async function handleAction(action, element) {
    switch (action) {
      case "create-checkpoint":
        open("checkpoint", element);
        return true;
      case "create-recap":
        open("recap", element);
        return true;
      case "host-archive-kind":
        open(element?.dataset?.kind || "checkpoint", element);
        return true;
      case "host-archive-close":
        close();
        return true;
      case "host-archive-confirm-cancel":
        if (state.hostArchiveWorkspace) state.hostArchiveWorkspace.confirm = null;
        render();
        return true;
      case "host-archive-discard-confirm":
        discardAndClose();
        return true;
      case "host-archive-refresh":
        if (state.hostArchiveWorkspace && !hostArchiveIsPending(state.hostArchiveWorkspace)) {
          void service.loadHistory(state.hostArchiveWorkspace.id);
        }
        return true;
      case "host-archive-submit":
        void service.submit();
        return true;
      case "host-archive-reconcile":
        void service.reconcile();
        return true;
      default:
        return false;
    }
  }

  return {
    handleAction,
    handleField,
    open
  };
}
