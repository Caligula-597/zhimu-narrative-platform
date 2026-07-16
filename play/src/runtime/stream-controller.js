export function createPlayStreamController({
  state, render, getSessionToken, clearSession, connectRoomEvents,
  disconnectRoomEvents, connectPlatformEvents, disconnectPlatformEvents,
  refreshVoiceMessages, patchGameView, pullRoomData, coalescedPartialRefresh,
  setToast, patchGameHostBanner, normalizeMiniGame, getGamePatchCtx,
  patchSyncChromeOrRender, bumpTabPulse, loadPlazaPosts, loadPlazaThread,
  loadFriends, loadDmConversations, loadDmThread, pauseVoiceSession,
  persistRoom, isUuid
}) {
  let roomEventCtx;
  let platformEventCtx;

  function handleAuthLost() {
    clearSession();
    disconnectRoomEvents(roomEventCtx);
    disconnectPlatformEvents(platformEventCtx);
    state.user = null;
    state.home = null;
    setToast("登录已过期，请重新登录", render);
    state.view = "auth";
    render();
  }

  async function handleKicked(data) {
    disconnectRoomEvents(roomEventCtx);
    await pauseVoiceSession();
    persistRoom("", isUuid);
    state.home = null;
    state.exploration = null;
    state.view = "landing";
    const message = data?.roleName
      ? `主持人已将你移出角色「${data.roleName}」。同账号重新选角可继承进度。`
      : "主持人已将你移出房间。同账号重新选角可继承进度。";
    state.error = message;
    setToast(message, render);
    render();
  }

  roomEventCtx = {
    getView: () => state.view,
    getRoomId: () => state.roomId,
    getRoleId: () => state.home?.role?.id || "",
    getUserId: () => state.user?.id || "",
    getTab: () => state.tab,
    getVoiceRoomId: () => state.voiceRoomId || "",
    bumpTabPulse,
    onVoiceRefresh: async () => {
      try {
        state.voiceScrollStickBottom = true;
        await refreshVoiceMessages(render, { silent: true });
        if (patchGameView(state, patchContext()) !== "full") render();
      } catch {
        // Voice message refresh is best-effort; the stream reconnect path retries.
      }
    },
    onRefresh: () => coalescedPartialRefresh(),
    onToast: (message) => setToast(message, render),
    onAuthLost: handleAuthLost,
    onKicked: handleKicked,
    setHostNudge: (message) => {
      state.hostNudge = message ? { message } : null;
      if (state.view === "game" && !patchGameHostBanner()) render();
    },
    setCurrentGame: (game) => {
      state.currentGame = normalizeMiniGame(game);
      if (state.view === "game" && patchGameView(state, getGamePatchCtx()) !== "full") return;
      render();
    },
    getHostConfirmWaiting: () => Boolean(state.home?.hostConfirm?.waitingForYou),
    setStreamStatus: (status) => updateStreamState("roomEventsStatus", status),
    setConnected: (connected) => updateStreamState("roomEventsConnected", connected)
  };

  platformEventCtx = {
    hasSession: () => Boolean(getSessionToken() || state.user?.id),
    getUserId: () => state.user?.id || "",
    getView: () => state.view,
    getPlazaPostId: () => state.plazaPostId,
    getDmConversationId: () => state.dmConversationId,
    onPlazaRefresh: () => loadPlazaPosts({ silent: true }),
    onPlazaThreadRefresh: () => loadPlazaThread({ silent: true }),
    onPlazaThreadClosed: () => {
      state.view = "plaza";
      state.plazaPostId = "";
      state.plazaPostDetail = null;
      state.plazaReplies = null;
      void loadPlazaPosts({ silent: true });
      render();
    },
    onFriendsRefresh: () => loadFriends({ silent: true }),
    onMessagesRefresh: () => loadDmConversations({ silent: true }),
    onDmRefresh: () => loadDmThread({ silent: true }),
    onInGameCommRefresh: () => loadDmConversations({ silent: true }),
    onToast: (message) => setToast(message, render),
    onAuthLost: handleAuthLost,
    setStreamStatus: (status) => updateStreamState("platformEventsStatus", status),
    setConnected: (connected) => updateStreamState("platformEventsConnected", connected)
  };

  function patchContext() {
    return {
      pullRoomData: (options) => pullRoomData(options),
      onToast: (message) => setToast(message, render)
    };
  }

  function updateStreamState(field, value) {
    if (state[field] === value) return;
    state[field] = value;
    patchSyncChromeOrRender();
  }

  function syncPlatformStream() {
    if (getSessionToken() || state.user?.id) connectPlatformEvents(platformEventCtx);
    else disconnectPlatformEvents(platformEventCtx);
  }

  function syncRoomStream() {
    if (state.view === "game" && state.roomId && isUuid(state.roomId)) {
      connectRoomEvents(state.roomId, roomEventCtx);
    } else {
      disconnectRoomEvents(roomEventCtx);
    }
    syncPlatformStream();
  }

  return {
    roomEventCtx, platformEventCtx, syncPlatformStream, syncRoomStream,
    handleAuthLost, handleKicked
  };
}
