import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { getRoomId } from "../session.js";
import { state } from "../state.js";
import { refreshHostRoom } from "./data.js";
import {
  hostEventRequestKey,
  hostEventStillAvailable,
  hostEventWorkspaceContextIsCurrent,
  hostEventWorkspaceIsPending,
  parseHostEventCommand
} from "./host-event-workspace-model.js";
import { isUncertainHostWrite } from "./host-write-reconciliation.js";

const UNCERTAIN_IDEMPOTENCY_CODES = new Set([
  "IDEMPOTENCY_IN_PROGRESS",
  "IDEMPOTENCY_UNAVAILABLE"
]);

function currentWorkspace(workspaceId, getRoom) {
  const workspace = state.hostEventWorkspace;
  if (!workspace || workspace.id !== workspaceId) return null;
  return hostEventWorkspaceContextIsCurrent(workspace, getRoom()) ? workspace : null;
}

function commandLabel(command) {
  if (command === "execute") return "确认执行";
  if (command === "dismiss") return "拒绝";
  return "延迟";
}

function applyLocalCommit(workspace, command, payload) {
  state.hostEventSelection = (state.hostEventSelection || [])
    .filter((id) => String(id) !== workspace.eventId);
  if (command === "delay") {
    const delayUntil = new Date(Date.now() + payload.delayMinutes * 60_000).toISOString();
    state.cloudHostEvents = (state.cloudHostEvents || []).map((event) =>
      String(event.id) === workspace.eventId
        ? { ...event, status: "delayed", delay_until: delayUntil }
        : event
    );
    workspace.event.status = "delayed";
    workspace.event.delayUntil = delayUntil;
  } else {
    state.cloudHostEvents = (state.cloudHostEvents || [])
      .filter((event) => String(event.id) !== workspace.eventId);
  }
}

export function createHostEventWorkspaceService({
  render,
  showToast,
  apiRef = api,
  refreshRoom = refreshHostRoom,
  getRoom = getRoomId
}) {
  async function submit(command, { reconcile = false } = {}) {
    const workspace = state.hostEventWorkspace;
    if (!workspace || hostEventWorkspaceIsPending(workspace)) return null;
    if (!hostEventWorkspaceContextIsCurrent(workspace, getRoom())) {
      showToast("运行房已切换，请在当前房间重新打开事件审阅");
      return null;
    }
    if (workspace.status === "uncertain" && !reconcile) return null;
    if (!reconcile && !hostEventStillAvailable(workspace, state.cloudHostEvents || [])) {
      workspace.status = "stale";
      workspace.message = "该事件已被其他主持处理或不再属于当前待办，请刷新房间状态。";
      render();
      return null;
    }
    const parsed = parseHostEventCommand(workspace, command);
    if (!parsed.ok) {
      workspace.status = "error";
      workspace.message = "事件操作参数不符合后端边界。";
      workspace.errors = parsed.errors;
      render();
      return null;
    }

    const workspaceId = workspace.id;
    const idempotencyKey = hostEventRequestKey(workspace, command, parsed.fingerprint);
    workspace.intent = command;
    workspace.status = reconcile ? "reconciling" : "submitting";
    workspace.message = reconcile
      ? `正在使用原幂等键核对“${commandLabel(command)}”结果…`
      : `正在${commandLabel(command)}，请勿重复操作…`;
    workspace.errors = [];
    render();

    try {
      const result = command === "execute"
        ? await apiRef.executeHostEvent(workspace.eventId, workspace.roomId, idempotencyKey)
        : command === "dismiss"
          ? await apiRef.dismissHostEvent(workspace.eventId, workspace.roomId, idempotencyKey)
          : await apiRef.delayHostEvent(
            workspace.eventId,
            parsed.payload.delayMinutes,
            workspace.roomId,
            idempotencyKey
          );
      const current = currentWorkspace(workspaceId, getRoom);
      if (!current) {
        showToast("上一运行房的事件操作已返回，请勿重复执行");
        return result;
      }
      applyLocalCommit(current, command, parsed.payload);
      current.status = "success";
      current.message = command === "execute"
        ? "事件已确认并执行，关联玩家将通过实时通道接收更新。"
        : command === "dismiss"
          ? "事件已拒绝，不会执行预览中的动作。"
          : `事件已延迟 ${parsed.payload.delayMinutes} 分钟，到期后会重新进入待确认队列。`;
      current.errors = [];
      render();
      const refreshed = await refreshRoom(false);
      const latest = currentWorkspace(workspaceId, getRoom);
      if (latest && refreshed === false) {
        latest.message += " 服务器已确认写入，但房间列表刷新失败；请勿重复操作。";
        render();
      }
      return result;
    } catch (error) {
      const current = currentWorkspace(workspaceId, getRoom);
      if (!current) return null;
      if (isUncertainHostWrite(error) || UNCERTAIN_IDEMPOTENCY_CODES.has(error?.code)) {
        current.status = "uncertain";
        current.message = error?.code === "IDEMPOTENCY_IN_PROGRESS"
          ? "服务器仍在处理原操作；请稍后使用“核对操作”，不要重新点击其他命令。"
          : "操作结果暂时无法确认；请恢复服务后使用“核对操作”，系统会复用同一幂等键。";
        current.errors = [];
      } else {
        current.status = "error";
        current.message = formatApiError(error, `事件${commandLabel(command)}失败`);
        current.errors = error?.details?.errors || [];
      }
      render();
      return null;
    }
  }

  return {
    reconcile: () => {
      const command = state.hostEventWorkspace?.intent;
      return submit(command, { reconcile: true });
    },
    submit
  };
}
