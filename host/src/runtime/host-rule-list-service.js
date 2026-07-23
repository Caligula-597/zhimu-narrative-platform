import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { getWorldId } from "../session.js";
import { state } from "../state.js";
import { canEditHostRules } from "./host-rule-permissions.js";
import {
  hostRuleMatchesPayload,
  isUncertainTransportError,
  reloadHostRules,
  upsertHostRule
} from "./host-rule-store.js";

export function createHostRuleListService({
  render,
  showToast,
  apiRef = api,
  getWorld = getWorldId,
  canEdit = canEditHostRules
}) {
  function ensureWriteAccess(worldId) {
    if (canEdit(worldId)) return true;
    state.hostRuleListMessage = "当前协作角色只能查看和运行规则，规则写入仅限拥有者与编辑者。";
    render();
    return false;
  }

  async function reload(worldId) {
    return reloadHostRules({ apiRef, worldId, getWorld, render });
  }

  async function toggleRule(ruleId) {
    const worldId = getWorld();
    const rule = (state.rules || []).find((item) => String(item.id) === String(ruleId));
    if (!worldId || !rule || state.hostRuleListBusy || !ensureWriteAccess(worldId)) return null;
    state.hostRuleListBusy = `toggle:${ruleId}`;
    state.hostRuleListMessage = "";
    render();
    const payload = {
        roomId: rule.room_id || null,
        name: rule.name,
        mode: rule.mode,
        priority: rule.priority,
        enabled: !rule.enabled,
        conditions: rule.conditions,
        actions: rule.actions,
        metadata: rule.metadata || {}
      };
    try {
      const updated = await apiRef.updateRule(rule.id, payload, worldId);
      if (getWorld() !== worldId) return updated;
      upsertHostRule(updated);
      state.hostRuleListMessage = updated.enabled ? "规则已启用。" : "规则已暂停。";
      try {
        await reload(worldId);
      } catch {
        state.hostRuleListMessage += " 写入已提交，但列表刷新失败；请勿重复点击。";
      }
      showToast(state.hostRuleListMessage);
      return updated;
    } catch (error) {
      if (getWorld() === worldId && isUncertainTransportError(error)) {
        try {
          const rules = await reload(worldId);
          const committed = rules?.find((item) =>
            String(item.id) === String(rule.id) && hostRuleMatchesPayload(item, payload)
          );
          if (committed) {
            state.hostRuleListMessage = "规则状态写入已由服务器列表确认；请勿重复点击。";
            showToast(state.hostRuleListMessage);
            return committed;
          }
          state.hostRuleListMessage = "规则状态尚未在服务器列表确认；当前操作可安全重试。";
        } catch {
          state.hostRuleListMessage = "规则状态结果暂时无法核对；请勿重复点击，恢复网络后刷新列表。";
        }
      } else if (getWorld() === worldId) {
        state.hostRuleListMessage = formatApiError(error, "规则状态更新失败");
      }
      return null;
    } finally {
      if (getWorld() === worldId) {
        state.hostRuleListBusy = "";
        render();
      }
    }
  }

  async function deleteRule(ruleId) {
    const worldId = getWorld();
    const rule = (state.rules || []).find((item) => String(item.id) === String(ruleId));
    if (!worldId || !rule || state.hostRuleListBusy || !ensureWriteAccess(worldId)) return null;
    state.hostRuleListBusy = `delete:${ruleId}`;
    state.hostRuleListMessage = "";
    render();
    try {
      await apiRef.deleteRule(rule.id, worldId);
      if (getWorld() !== worldId) return true;
      state.rules = (state.rules || []).filter((item) => String(item.id) !== String(ruleId));
      state.hostRuleDeleteConfirmId = "";
      if (String(state.hostRuleWorkspace?.ruleId || "") === String(ruleId)) {
        state.hostRuleWorkspace = null;
      }
      state.hostRuleListMessage = "规则已删除。";
      try {
        await reload(worldId);
      } catch {
        state.hostRuleListMessage += " 删除已提交，但列表刷新失败；请勿重复操作。";
      }
      showToast(state.hostRuleListMessage);
      return true;
    } catch (error) {
      if (getWorld() === worldId && isUncertainTransportError(error)) {
        try {
          const rules = await reload(worldId);
          if (!rules?.some((item) => String(item.id) === String(rule.id))) {
            state.hostRuleDeleteConfirmId = "";
            state.hostRuleListMessage = "规则删除已由服务器列表确认；请勿重复操作。";
            showToast(state.hostRuleListMessage);
            return true;
          }
          state.hostRuleListMessage = "服务器列表仍包含该规则；可以重新执行删除。";
        } catch {
          state.hostRuleListMessage = "删除结果暂时无法核对；请勿重复操作，恢复网络后刷新列表。";
        }
      } else if (getWorld() === worldId) {
        state.hostRuleListMessage = formatApiError(error, "规则删除失败");
      }
      return null;
    } finally {
      if (getWorld() === worldId) {
        state.hostRuleListBusy = "";
        render();
      }
    }
  }

  async function validateWorldRules() {
    const worldId = getWorld();
    if (!worldId || state.hostRuleListBusy) return null;
    state.hostRuleListBusy = "validate";
    state.hostRuleAudit = { status: "loading", checks: [], totalRules: 0, message: "正在检查全部规则…" };
    render();
    try {
      const result = await apiRef.validateRules(worldId);
      if (getWorld() !== worldId) return result;
      state.hostRuleAudit = {
        status: "success",
        checks: Array.isArray(result.checks) ? result.checks : [],
        totalRules: Number(result.totalRules) || 0,
        message: ""
      };
      return result;
    } catch (error) {
      if (getWorld() === worldId) {
        state.hostRuleAudit = {
          status: "error",
          checks: [],
          totalRules: 0,
          message: formatApiError(error, "规则检查失败")
        };
      }
      return null;
    } finally {
      if (getWorld() === worldId) {
        state.hostRuleListBusy = "";
        render();
      }
    }
  }

  return { deleteRule, toggleRule, validateWorldRules };
}
