import { getRoomId } from "../session.js";
import { state } from "../state.js";
import {
  createHostVoteWorkspace,
  hostVoteWorkspaceIsPending,
  updateHostVoteDraft
} from "./host-vote-workspace-model.js";
import { createHostVoteWorkspaceService } from "./host-vote-workspace-service.js";

export function createHostVoteWorkspaceController({ render, showToast }) {
  const service = createHostVoteWorkspaceService({ render, showToast });
  let opener = null;

  function afterRender(callback) {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
    else queueMicrotask(callback);
  }

  function reveal() {
    if (typeof document === "undefined") return;
    const workspace = document.querySelector("[data-host-vote-workspace]");
    workspace?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    workspace?.querySelector?.("input, button")?.focus?.({ preventScroll: true });
  }

  function open(element) {
    if (state.hostVoteWorkspace) {
      showToast(state.hostVoteWorkspace.status === "success"
        ? "当前投票已经创建，请先返回监控台再新建"
        : "已有投票草稿，请先完成或放弃当前草稿");
      afterRender(reveal);
      return;
    }
    opener = element?.dataset?.action || "host-create-vote";
    state.hostVoteWorkspace = createHostVoteWorkspace(getRoomId());
    render();
    afterRender(reveal);
  }

  function close() {
    const workspace = state.hostVoteWorkspace;
    if (!workspace) return;
    if (hostVoteWorkspaceIsPending(workspace) || workspace.status === "uncertain") {
      showToast("投票创建仍在提交或等待核对，暂时不能关闭");
      return;
    }
    if (workspace.dirty && workspace.status !== "confirm-discard") {
      workspace.status = "confirm-discard";
      workspace.message = "当前投票尚未创建。再次点击“放弃草稿”才会离开。";
      render();
      return;
    }
    state.hostVoteWorkspace = null;
    render();
    afterRender(() => {
      if (typeof document === "undefined") return;
      document.querySelector?.(`[data-action="${opener}"]`)?.focus?.();
    });
  }

  function handleField(element) {
    const field = element?.dataset?.hostVoteField;
    if (!field || !state.hostVoteWorkspace) return false;
    updateHostVoteDraft(state.hostVoteWorkspace, field, element.value);
    return true;
  }

  async function handleAction(action, element) {
    switch (action) {
      case "host-create-vote":
        open(element);
        return true;
      case "host-vote-workspace-close":
        close();
        return true;
      case "host-vote-workspace-submit":
        void service.submit();
        return true;
      case "host-vote-workspace-reconcile":
        void service.reconcile();
        return true;
      default:
        return false;
    }
  }

  return { handleAction, handleField, open };
}
