/** Room SSE stream and director/player polling fallback. */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const T = window.zhimuToast || {};
  const V = window.zhimuViews || {};
  const showToast = T.showToast || (() => {});
  const updateNotifyBadge = T.updateNotifyBadge || (() => {});

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
    window.zhimuRender?.();
  }

  async function refreshPlayerHome() {
    if (!zhimuApi.context.roomId) return;
    try {
      state.cloudPlayer = await zhimuApi.getPlayerHome();
      if (state.view === "player") render();
    } catch {
      /* stream refresh best-effort */
    }
  }

  async function refreshExploration() {
    if (!zhimuApi.context.roomId) return;
    try {
      state.cloudExploration = await zhimuApi.getExploration();
      if (state.view === "player") render();
    } catch {
      /* stream refresh best-effort */
    }
  }

  async function refreshDirectorPoll() {
    const R = runtime();
    try {
      await Promise.all([
        R.refreshHostEvents?.(false, true),
        R.refreshHostPlayers?.(false, true),
        R.refreshHostClueMatrix?.(false, true)
      ]);
      if (state.view === "director") render();
    } catch (error) {
      state.apiError = error.message;
    }
  }

  function syncPlayerPolling() {
    if (state.view === "player" && zhimuApi.context.roomId) {
      if (!playerPollTimer) {
        playerPollTimer = setInterval(async () => {
          if (state.view !== "player" || !zhimuApi.context.roomId) {
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
    if (state.roomEventsConnected) {
      if (directorPollTimer) {
        clearInterval(directorPollTimer);
        directorPollTimer = null;
      }
      return;
    }
    if (state.view === "director" && zhimuApi.context.roomId) {
      if (!directorPollTimer) {
        directorPollTimer = setInterval(async () => {
          if (state.view !== "director" || !zhimuApi.context.roomId) {
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
    if (state.roomEventsConnected) {
      state.roomEventsConnected = false;
      syncDirectorPolling();
      if (state.view === "director") render();
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
    return state.view === "player" && zhimuApi.context.playerUserId
      ? zhimuApi.context.playerUserId
      : zhimuApi.context.hostUserId;
  }

  async function handleRoomEvent(type, data) {
    if (!zhimuApi.context.roomId) return;
    const R = runtime();
    switch (type) {
      case "room.player_joined":
        if (state.view === "director" || state.view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          showToast("有新玩家加入房间", 2800);
        }
        break;
      case "room.section_completed":
        if (state.view === "director" || state.view === "overview") await R.refreshHostPlayers?.(false, true);
        else if (state.view === "player" && data.roleSlotId === state.cloudPlayer?.role?.id) await refreshPlayerHome();
        break;
      case "room.clue_granted":
        if (state.view === "director" || state.view === "overview") {
          await R.refreshHostPlayers?.(false, true);
          await R.refreshHostClueMatrix?.(false, true);
        } else if (state.view === "player") {
          await refreshPlayerHome();
          if (data.source === "shared_room") showToast(data.clueName ? `房间内有新公开线索：${data.clueName}` : "有新的公开线索", 2800);
          else if (data.source === "shared_roles") showToast(data.clueName ? `${data.clueName} · 有玩家私享给你` : "有玩家私享线索给你", 2800);
          else showToast(data.clueName ? `获得新线索：${data.clueName}` : "获得新线索", 2800);
        }
        break;
      case "room.item_granted":
        if (state.view === "director" || state.view === "overview") await R.refreshHostPlayers?.(false, true);
        else if (state.view === "player") {
          await refreshPlayerHome();
          await refreshExploration();
          if (data.roleSlotId === state.cloudPlayer?.role?.id) showToast(data.itemName ? `获得物品：${data.itemName}` : "获得新物品", 2800);
        }
        break;
      case "room.host_event_pending":
        await R.refreshHostEvents?.(false, true);
        if (state.view === "player" && data.action === "executed") {
          await refreshPlayerHome();
          await refreshExploration();
        }
        if (!data.action && state.view === "director") showToast("有新的待确认事件", 2800);
        break;
      case "room.scene_unlocked":
        if (state.view === "player") {
          await refreshExploration();
          showToast("新场景已开放", 2800);
        } else if (state.view === "director" || state.view === "overview") await R.refreshHostPlayers?.(false, true);
        break;
      case "room.voice_message_created":
        if (data.voiceRoomId === state.voiceRoomId) await (V.player?.refreshVoiceMessages || (async () => {}))();
        break;
      case "room.checkpoint_restored":
        if (state.view === "director" || state.view === "overview" || state.view === "archive") {
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
        state.roomEventsConnected = true;
        syncDirectorPolling();
        if (state.view === "director") render();
        return;
      }
      await handleRoomEvent(type, data);
    }, signal, streamUserIdForRoom()).catch(() => {}).finally(() => {
      const shouldReconnect = state.roomEventsConnected && zhimuApi.context.roomId === boundRoom && !signal.aborted;
      state.roomEventsConnected = false;
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
