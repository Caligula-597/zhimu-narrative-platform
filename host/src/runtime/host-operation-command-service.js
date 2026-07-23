import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { getRoomId } from "../session.js";
import { state } from "../state.js";
import {
  HOST_OPERATION_KINDS,
  HOST_OPERATION_LIMITS,
  hostOperationContextIsCurrent,
  hostOperationIsPending
} from "./host-operation-model.js";
import { refreshHostClueMatrix, refreshHostRoom } from "./data.js";

function currentOperation(id, getRoom = getRoomId) {
  const operation = state.hostOperation;
  if (!operation || operation.id !== id) return null;
  return hostOperationContextIsCurrent(operation, getRoom()) ? operation : null;
}

function requiredText(value, message) {
  const text = String(value || "").trim();
  if (!text) throw Object.assign(new Error(message), { code: "HOST_OPERATION_INVALID" });
  return text;
}

function confirmationFor(command, payload, operation) {
  const section = (operation.detail?.sections || []).find((item) => String(item.id) === String(payload.sectionId));
  const clue = (operation.detail?.clues || []).find((item) => String(item.id) === String(payload.clueId));
  const player = operation.detail?.role?.player_display_name || operation.detail?.role?.name || "该玩家";
  const confirmations = {
    "skip-section": {
      title: `跳过「${section?.title || "当前分幕"}」`,
      detail: "跳过会把分幕标记为完成，并可能触发后续自动化规则。这个结果不能通过简单撤回来抹除。",
      label: "确认跳过并推进"
    },
    "relock-section": {
      title: `撤回「${section?.title || "当前分幕"}」`,
      detail: "撤回只移除当前阅读权限；玩家已经看过的内容、笔记和审计记录会保留。",
      label: "确认撤回"
    },
    "revoke-clue": {
      title: `撤回线索「${clue?.name || "当前线索"}」`,
      detail: "玩家笔记、分享记录和审计历史不会被删除，主持人应假设玩家仍记得线索内容。",
      label: "确认撤回"
    },
    "kick-player": {
      title: `将「${player}」移出房间`,
      detail: "同账号重新选角可以继承进度；其他账号接席将从零开始。操作会写入主持审计。",
      label: "确认移出玩家"
    }
  };
  const config = confirmations[command];
  return config ? { ...config, command, payload, danger: true } : null;
}

export function createHostOperationCommandService({
  render,
  showToast,
  reloadPlayer,
  apiRef = api,
  getRoom = getRoomId,
  refreshRoom = refreshHostRoom,
  refreshMatrix = refreshHostClueMatrix
}) {
  function setResult(operationId, status, message) {
    const operation = currentOperation(operationId, getRoom);
    if (!operation) return null;
    operation.status = status;
    operation.message = message;
    operation.confirm = null;
    render();
    return operation;
  }

  async function runOperation(command, successMessage, {
    refresh = "room",
    reloadPlayerDetail = false,
    afterSuccess
  } = {}) {
    const operation = state.hostOperation;
    if (!operation || hostOperationIsPending(operation)) return null;
    if (!hostOperationContextIsCurrent(operation, getRoom())) {
      showToast("运行房已切换，请在当前房间重新发起操作");
      return null;
    }
    const operationId = operation.id;
    operation.status = "submitting";
    operation.message = "正在提交，操作完成前请勿重复点击。";
    operation.confirm = null;
    render();
    try {
      const result = await command();
      if (!currentOperation(operationId, getRoom)) {
        showToast("上一运行房的操作已提交，请勿重复执行");
        return result;
      }
      setResult(operationId, "success", `${successMessage} · 服务端已提交，正在核对房间状态。`);
      let refreshed = true;
      if (refresh === "matrix") refreshed = await refreshMatrix(false, true);
      else if (refresh === "room") refreshed = await refreshRoom(false);
      if (!currentOperation(operationId, getRoom)) return result;
      if (!refreshed) {
        setResult(operationId, "success", `${successMessage} · 写入已提交，但状态刷新失败；请勿重复操作，稍后手动刷新核对。`);
        return result;
      }
      if (reloadPlayerDetail) {
        await reloadPlayer(operationId);
        if (!currentOperation(operationId, getRoom)) return result;
        setResult(operationId, "success", `${successMessage} · 玩家状态已重新读取。`);
      } else {
        setResult(
          operationId,
          "success",
          state.roomEventsConnected
            ? `${successMessage} · SSE 已连接，房间状态已核对。`
            : `${successMessage} · 当前由轮询补偿同步，房间状态已核对。`
        );
      }
      afterSuccess?.(currentOperation(operationId, getRoom), result);
      render();
      return result;
    } catch (error) {
      setResult(operationId, "error", formatApiError(error, "主持操作失败"));
      return null;
    }
  }

  function submitCurrent() {
    const operation = state.hostOperation;
    if (!operation) return;
    const draft = operation.draft;
    try {
      switch (operation.kind) {
        case HOST_OPERATION_KINDS.GRANT_CLUE: {
          const clueId = requiredText(draft.clueId, "请选择线索");
          const roleSlotIds = [...new Set((draft.roleSlotIds || []).map(String).filter(Boolean))];
          if (!roleSlotIds.length) throw new Error("请至少选择一名玩家");
          if (roleSlotIds.length > HOST_OPERATION_LIMITS.CLUE_TARGETS) {
            throw new Error(`单次最多向 ${HOST_OPERATION_LIMITS.CLUE_TARGETS} 名玩家发放线索`);
          }
          void runOperation(
            () => apiRef.hostGrantClue({ clueId, roleSlotIds, message: String(draft.message || "").trim() }),
            `线索已发放给 ${roleSlotIds.length} 名玩家`
          );
          break;
        }
        case HOST_OPERATION_KINDS.GRANT_ITEM: {
          const roleSlotId = requiredText(draft.roleSlotId, "请选择目标玩家");
          const itemId = requiredText(draft.itemId, "请选择物品");
          const quantity = Math.min(99, Math.max(1, Number.parseInt(draft.quantity, 10) || 1));
          void runOperation(
            () => apiRef.hostGrantItem({ roleSlotId, itemId, quantity, message: String(draft.message || "").trim() }),
            "物品已发放"
          );
          break;
        }
        case HOST_OPERATION_KINDS.UNLOCK_SECTION: {
          const roleSlotId = requiredText(draft.roleSlotId, "请选择目标玩家");
          const scriptSectionId = requiredText(draft.sectionId, "请选择要解锁的分幕");
          void runOperation(
            () => apiRef.hostUnlockSection({ roleSlotId, scriptSectionId, message: String(draft.message || "").trim() }),
            "私人分幕已解锁"
          );
          break;
        }
        case HOST_OPERATION_KINDS.UNLOCK_SCENE: {
          const sceneId = requiredText(draft.sceneId, "请选择要开放的场景");
          void runOperation(() => apiRef.hostUnlockScene(sceneId), "公共场景已开放");
          break;
        }
        case HOST_OPERATION_KINDS.LOG: {
          const message = requiredText(draft.message, "请填写日志内容");
          if (message.length > HOST_OPERATION_LIMITS.HOST_LOG_LENGTH) {
            throw new Error(`主持日志最多 ${HOST_OPERATION_LIMITS.HOST_LOG_LENGTH} 字`);
          }
          const payload = { message, eventType: "host_note" };
          if (draft.roleSlotId) payload.roleSlotId = draft.roleSlotId;
          void runOperation(() => apiRef.hostAddLog(payload), "主持日志已写入");
          break;
        }
        case HOST_OPERATION_KINDS.NUDGE: {
          const message = requiredText(draft.message, "请填写提醒内容");
          const roleSlotIds = [...new Set((draft.roleSlotIds || []).map(String).filter(Boolean))];
          if (!roleSlotIds.length) throw new Error("请至少选择一名玩家");
          if (roleSlotIds.length > HOST_OPERATION_LIMITS.NUDGE_TARGETS) {
            throw new Error(`单次最多提醒 ${HOST_OPERATION_LIMITS.NUDGE_TARGETS} 名玩家`);
          }
          void runOperation(
            () => apiRef.hostNudgeWaiting({ message, roleSlotIds }),
            `提醒已发送给 ${roleSlotIds.length} 名玩家`,
            { refresh: "none" }
          );
          break;
        }
        case HOST_OPERATION_KINDS.CLUE_NOTE: {
          const clueId = requiredText(draft.clueId, "找不到线索");
          const roleSlotId = requiredText(draft.roleSlotId, "找不到玩家席位");
          void runOperation(
            () => apiRef.hostClueNote(clueId, { roleSlotId, hostNote: String(draft.hostNote || "") }),
            "线索主持备注已保存",
            { refresh: "matrix" }
          );
          break;
        }
        default:
          showToast("当前工作台没有可提交表单");
      }
    } catch (error) {
      operation.status = "error";
      operation.message = error.message;
      render();
    }
  }

  function detailPayload(element) {
    return {
      roleSlotId: element?.dataset?.role || state.hostOperation?.options?.roleSlotId || "",
      sectionId: element?.dataset?.section || "",
      clueId: element?.dataset?.clue || ""
    };
  }

  function executeDetailCommand(command, payload) {
    const actions = {
      "unlock-section": {
        request: () => apiRef.hostUnlockSection({ roleSlotId: payload.roleSlotId, scriptSectionId: payload.sectionId }),
        success: "私人分幕已解锁"
      },
      "skip-section": {
        request: () => apiRef.hostSkipSection({ roleSlotId: payload.roleSlotId, scriptSectionId: payload.sectionId }),
        success: "已跳过分幕并继续推进"
      },
      "relock-section": {
        request: () => apiRef.hostRelockSection({ roleSlotId: payload.roleSlotId, scriptSectionId: payload.sectionId }),
        success: "分幕访问权已撤回"
      },
      "resend-clue": {
        request: () => apiRef.hostResendClue({ roleSlotId: payload.roleSlotId, clueId: payload.clueId }),
        success: "线索已重新推送"
      },
      "revoke-clue": {
        request: () => apiRef.hostRevokeClue({ roleSlotId: payload.roleSlotId, clueId: payload.clueId }),
        success: "线索访问权已撤回"
      }
    };
    if (command === "kick-player") {
      void runOperation(
        () => apiRef.hostKickPlayer(payload.roleSlotId),
        "玩家已移出运行房",
        {
          afterSuccess(operation) {
            if (!operation) return;
            operation.detail = null;
            operation.message = "玩家已移出运行房；同账号重新选角仍可继承进度。";
          }
        }
      );
      return;
    }
    const action = actions[command];
    if (!action) {
      showToast("未知玩家干预操作");
      return;
    }
    void runOperation(action.request, action.success, { reloadPlayerDetail: true });
  }

  function requestDetailCommand(element) {
    const operation = state.hostOperation;
    if (!operation || hostOperationIsPending(operation)) return;
    const command = element?.dataset?.command || "";
    const payload = detailPayload(element);
    const confirmation = confirmationFor(command, payload, operation);
    if (confirmation) {
      operation.confirm = confirmation;
      operation.message = "";
      render();
    } else {
      executeDetailCommand(command, payload);
    }
  }

  function executeConfirmedDetailCommand() {
    const confirmation = state.hostOperation?.confirm;
    if (confirmation) executeDetailCommand(confirmation.command, confirmation.payload);
  }

  function savePlayerNotes() {
    const operation = state.hostOperation;
    if (!operation || operation.kind !== HOST_OPERATION_KINDS.PLAYER) return;
    try {
      const roleSlotId = requiredText(operation.options.roleSlotId, "找不到玩家席位");
      const notes = String(operation.draft.hostNotes || "");
      if (notes.length > HOST_OPERATION_LIMITS.PLAYER_NOTES_LENGTH) {
        throw new Error(`主持备注最多 ${HOST_OPERATION_LIMITS.PLAYER_NOTES_LENGTH} 字`);
      }
      void runOperation(
        () => apiRef.hostSaveNotes(roleSlotId, notes),
        "主持备注已保存",
        { reloadPlayerDetail: true }
      );
    } catch (error) {
      operation.status = "error";
      operation.message = error.message;
      render();
    }
  }

  return {
    executeConfirmedDetailCommand,
    requestDetailCommand,
    savePlayerNotes,
    submitCurrent
  };
}
