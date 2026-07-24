import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { getWorldId } from "../session.js";
import { state } from "../state.js";
import { isUncertainHostWrite } from "./host-write-reconciliation.js";
import {
  hostRoomCreateContextIsCurrent,
  hostRoomCreateIsPending,
  hostRoomCreateRequestKey,
  parseHostRoomDraft
} from "./host-room-create-model.js";

const UNCERTAIN_IDEMPOTENCY_CODES = new Set([
  "IDEMPOTENCY_IN_PROGRESS",
  "IDEMPOTENCY_UNAVAILABLE"
]);

function currentWorkspace(workspaceId, getWorld) {
  const workspace = state.hostRoomCreateWorkspace;
  if (!workspace || workspace.id !== workspaceId) return null;
  return hostRoomCreateContextIsCurrent(workspace, getWorld()) ? workspace : null;
}

function upsertRoom(room) {
  if (!room?.id) return;
  const rooms = state.rooms || [];
  const index = rooms.findIndex((item) => String(item.id) === String(room.id));
  state.rooms = index < 0
    ? [room, ...rooms]
    : rooms.map((item, itemIndex) => itemIndex === index ? room : item);
}

export function createHostRoomCreateService({
  render,
  showToast,
  apiRef = api,
  getWorld = getWorldId
}) {
  async function submit({ reconcile = false } = {}) {
    const workspace = state.hostRoomCreateWorkspace;
    if (!workspace || hostRoomCreateIsPending(workspace)) return null;
    if (!hostRoomCreateContextIsCurrent(workspace, getWorld())) {
      showToast("剧本世界已切换，请在当前剧本下重新创建运行房");
      return null;
    }
    if (workspace.status === "success" && workspace.createdRoom) return workspace.createdRoom;
    if (workspace.status === "uncertain" && !reconcile) return null;

    const parsed = parseHostRoomDraft(workspace);
    if (!parsed.ok) {
      workspace.status = "error";
      workspace.message = "运行房内容未通过服务端契约边界检查。";
      workspace.errors = parsed.errors;
      render();
      return null;
    }

    const workspaceId = workspace.id;
    const idempotencyKey = hostRoomCreateRequestKey(workspace, parsed.fingerprint);
    workspace.status = reconcile ? "reconciling" : "submitting";
    workspace.message = reconcile
      ? "正在使用原幂等键核对运行房创建结果…"
      : "正在创建运行房，请勿重复提交…";
    workspace.errors = [];
    render();

    try {
      const room = await apiRef.createRoom(
        parsed.payload,
        workspace.worldId,
        idempotencyKey
      );
      const current = currentWorkspace(workspaceId, getWorld);
      if (!current) {
        showToast("上一剧本的建房结果已返回，请勿在当前剧本重复创建");
        return room;
      }
      upsertRoom(room);
      current.createdRoom = room;
      current.status = "success";
      current.dirty = false;
      current.message = `运行房已创建，邀请码 ${room?.invite_code || "待同步"}。请确认后进入监控台。`;
      current.errors = [];
      render();

      try {
        const rooms = await apiRef.getWorldRooms(workspace.worldId);
        const latest = currentWorkspace(workspaceId, getWorld);
        if (latest) {
          state.rooms = Array.isArray(rooms) ? rooms : state.rooms;
          if (!state.rooms.some((item) => String(item.id) === String(room?.id))) upsertRoom(room);
          render();
        }
      } catch {
        const latest = currentWorkspace(workspaceId, getWorld);
        if (latest) {
          latest.message += " 服务端已确认创建，但列表刷新失败；请勿再次创建。";
          render();
        }
      }
      return room;
    } catch (error) {
      const current = currentWorkspace(workspaceId, getWorld);
      if (!current) return null;
      if (isUncertainHostWrite(error) || UNCERTAIN_IDEMPOTENCY_CODES.has(error?.code)) {
        current.status = "uncertain";
        current.message = error?.code === "IDEMPOTENCY_IN_PROGRESS"
          ? "服务器仍在处理原请求；请稍后核对，不要重新创建运行房。"
          : "创建结果暂时无法确认；恢复连接后请核对，系统会复用同一幂等键。";
        current.errors = [];
      } else {
        current.status = "error";
        current.message = formatApiError(error, "创建运行房失败");
        current.errors = error?.details?.errors || [];
      }
      render();
      return null;
    }
  }

  return {
    reconcile: () => submit({ reconcile: true }),
    submit
  };
}
