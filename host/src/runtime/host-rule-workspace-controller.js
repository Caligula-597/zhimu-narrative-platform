import { getWorldId } from "../session.js";
import { state } from "../state.js";
import {
  createHostRuleWorkspace,
  hostRuleWorkspaceIsPending,
  updateHostRuleWorkspaceField
} from "./host-rule-workspace-model.js";
import { canEditHostRules } from "./host-rule-permissions.js";
import { createHostRuleListService } from "./host-rule-list-service.js";
import { createHostRuleWorkspaceService } from "./host-rule-workspace-service.js";

export function createHostRuleWorkspaceController({ render, showToast }) {
  const workspaceService = createHostRuleWorkspaceService({ render, showToast });
  const listService = createHostRuleListService({ render, showToast });
  let openerDescriptor = null;

  function afterRender(callback) {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
    else queueMicrotask(callback);
  }

  function rememberOpener(element) {
    if (!element?.dataset?.action) return;
    openerDescriptor = {
      action: element.dataset.action,
      ruleId: element.dataset.rule || ""
    };
  }

  function focusOpener() {
    if (!openerDescriptor || typeof document === "undefined") return;
    const candidates = [...document.querySelectorAll(`[data-action="${openerDescriptor.action}"]`)];
    const target = candidates.find((item) =>
      !openerDescriptor.ruleId || item.dataset.rule === openerDescriptor.ruleId
    ) || candidates[0];
    target?.focus?.();
  }

  function revealWorkspace() {
    if (typeof document === "undefined") return;
    const workspace = document.querySelector("[data-host-rule-workspace]");
    workspace?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    workspace?.querySelector?.("[data-host-rule-field]")?.focus?.({ preventScroll: true });
  }

  function replaceWorkspace(ruleId = "") {
    const worldId = getWorldId();
    if (!worldId) {
      showToast("请先选择剧本世界");
      return false;
    }
    const rule = ruleId
      ? (state.rules || []).find((item) => String(item.id) === String(ruleId))
      : null;
    if (ruleId && !rule) {
      showToast("找不到要编辑的规则，可能已被其他协作者删除");
      return false;
    }
    state.hostRuleWorkspace = createHostRuleWorkspace({ worldId, rule });
    render();
    afterRender(revealWorkspace);
    return true;
  }

  function open(ruleId = "", element = null) {
    if (!canEditHostRules()) {
      showToast("当前协作角色只能查看和运行规则，规则编辑仅限拥有者与编辑者。");
      return;
    }
    rememberOpener(element);
    const current = state.hostRuleWorkspace;
    if (hostRuleWorkspaceIsPending(current)) {
      showToast("当前规则仍在检查或提交，请等待服务端返回");
      return;
    }
    if (current) {
      const sameTarget = String(current.ruleId || "") === String(ruleId || "");
      if (sameTarget) {
        afterRender(revealWorkspace);
        return;
      }
      if (current.dirty || current.status === "uncertain") {
        current.confirm = { type: "replace", ruleId: String(ruleId || "") };
        render();
        afterRender(revealWorkspace);
        return;
      }
    }
    replaceWorkspace(ruleId);
  }

  function close() {
    const workspace = state.hostRuleWorkspace;
    if (!workspace) return;
    if (hostRuleWorkspaceIsPending(workspace)) {
      showToast("规则仍在检查或提交，请等待服务端返回");
      return;
    }
    if (workspace.dirty || workspace.status === "uncertain") {
      workspace.confirm = { type: "discard" };
      render();
      return;
    }
    state.hostRuleWorkspace = null;
    render();
    afterRender(focusOpener);
  }

  function discardAndClose() {
    state.hostRuleWorkspace = null;
    render();
    afterRender(focusOpener);
  }

  function replaceConfirmed() {
    const ruleId = state.hostRuleWorkspace?.confirm?.ruleId || "";
    state.hostRuleWorkspace = null;
    replaceWorkspace(ruleId);
  }

  function handleField(element) {
    const field = element?.dataset?.hostRuleField;
    const workspace = state.hostRuleWorkspace;
    if (!workspace || !field) return false;
    updateHostRuleWorkspaceField(workspace, field, element.value, element.checked);
    return true;
  }

  async function copyReference(value) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast("引用 ID 已复制");
    } catch {
      showToast(`复制失败，请手动复制：${value}`);
    }
  }

  async function handleAction(action, element) {
    switch (action) {
      case "host-rule-new":
        open("", element);
        return true;
      case "host-rule-edit":
        open(element?.dataset?.rule || "", element);
        return true;
      case "host-rule-workspace-close":
        close();
        return true;
      case "host-rule-confirm-cancel":
        if (state.hostRuleWorkspace) state.hostRuleWorkspace.confirm = null;
        render();
        return true;
      case "host-rule-discard-confirm":
        discardAndClose();
        return true;
      case "host-rule-replace-confirm":
        replaceConfirmed();
        return true;
      case "host-rule-validate-current":
        void workspaceService.validateCurrent();
        return true;
      case "host-rule-save":
        void workspaceService.validateCurrent({ saveAfter: true });
        return true;
      case "host-rule-reconcile":
        void workspaceService.reconcileCurrent();
        return true;
      case "host-rule-copy-reference":
        void copyReference(element?.dataset?.value || "");
        return true;
      case "host-rule-toggle":
        void listService.toggleRule(element?.dataset?.rule || "");
        return true;
      case "host-rule-delete-request":
        if (!canEditHostRules()) {
          showToast("当前协作角色不能删除规则。");
        } else if (!state.hostRuleListBusy) {
          state.hostRuleDeleteConfirmId = element?.dataset?.rule || "";
          state.hostRuleListMessage = "";
          render();
        }
        return true;
      case "host-rule-delete-cancel":
        state.hostRuleDeleteConfirmId = "";
        render();
        return true;
      case "host-rule-delete-confirm":
        void listService.deleteRule(element?.dataset?.rule || state.hostRuleDeleteConfirmId || "");
        return true;
      case "host-rule-validate":
        if (!canEditHostRules()) {
          showToast("完整规则检查仅限拥有者与编辑者；主持人可使用运行预览检查当前房间。");
        } else {
          void listService.validateWorldRules();
        }
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
