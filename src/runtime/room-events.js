/** Room SSE stream and director/player polling fallback. */
import * as zhimuApi from "../api/index.js";
import { showToast, updateNotifyBadge } from "../components/toast.js";
import { uiStore, roomStore, userStore, voiceStore } from "../state/index.js";
import { callView } from "./view-registry.js";
(function (window) {
  let directorPollTimer = null;
  let playerPollTimer = null;
  const DIRECTOR_POLL_MS = 15000;
  const PLAYER_POLL_MS = 15000;
  let roomEventAbort = null;
  let roomEventReconnectTimer = null;

  function runtime() {
    return window.zhimuRuntime || {};
  }

  function render() {
    window.zhimuRuntime?.render?.();
  }

  async function refreshPlayerHome() {
    if (!zhimuApi.context.roomId) return;
    const view = uiStore.get().view;
    try {
      roomStore.set({ cloudPlayer: await zhimuApi.getPlayerHome() });
      if (view === "player") render();
    } catch {
      /* stream refresh best-effort */
    }
  }

  async function refreshExploration() {
    if (!zhimuApi.context.roomId) return;
    const view = uiStore.get().view;
    try {
      roomStore.set({ cloudExploration: await zhimuApi.getExploration() });
      if (view === "player") render();
    } catch {
      /* stream refresh best-effort */
    }
  }

  async function refreshDirectorPoll() {
    const R = runtime();
    const view = uiStore.get().view;
    try {
      await Promise.all([
        R.refreshHostEvents?.(false, true),
        R.refreshHostPlayers?.(false, true),
        R.refreshHostClueMatrix?.(false, true)
      ]);
      if (view === "director") render();
    } catch (error) {
      userStore.set({ apiError: error.message });
    }
  }

  function syncPlayerPolling() {
    if (uiStore.get().view === "player" && zhimuApi.context.roomId) {
      if (!playerPollTimer) {
        playerPollTimer = setInterval(async () => {
          if (uiStore.get().view !== "player" || !zhimuApi.context.roomId) {
            clearInterval(playerPollTimer);
            playerPollTimer = null;
            return;
          }
          await refreshPlayerHome();
          await refreshExploration();
        }, PLAYER_POLL_MS);
      }
    } else if (playerPollTimer) {
      clearInterval(playerPollTimer);
      playerPollTimer = null;
    }
  }

  function syncDirectorPolling() {
    syncPlayerPolling();
    const { view } = uiStore.get();
    const { roomEventsConnected } = roomStore.get();
    if (roomEventsConnected) {
      if (directorPollTimer) {
        clearInterval(directorPollTimer);
        directorPollTimer = null;
      }
      return;
    }
    if (view === "director" && zhimuApi.context.roomId) {
      if (!directorPollTimer) {
        directorPollTimer = setInterval(async () => {
          if (uiStore.get().view !== "director" || !zhimuApi.context.roomId) {
            clearInterval(directorPollTimer);
            directorPollTimer = null;
            return;
          }
          await refreshDirectorPoll();
        }, DIRECTOR_POLL_MS);
      }
    } else if (directorPollTimer) {
      clearInterval(directorPollTimer);
      directorPollTimer = null;
    }
  }

  function disconnectRoomEventStream() {
    if (roomEventReconnectTimer) {
      clearTimeout(roomEventReconnectTimer);
      roomEventReconnectTimer = null;
    }
    if (roomEventAbort) {
      roomEventAbort.abort();
      roomEventAbort = null;
    }
    const { view } = uiStore.get();
    const { roomEventsConnected } = roomStore.get();
    if (roomEventsConnected) {
      roomStore.set({ roomEventsConnected: false });
      syncDirectorPolling();
      if (view === "director") render();
    }
  }

  function scheduleRoomEventReconnect() {
    if (roomEventReconnectTimer || !zhimuApi.context.roomId) return;
    roomEventReconnectTimer = setTimeout(() => {
      roomEventReconnectTimer = null;
      connectRoomEventStream();
    }, 5000);
  }

  function streamUserIdForRoom() {
    return uiStore.get().view === "player" && zhimuApi.context.playerUserId
      ? zhimuApi.context.playerUserId
      : zhimuApi.context.hostUserId;
  }

  async function handleRoomEvent(type, data) {
    if (!zhimuApi.context.roomId) return;
    const R = runtime();
    const { view } = uiStore.get();
    const { cloudPlayer } = roomStore.get();
    const { voiceRoomId } = voiceStore.get();
    switch (type) {
      case "room.player_joined":
        if (view === "director" || view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          showToast("有新玩家加入房间", 2800);
        }
        break;
      case "room.player_kicked":
        if (view === "director" || view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          showToast("已移出玩家", 2800);
        } else if (
          view === "player"
          && data.userId
          && String(data.userId) === String(zhimuApi.context.playerUserId)
        ) {
          roomStore.set({ cloudPlayer: null });
          showToast(
            data.roleName ? `你已被移出角色「${data.roleName}」` : "你已被主持人移出房间",
            3600
          );
          window.zhimuRuntime?.go?.("overview");
        }
        break;
      case "room.section_completed":
        if (view === "director" || view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          await R.refreshHostEvents?.(false, true);
        } else if (view === "player" && data.roleSlotId === cloudPlayer?.role?.id) await refreshPlayerHome();
        break;
      case "room.clue_granted":
        if (view === "director" || view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          await R.refreshHostClueMatrix?.(false, true);
        } else if (view === "player") {
          await refreshPlayerHome();
          if (data.source === "shared_room") showToast(data.clueName ? `房间内有新公开线索：${data.clueName}` : "有新的公开线索", 2800);
          else if (data.source === "shared_roles") showToast(data.clueName ? `${data.clueName} · 有玩家私享给你` : "有玩家私享线索给你", 2800);
          else showToast(data.clueName ? `获得新线索：${data.clueName}` : "获得新线索", 2800);
        }
        break;
      case "room.item_granted":
        if (view === "director" || view === "overview") await R.refreshHostPlayers?.(false, true);
        else if (view === "player") {
          await refreshPlayerHome();
          await refreshExploration();
          if (data.roleSlotId === cloudPlayer?.role?.id) showToast(data.itemName ? `获得物品：${data.itemName}` : "获得新物品", 2800);
        }
        break;
      case "room.host_event_pending":
        await R.refreshHostEvents?.(false, true);
        if (view === "director" || view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          if (data.action === "executed") {
            showToast("待确认事件已执行 · 玩家端将收到解锁通知", 3200);
          } else if (data.action === "dismissed") {
            showToast("待确认事件已拒绝", 2800);
          } else if (view === "director") {
            showToast("有新的待确认事件 · 玩家可能在等待", 3200);
          }
        } else if (view === "player") {
          await refreshPlayerHome();
          if (data.action === "executed") {
            await refreshExploration();
            showToast("主持人已确认推进 · 新内容可能已解锁", 3200);
          } else if (data.action === "dismissed") {
            showToast("主持人已处理待确认事件", 2800);
          } else if (cloudPlayer?.hostConfirm?.waitingForYou) {
            showToast("剧情推进等待主持人确认", 3200);
          }
        }
        break;
      case "room.host_nudge": {
        const roleId = cloudPlayer?.role?.id;
        const targets = data.roleSlotIds || [];
        const forMe = !targets.length || targets.some((id) => String(id) === String(roleId));
        if (view === "player" && forMe) {
          showToast(data.message || "主持人提醒你稍候", 3600);
        }
        break;
      }
      case "room.section_unlocked":
        if (view === "director" || view === "overview") await R.refreshHostPlayers?.(false, true);
        else if (view === "player") {
          await refreshPlayerHome();
          showToast("新分幕已解锁", 2800);
        }
        break;
      case "room.investigation_completed":
        if (view === "director" || view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          await R.refreshHostEvents?.(false, true);
        } else if (view === "player" && data.roleSlotId === cloudPlayer?.role?.id) {
          await refreshExploration();
          await refreshPlayerHome();
          showToast("调查点已完成 · 请查看探索页", 3200);
        }
        break;
      case "room.scene_unlocked":
        if (view === "player") {
          await refreshExploration();
          showToast("新场景已开放", 2800);
        } else if (view === "director" || view === "overview") await R.refreshHostPlayers?.(false, true);
        break;
      case "room.voice_message_created":
        if (data.voiceRoomId === voiceRoomId) {
          await window.zhimuViewLoader?.ensureViewModules?.("player");
          await callView("player", "refreshVoiceMessages");
        }
        break;
      case "room.checkpoint_restored":
        if (view === "director" || view === "overview" || view === "archive") {
          await R.refreshHostRoom?.(false);
          showToast("房间已从存档恢复", 2800);
        }
        break;
    }
  }

  function connectRoomEventStream() {
    disconnectRoomEventStream();
    const roomId = zhimuApi.context.roomId;
    if (!roomId) return;
    const boundRoom = roomId;
    roomEventAbort = new AbortController();
    const signal = roomEventAbort.signal;
    zhimuApi.streamRoomEvents(roomId, async (type, data) => {
      if (type === "__connected__") {
        roomStore.set({ roomEventsConnected: true });
        syncDirectorPolling();
        if (uiStore.get().view === "director") render();
        return;
      }
      await handleRoomEvent(type, data);
    }, signal, streamUserIdForRoom()).catch(() => {}).finally(() => {
      const shouldReconnect = roomStore.get().roomEventsConnected && zhimuApi.context.roomId === boundRoom && !signal.aborted;
      roomStore.set({ roomEventsConnected: false });
      syncDirectorPolling();
      if (shouldReconnect) scheduleRoomEventReconnect();
    });
  }

  window.zhimuRoomEvents = {
    disconnectRoomEventStream,
    scheduleRoomEventReconnect,
    connectRoomEventStream,
    handleRoomEvent,
    syncDirectorPolling,
    syncPlayerPolling,
    refreshPlayerHome,
    refreshExploration,
    refreshDirectorPoll,
    streamUserIdForRoom
  };
})(window);
export {};
