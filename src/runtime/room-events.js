/** Creator room SSE stream with host-overview and room-workspace reconciliation. */
import * as zhimuApi from "../api/index.js";
import { showToast, updateNotifyBadge } from "../components/toast.js";
import { uiStore, roomStore, userStore } from "../state/index.js";
import { getRuntime, go, render } from "./runtime-facade.js";
import { callView } from "./view-registry.js";
import {
  createPortalEventLifecycle,
  PORTAL_POLL_INTERVAL_MS
} from "../../shared/sse-lifecycle.js";
import {
  applySyncStatus,
  markSyncError,
  markSyncReconciled,
  readSseCursor
} from "../../shared/sync-diagnostics.js";

(function (window) {
  let roomEventStreamKey = "";
  let roomEventLifecycle = null;

  const runtime = () => getRuntime();

  async function refreshHostRuntimeSnapshot() {
    const R = runtime();
    try {
      await Promise.all([
        R.refreshHostEvents?.(false, true),
        R.refreshHostPlayers?.(false, true)
      ]);
      if (uiStore.get().view === "overview") render();
    } catch (error) {
      userStore.set({ apiError: error.message });
    }
  }

  async function refreshCreatorRoomWorkspace() {
    if (uiStore.get().view !== "rooms") return;
    try {
      await callView("rooms", "refreshRoomWorkspace");
    } catch (error) {
      userStore.set({ apiError: error.message });
    }
  }

  async function refreshActiveRoomSurface() {
    const view = uiStore.get().view;
    if (view === "overview") await refreshHostRuntimeSnapshot();
    else if (view === "rooms") await refreshCreatorRoomWorkspace();
  }

  function disconnectRoomEventStream() {
    roomEventLifecycle?.stop();
    roomEventLifecycle = null;
    roomEventStreamKey = "";
    const { roomEventsConnected } = roomStore.get();
    if (!roomEventsConnected) return;
    roomStore.set({ roomEventsConnected: false });
    if (uiStore.get().view === "overview") render();
  }

  function scheduleRoomEventReconnect() {
    roomEventLifecycle?.reconnect();
  }

  function streamUserIdForRoom() {
    return zhimuApi.context.hostUserId;
  }

  async function handleRoomEvent(type, data) {
    if (!zhimuApi.context.roomId) return;
    const R = runtime();
    const { view } = uiStore.get();

    switch (type) {
      case "room.player_joined":
        if (view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          showToast("有新玩家加入房间", 2800);
        }
        break;
      case "room.player_kicked":
        if (view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          showToast("已移出玩家", 2800);
        }
        break;
      case "room.section_completed":
      case "room.investigation_completed":
        if (view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          await R.refreshHostEvents?.(false, true);
        }
        break;
      case "room.clue_granted":
      case "room.clue_revoked":
      case "room.clue_resent":
      case "room.item_granted":
      case "room.section_unlocked":
      case "room.section_relocked":
      case "room.section_skipped":
      case "room.scene_unlocked":
        if (view === "overview") await R.refreshHostPlayers?.(false, true);
        break;
      case "room.host_event_pending":
        await R.refreshHostEvents?.(false, true);
        if (view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          if (data.action === "executed") showToast("待确认事件已执行 · 玩家端将收到解锁通知", 3200);
          else if (data.action === "dismissed") showToast("待确认事件已拒绝", 2800);
          else showToast("有新的待确认事件 · 玩家可能在等待", 3200);
        }
        break;
      case "room.host_log_created":
        if (view === "overview") await R.refreshHostRoom?.(false);
        break;
      case "room.host_player_notes_updated":
        if (view === "overview") await R.refreshHostPlayers?.(false, true);
        break;
      case "room.voice_room_created":
      case "room.voice_room_members_updated":
        if (view === "overview") await R.refreshHostRoom?.(false);
        break;
      case "room.checkpoint_restored":
        if (view === "overview" || view === "archive") {
          await R.refreshHostRoom?.(false);
          showToast("房间已从存档恢复", 2800);
        }
        break;
      case "room.content_release_changed":
        if (view === "rooms") await refreshCreatorRoomWorkspace();
        else if (view === "overview") await R.refreshHostRoom?.(false);
        showToast(`运行内容已切换到 R${Number(data.releaseNumber) || "?"}`, 3200);
        break;
      case "room.game_started":
      case "room.game_updated":
      case "room.game_completed":
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
      case "room.presentation_updated":
      case "room.discovery_updated":
      case "room.pace_clock_updated":
      case "room.conclusion_updated":
      case "room.item_action_updated":
      case "room.relationship_updated":
        if (view === "overview") await refreshHostRuntimeSnapshot();
        break;
    }
  }

  function connectRoomEventStream() {
    const roomId = zhimuApi.context.roomId;
    if (!roomId) return;
    const streamUserId = streamUserIdForRoom();
    const nextStreamKey = `${roomId}:${streamUserId || ""}`;
    if (roomEventLifecycle && roomEventStreamKey === nextStreamKey) return;
    disconnectRoomEventStream();
    roomEventStreamKey = nextStreamKey;
    roomEventLifecycle = createPortalEventLifecycle({
      pollMs: PORTAL_POLL_INTERVAL_MS.room,
      connect: ({ signal, onEvent }) => zhimuApi.streamRoomEvents(roomId, onEvent, signal, streamUserId),
      onEvent: handleRoomEvent,
      refresh: refreshActiveRoomSurface,
      onConnectionChange: (connected) => roomStore.set({ roomEventsConnected: connected }),
      onStatus: (status, meta) => {
        const current = roomStore.get().roomSyncDiagnostics;
        roomStore.set({
          roomEventsStatus: status,
          roomSyncDiagnostics: applySyncStatus(current, status, meta)
        });
        if (uiStore.get().view === "overview") render();
      },
      onReconciled: (meta) => {
        const current = roomStore.get().roomSyncDiagnostics;
        const cursor = readSseCursor(
          globalThis.localStorage,
          zhimuApi.sseCursorKey(roomId, streamUserId)
        );
        roomStore.set({
          roomSyncDiagnostics: markSyncReconciled(current, { ...meta, cursor })
        });
        if (uiStore.get().view === "overview") render();
      },
      onAuthLost: () => {
        window.zhimuSessionAuth?.markLoggedOut?.();
        showToast("登录已过期，请重新登录", 3200);
        go("overview");
      },
      onError: (error, meta) => {
        roomStore.set({
          roomSyncDiagnostics: markSyncError(roomStore.get().roomSyncDiagnostics, error, meta)
        });
        if (meta?.phase === "stream") userStore.set({ apiError: `实时同步异常：${error.message}` });
      }
    });
    roomEventLifecycle.start();
  }

  window.zhimuRoomEvents = {
    disconnectRoomEventStream,
    scheduleRoomEventReconnect,
    connectRoomEventStream,
    handleRoomEvent,
    refreshHostRuntimeSnapshot,
    refreshCreatorRoomWorkspace,
    streamUserIdForRoom
  };
})(window);
export {};
