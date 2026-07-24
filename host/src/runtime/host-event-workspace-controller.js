import { getRoomId } from "../session.js";
import { state } from "../state.js";
import {
  createHostEventWorkspace,
  hostEventWorkspaceIsPending,
  updateHostEventDelay
} from "./host-event-workspace-model.js";
import { createHostEventWorkspaceService } from "./host-event-workspace-service.js";

const ACTION_TO_INTENT = Object.freeze({
  "execute-host-event": "execute",
  "dismiss-host-event": "dismiss",
  "delay-host-event": "delay",
  "host-event-context": "review"
});

export function createHostEventWorkspaceController({ render, showToast }) {
  const service = createHostEventWorkspaceService({ render, showToast });
  let opener = null;

  function afterRender(callback) {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
    else queueMicrotask(callback);
  }

  function reveal() {
    if (typeof document === "undefined") return;
    const workspace = document.querySelector("[data-host-event-workspace]");
    workspace?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    workspace?.querySelector?.("button, input")?.focus?.({ preventScroll: true });
  }

  function focusOpener() {
    if (!opener || typeof document === "undefined") return;
    document.querySelector(
      `[data-action="${opener.action}"][data-event="${opener.eventId}"]`
    )?.focus?.();
  }

  function open(eventId, intent, element) {
    const event = (state.cloudHostEvents || []).find((item) => String(item.id) === String(eventId));
    if (!event) {
      showToast("找不到待确认事件，可能已被其他主持处理");
      return;
    }
    if (hostEventWorkspaceIsPending(state.hostEventWorkspace)
      || state.hostEventWorkspace?.status === "uncertain") {
      showToast("当前事件操作尚未核对完成，请先处理当前工作区");
      afterRender(reveal);
      return;
    }
    opener = { action: element?.dataset?.action || "host-event-context", eventId: String(eventId) };
    state.hostEventWorkspace = createHostEventWorkspace({
      roomId: getRoomId(),
      event,
      intent
    });
    render();
    afterRender(reveal);
  }

  function close() {
    const workspace = state.hostEventWorkspace;
    if (!workspace) return;
    if (hostEventWorkspaceIsPending(workspace) || workspace.status === "uncertain") {
      showToast("事件写入仍在提交或等待核对，暂时不能关闭");
      return;
    }
    state.hostEventWorkspace = null;
    render();
    afterRender(focusOpener);
  }

  function handleField(element) {
    if (!element?.dataset?.hostEventField || !state.hostEventWorkspace) return false;
    if (element.dataset.hostEventField === "delayMinutes") {
      updateHostEventDelay(state.hostEventWorkspace, element.value);
      return true;
    }
    return false;
  }

  async function handleAction(action, element) {
    if (ACTION_TO_INTENT[action]) {
      open(element?.dataset?.event, ACTION_TO_INTENT[action], element);
      return true;
    }
    switch (action) {
      case "host-event-workspace-close":
        close();
        return true;
      case "host-event-workspace-command":
        if (state.hostEventWorkspace) {
          state.hostEventWorkspace.intent = element?.dataset?.command || "review";
          render();
          afterRender(reveal);
        }
        return true;
      case "host-event-workspace-submit":
        void service.submit(element?.dataset?.command || state.hostEventWorkspace?.intent);
        return true;
      case "host-event-workspace-reconcile":
        void service.reconcile();
        return true;
      default:
        return false;
    }
  }

  return { handleAction, handleField, open };
}
