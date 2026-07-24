import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { getWorldId } from "../session.js";
import { state } from "../state.js";
import {
  hostRuleDraftFingerprint,
  hostRuleWorkspaceContextIsCurrent,
  hostRuleWorkspaceIsPending,
  parseHostRuleDraft
} from "./host-rule-workspace-model.js";
import { canEditHostRules } from "./host-rule-permissions.js";
import {
  hostRuleMatchesPayload,
  reloadHostRules,
  upsertHostRule
} from "./host-rule-store.js";
import { isUncertainHostWrite } from "./host-write-reconciliation.js";

function currentWorkspace(id, getWorld = getWorldId) {
  const workspace = state.hostRuleWorkspace;
  if (!workspace || workspace.id !== id) return null;
  return hostRuleWorkspaceContextIsCurrent(workspace, getWorld()) ? workspace : null;
}

function setWorkspaceResult(id, status, message, errors = [], getWorld = getWorldId) {
  const workspace = currentWorkspace(id, getWorld);
  if (!workspace) return null;
  workspace.status = status;
  workspace.message = message;
  workspace.errors = errors;
  workspace.confirm = null;
  return workspace;
}

export function createHostRuleWorkspaceService({
  render,
  showToast,
  apiRef = api,
  getWorld = getWorldId,
  canEdit = canEditHostRules,
  reconcileDelays = [0, 250, 750],
  wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay))
}) {
  async function loadRules(worldId) {
    return reloadHostRules({ apiRef, worldId, getWorld, render });
  }

  function markWorkspaceSaved(workspace, rule, fingerprint, message) {
    if (!workspace) return;
    if (rule?.id) {
      workspace.ruleId = String(rule.id);
      workspace.originalMetadata = rule.metadata && typeof rule.metadata === "object"
        ? { ...rule.metadata }
        : workspace.originalMetadata;
      upsertHostRule(rule);
    }
    workspace.baselineFingerprint = fingerprint || hostRuleDraftFingerprint(workspace.draft);
    workspace.validatedFingerprint = workspace.baselineFingerprint;
    workspace.dirty = false;
    workspace.status = "success";
    workspace.message = message;
    workspace.errors = [];
    workspace.confirm = null;
  }

  async function reconcileSave(workspaceId, payload) {
    const workspace = currentWorkspace(workspaceId, getWorld);
    if (!workspace) return { checked: false, found: false };
    let checked = false;
    for (const delay of reconcileDelays) {
      if (delay > 0) await wait(delay);
      try {
        const rules = await apiRef.getRules(workspace.worldId);
        checked = true;
        const current = currentWorkspace(workspaceId, getWorld);
        if (!current) return { checked, found: false };
        state.rules = Array.isArray(rules) ? rules : [];
        const saved = current.ruleId
          ? state.rules.find((rule) => String(rule.id) === String(current.ruleId) && hostRuleMatchesPayload(rule, payload))
          : state.rules.find((rule) =>
            String(rule.metadata?.hostRequestId || "") === String(current.requestId)
            && hostRuleMatchesPayload(rule, payload)
          );
        if (saved) {
          markWorkspaceSaved(
            current,
            saved,
            hostRuleDraftFingerprint(current.draft),
            "规则写入已由服务器列表确认；请勿重复提交。"
          );
          render();
          return { checked: true, found: true };
        }
      } catch {
        // A later poll may recover after the write connection is interrupted.
      }
    }
    render();
    return { checked, found: false };
  }

  async function validateCurrent({ saveAfter = false } = {}) {
    const workspace = state.hostRuleWorkspace;
    if (!workspace || hostRuleWorkspaceIsPending(workspace) || workspace.status === "uncertain") return null;
    if (!hostRuleWorkspaceContextIsCurrent(workspace, getWorld())) {
      showToast("剧本已切换，请在当前剧本重新打开规则");
      return null;
    }
    if (!canEdit(workspace.worldId)) {
      workspace.status = "error";
      workspace.message = "当前协作角色只能查看和运行规则，规则写入仅限拥有者与编辑者。";
      workspace.errors = [];
      render();
      return null;
    }
    const parsed = parseHostRuleDraft(workspace, {
      roomIds: (state.rooms || []).map((room) => room.id)
    });
    if (!parsed.ok) {
      workspace.status = "error";
      workspace.message = "草稿存在本地格式问题。";
      workspace.errors = parsed.errors;
      render();
      return null;
    }

    const workspaceId = workspace.id;
    workspace.status = "validating";
    workspace.message = "正在按当前剧本资产检查条件和动作引用…";
    workspace.errors = [];
    workspace.confirm = null;
    render();
    try {
      const validation = await apiRef.validateRuleBody({
        conditions: parsed.payload.conditions,
        actions: parsed.payload.actions
      }, workspace.worldId);
      const current = currentWorkspace(workspaceId, getWorld);
      if (!current) return null;
      if (!validation?.ok) {
        current.status = "error";
        current.message = "规则未通过服务端结构与引用检查。";
        current.errors = validation?.errors || [{ message: "规则检查失败" }];
        render();
        return null;
      }
      current.validatedFingerprint = parsed.fingerprint;
      if (!saveAfter) {
        current.status = "success";
        current.message = "条件、动作和资产引用检查通过；当前草稿尚未保存。";
        render();
        return parsed.payload;
      }
      return saveValidated(workspaceId, parsed);
    } catch (error) {
      const current = setWorkspaceResult(
        workspaceId,
        "error",
        formatApiError(error, "规则检查失败"),
        [],
        getWorld
      );
      if (current) render();
      return null;
    }
  }

  async function saveValidated(workspaceId, parsed) {
    const workspace = currentWorkspace(workspaceId, getWorld);
    if (!workspace) return null;
    workspace.status = "submitting";
    workspace.message = "检查已通过，正在提交规则；完成前请勿重复点击。";
    workspace.errors = [];
    render();
    try {
      const saved = workspace.ruleId
        ? await apiRef.updateRule(workspace.ruleId, parsed.payload, workspace.worldId)
        : await apiRef.createRule(parsed.payload, workspace.worldId);
      const current = currentWorkspace(workspaceId, getWorld);
      if (!current) {
        showToast("上一剧本的规则写入已返回，请勿重复执行");
        return saved;
      }
      markWorkspaceSaved(current, saved, parsed.fingerprint, "规则已提交，正在重新读取规则列表。");
      render();
      try {
        await loadRules(current.worldId);
        const latest = currentWorkspace(workspaceId, getWorld);
        if (latest) {
          latest.status = "success";
          latest.message = "规则已保存，规则列表已重新读取。";
          render();
        }
      } catch {
        const latest = currentWorkspace(workspaceId, getWorld);
        if (latest) {
          latest.status = "success";
          latest.message = "规则写入已提交，但列表刷新失败；请勿重复保存，稍后重新核对。";
          render();
        }
      }
      return saved;
    } catch (error) {
      if (isUncertainHostWrite(error)) {
        const reconciliation = await reconcileSave(workspaceId, parsed.payload);
        if (reconciliation.found) return state.hostRuleWorkspace;
        const current = currentWorkspace(workspaceId, getWorld);
        if (!current) return null;
        current.status = "uncertain";
        current.message = reconciliation.checked
          ? "服务器列表暂未发现本次写入，但迟到提交仍可能完成；请勿立即重试，稍后点击“重新核对”。"
          : "提交结果暂时无法核对；请勿重复保存，恢复网络后点击“重新核对”。";
        current.errors = [];
        render();
        return null;
      }
      const current = setWorkspaceResult(
        workspaceId,
        "error",
        formatApiError(error, "规则保存失败"),
        error?.details?.errors || [],
        getWorld
      );
      if (current) render();
      return null;
    }
  }

  async function reconcileCurrent() {
    const workspace = state.hostRuleWorkspace;
    if (!workspace || hostRuleWorkspaceIsPending(workspace)) return null;
    const parsed = parseHostRuleDraft(workspace, {
      roomIds: (state.rooms || []).map((room) => room.id)
    });
    if (!parsed.ok) {
      workspace.status = "error";
      workspace.message = "草稿已变化，无法按原请求核对。";
      workspace.errors = parsed.errors;
      render();
      return null;
    }
    workspace.status = "validating";
    workspace.message = "正在重新核对服务器规则列表…";
    render();
    const result = await reconcileSave(workspace.id, parsed.payload);
    const current = currentWorkspace(workspace.id, getWorld);
    if (!current || result.found) return result;
    current.status = result.checked ? "error" : "uncertain";
    current.message = result.checked
      ? "服务器未发现本次写入；可以重新保存当前草稿。"
      : "仍无法读取服务器列表，请保持当前页面并稍后重试核对。";
    render();
    return result;
  }

  return {
    reconcileCurrent,
    validateCurrent
  };
}
