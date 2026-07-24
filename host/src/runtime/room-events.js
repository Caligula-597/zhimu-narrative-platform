import { api, clearSession } from "../api.js";
import { getRoomId } from "../session.js";
import { state } from "../state.js";
import { createSseLifecycle } from "../../../shared/sse-lifecycle.js";
import {
  refreshHostClueMatrix,
  refreshHostEvents,
  refreshHostPlayers,
  refreshHostRoom
} from "./data.js";
import { applyHostMiniGameEvent } from "./host-mini-game-controller.js";

const DIRECTOR_POLL_MS = 15000;
let lifecycle = null;

let renderRef = () => {};
let showToastRef = (_msg, _ms) => {};

export function bindRoomEventsContext({ render, showToast }) {
  renderRef = render;
  showToastRef = showToast;
}

function render() {
  renderRef();
}

function showToast(message, ms) {
  showToastRef(message, ms);
}

async function refreshOpenPlayerOperation(roleSlotId = "") {
  const operation = state.hostOperation;
  if (operation?.kind !== "player" || !operation.options?.roleSlotId) return;
  if (roleSlotId && String(roleSlotId) !== String(operation.options.roleSlotId)) return;
  const operationId = operation.id;
  try {
    const detail = await api.getHostPlayerDetail(operation.options.roleSlotId);
    if (state.hostOperation?.id !== operationId) return;
    state.hostOperation.detail = detail;
    if (state.hostOperation.status !== "submitting") {
      state.hostOperation.status = "ready";
      state.hostOperation.message = "玩家状态已通过实时事件更新。";
    }
    render();
  } catch {
    // The regular 15s reconcile remains authoritative if a detail refresh races a room change.
  }
}

function markOpenPlayerRemoved(roleSlotId = "") {
  const operation = state.hostOperation;
  if (operation?.kind !== "player") return;
  if (roleSlotId && String(roleSlotId) !== String(operation.options?.roleSlotId)) return;
  operation.detail = null;
  operation.status = "success";
  operation.message = "该玩家已离开当前角色席位；历史进度仍保留在房间记录中。";
  render();
}

async function refreshDirectorPoll() {
  try {
    await refreshHostRoom(false);
    if (state.view === "console") render();
  } catch (error) {
    state.apiError = error.message;
  }
}

export function syncDirectorPolling() {
  if (state.view === "console" && getRoomId() && !lifecycle) connectRoomEvents();
  if ((state.view !== "console" || !getRoomId()) && lifecycle) disconnectRoomEvents();
}

export function disconnectRoomEvents() {
  lifecycle?.stop();
  lifecycle = null;
  if (state.roomEventsConnected) {
    state.roomEventsConnected = false;
    if (state.view === "console") render();
  }
}

async function handleRoomEvent(type, data) {
  if (!getRoomId()) return;
  switch (type) {
    case "room.player_joined":
      await refreshHostPlayers(false, true);
      await refreshOpenPlayerOperation(data.roleSlotId);
      showToast("有新玩家加入房间", 2800);
      break;
    case "room.player_kicked":
      await refreshHostPlayers(false, true);
      markOpenPlayerRemoved(data.roleSlotId);
      showToast("已移出玩家", 2800);
      break;
    case "room.section_completed":
      await refreshHostPlayers(false, true);
      await refreshHostEvents(false, true);
      break;
    case "room.clue_granted":
    case "room.clue_revoked":
    case "room.clue_resent":
      await refreshHostPlayers(false, true);
      await refreshHostClueMatrix(false, true);
      await refreshOpenPlayerOperation(data.roleSlotId);
      break;
    case "room.item_granted":
      await refreshHostPlayers(false, true);
      await refreshOpenPlayerOperation(data.roleSlotId);
      break;
    case "room.host_event_pending":
      await refreshHostEvents(false, true);
      await refreshHostPlayers(false, true);
      if (data.action === "executed") showToast("待确认事件已执行 · 玩家端将收到解锁通知", 3200);
      else if (data.action === "dismissed") showToast("待确认事件已拒绝", 2800);
      else showToast("有新的待确认事件 · 玩家可能在等待", 3200);
      break;
    case "room.section_unlocked":
    case "room.section_relocked":
    case "room.section_skipped":
    case "room.scene_unlocked":
      await refreshHostPlayers(false, true);
      if (type !== "room.scene_unlocked") await refreshOpenPlayerOperation(data.roleSlotId);
      break;
    case "room.investigation_completed":
      await refreshHostPlayers(false, true);
      await refreshHostEvents(false, true);
      await refreshOpenPlayerOperation(data.roleSlotId);
      break;
    case "room.game_started":
      applyHostMiniGameEvent(type, data);
      showToast("小游戏已同步到玩家端", 2800);
      render();
      break;
    case "room.game_updated":
      applyHostMiniGameEvent(type, data);
      showToast(data.correct ? "玩家已解开小游戏" : "玩家提交了答案，剩余次数已更新", 2400);
      render();
      break;
    case "room.game_completed":
      applyHostMiniGameEvent(type, data);
      showToast(data.correct === false ? "小游戏尝试次数已耗尽" : "小游戏已完成", 2800);
      render();
      break;
    case "room.checkpoint_restored":
      await refreshHostRoom(false);
      showToast("房间已从存档恢复", 2800);
      break;
    case "room.vote_created":
    case "room.vote_updated":
    case "room.private_action_submitted":
    case "room.private_action_updated":
    case "room.role_state_updated":
    case "room.player_task_completed":
    case "room.testimony_submitted":
    case "room.segment_remedy_applied":
    case "room.physical_token_activated":
    case "room.physical_token_event":
    case "room.voice_message_created":
    case "room.host_nudge":
    case "room.host_log_created":
    case "room.host_player_notes_updated":
      await refreshHostRoom(false);
      if (type === "room.host_player_notes_updated") {
        await refreshOpenPlayerOperation(data.roleSlotId);
      }
      break;
    default:
      break;
  }
}

export function connectRoomEvents() {
  disconnectRoomEvents();
  const roomId = getRoomId();
  if (!roomId) return;
  lifecycle = createSseLifecycle({
    pollMs: DIRECTOR_POLL_MS,
    open: ({ signal, onConnected }) => api.streamRoomEvents(roomId, async (type, payload) => {
      if (type === "__connected__") return onConnected(payload);
      await handleRoomEvent(type, payload);
    }, signal, state.user?.id),
    poll: () => state.view === "console" && getRoomId() === roomId ? refreshDirectorPoll() : undefined,
    reconcile: () => refreshDirectorPoll(),
    onStatus: (status) => {
      state.roomEventsStatus = status === "connected" ? "live" : status;
      if (state.view === "console") render();
    },
    onConnected: () => {
      state.roomEventsConnected = true;
      if (state.view === "console") render();
    },
    onDisconnected: () => {
      state.roomEventsConnected = false;
      if (state.view === "console") render();
    },
    onAuthLost: () => {
      clearSession();
      state.user = null;
      state.authStatus = "anonymous";
      state.view = "auth";
      showToast("登录已过期，请重新登录", 3200);
      render();
    },
    onError: (error, meta) => {
      state.apiError = meta?.phase === "stream" ? `实时同步异常：${error.message}` : state.apiError;
    }
  });
  lifecycle.start();
}

export function syncRoomStream() {
  if (state.view === "console" && getRoomId()) connectRoomEvents();
  else disconnectRoomEvents();
}
