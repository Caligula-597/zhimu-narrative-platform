/** LiveKit browser client — connect/disconnect voice rooms via server-issued tokens. */
(function (window) {
  const state = window.zhimuState;
  let room = null;
  let disconnecting = false;

  function liveKitSdk() {
    return window.LivekitClient || window.LiveKit;
  }

  function syncParticipants(activeRoom) {
    if (!activeRoom) {
      state.voiceParticipants = [];
      return;
    }
    const locals = [];
    const seen = new Set();
    for (const participant of activeRoom.remoteParticipants.values()) {
      if (seen.has(participant.identity)) continue;
      seen.add(participant.identity);
      locals.push({
        identity: participant.identity,
        name: participant.name || participant.identity,
        isLocal: false,
        micEnabled: participant.isMicrophoneEnabled
      });
    }
    const local = activeRoom.localParticipant;
    if (local) {
      locals.unshift({
        identity: local.identity,
        name: local.name || local.identity,
        isLocal: true,
        micEnabled: local.isMicrophoneEnabled
      });
    }
    state.voiceParticipants = locals;
  }

  function renderIfPlayer() {
    if (state.view === "player") window.zhimuRender?.();
  }

  async function disconnectVoiceRoom() {
    if (!room || disconnecting) {
      state.voiceLiveStatus = "idle";
      state.voiceMicEnabled = false;
      state.voiceParticipants = [];
      return;
    }
    disconnecting = true;
    const current = room;
    room = null;
    try {
      await current.disconnect();
    } catch {
      /* best effort */
    } finally {
      disconnecting = false;
      state.voiceLiveStatus = "idle";
      state.voiceMicEnabled = false;
      state.voiceParticipants = [];
      renderIfPlayer();
    }
  }

  async function connectVoiceRoom(tokenPayload) {
    const sdk = liveKitSdk();
    if (!sdk?.Room) {
      state.voiceLiveStatus = "error";
      throw new Error("LiveKit 客户端未加载，请刷新页面后重试");
    }
    await disconnectVoiceRoom();
    state.voiceLiveStatus = "connecting";
    renderIfPlayer();
    const nextRoom = new sdk.Room({
      adaptiveStream: true,
      dynacast: true
    });
    nextRoom.on(sdk.RoomEvent.ParticipantConnected, () => {
      syncParticipants(nextRoom);
      renderIfPlayer();
    });
    nextRoom.on(sdk.RoomEvent.ParticipantDisconnected, () => {
      syncParticipants(nextRoom);
      renderIfPlayer();
    });
    nextRoom.on(sdk.RoomEvent.TrackMuted, () => {
      syncParticipants(nextRoom);
      renderIfPlayer();
    });
    nextRoom.on(sdk.RoomEvent.TrackUnmuted, () => {
      syncParticipants(nextRoom);
      renderIfPlayer();
    });
    nextRoom.on(sdk.RoomEvent.Disconnected, () => {
      if (room === nextRoom) {
        room = null;
        state.voiceLiveStatus = "idle";
        state.voiceMicEnabled = false;
        state.voiceParticipants = [];
        renderIfPlayer();
      }
    });
    await nextRoom.connect(tokenPayload.url, tokenPayload.token);
    await nextRoom.localParticipant.setMicrophoneEnabled(true);
    room = nextRoom;
    state.voiceLiveStatus = "connected";
    state.voiceMicEnabled = nextRoom.localParticipant.isMicrophoneEnabled;
    syncParticipants(nextRoom);
    renderIfPlayer();
    return nextRoom;
  }

  async function toggleVoiceMic() {
    if (!room?.localParticipant) return false;
    const enabled = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(enabled);
    state.voiceMicEnabled = enabled;
    syncParticipants(room);
    renderIfPlayer();
    return enabled;
  }

  window.zhimuLiveKitVoice = {
    connectVoiceRoom,
    disconnectVoiceRoom,
    toggleVoiceMic,
    isConnected: () => Boolean(room)
  };
})(window);
export {};
