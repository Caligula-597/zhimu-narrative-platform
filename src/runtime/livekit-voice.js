/** LiveKit browser client — connect/disconnect voice rooms via server-issued tokens. */
import { uiStore, voiceStore } from "../state/index.js";

(function (window) {
  let room = null;
  let disconnecting = false;
  let livekitLoadPromise = null;
  let audioRoot = null;
  const LIVEKIT_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/livekit-client@2.15.3/dist/livekit-client.umd.min.js";

  function liveKitSdk() {
    return window.LivekitClient || window.LiveKit;
  }

  function loadLiveKitScript() {
    if (liveKitSdk()) return Promise.resolve();
    if (livekitLoadPromise) return livekitLoadPromise;
    livekitLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = LIVEKIT_SCRIPT_URL;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve();
      script.onerror = () => {
        livekitLoadPromise = null;
        reject(new Error("LiveKit 脚本加载失败"));
      };
      document.head.appendChild(script);
    });
    return livekitLoadPromise;
  }

  function syncParticipants(activeRoom) {
    if (!activeRoom) {
      voiceStore.set({ voiceParticipants: [] });
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
    voiceStore.set({ voiceParticipants: locals });
  }

  function renderIfPlayer() {
    if (uiStore.get().view === "player") window.zhimuRuntime?.render?.();
  }

  function ensureAudioRoot() {
    if (audioRoot?.isConnected) return audioRoot;
    audioRoot = document.getElementById("zhimu-voice-audio-root");
    if (!audioRoot) {
      audioRoot = document.createElement("div");
      audioRoot.id = "zhimu-voice-audio-root";
      audioRoot.hidden = true;
      audioRoot.setAttribute("aria-hidden", "true");
      document.body.appendChild(audioRoot);
    }
    return audioRoot;
  }

  function clearAudioRoot() {
    if (audioRoot) audioRoot.replaceChildren();
  }

  function attachRemoteAudioTrack(track, Track) {
    if (!track || track.kind !== Track.Kind.Audio) return;
    const root = ensureAudioRoot();
    const element = track.attach();
    if (element && !element.isConnected) root.appendChild(element);
  }

  function detachRemoteAudioTrack(track) {
    if (!track) return;
    for (const element of track.detach()) {
      element.remove();
    }
  }

  function attachExistingRemoteAudio(activeRoom, Track) {
    for (const participant of activeRoom.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.track) attachRemoteAudioTrack(publication.track, Track);
      }
    }
  }

  function wireRoomAudioPlayback(activeRoom, sdk) {
    const { RoomEvent, Track } = sdk;
    activeRoom.on(RoomEvent.TrackSubscribed, (track) => {
      attachRemoteAudioTrack(track, Track);
      renderIfPlayer();
    });
    activeRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
      detachRemoteAudioTrack(track);
      renderIfPlayer();
    });
    activeRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      voiceStore.set({ voicePlaybackBlocked: !activeRoom.canPlaybackAudio });
      renderIfPlayer();
    });
  }

  async function tryStartRoomAudio(activeRoom) {
    if (!activeRoom?.startAudio) return;
    try {
      await activeRoom.startAudio();
      voiceStore.set({ voicePlaybackBlocked: !activeRoom.canPlaybackAudio });
    } catch {
      voiceStore.set({ voicePlaybackBlocked: true });
    }
  }

  async function startVoicePlayback() {
    if (!room) return false;
    await tryStartRoomAudio(room);
    renderIfPlayer();
    return !voiceStore.get().voicePlaybackBlocked;
  }

  async function disconnectVoiceRoom() {
    if (!room || disconnecting) {
      voiceStore.set({ voiceLiveStatus: "idle", voiceMicEnabled: false, voiceParticipants: [], voiceLiveError: "" });
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
      voiceStore.set({ voiceLiveStatus: "idle", voiceMicEnabled: false, voiceParticipants: [], voiceLiveError: "", voicePlaybackBlocked: false });
      clearAudioRoot();
      renderIfPlayer();
    }
  }

  function friendlyConnectError(error) {
    const message = error?.message || String(error || "连接失败");
    if (/NotAllowedError|Permission|permission/i.test(message)) return "麦克风权限被拒绝 · 仍可使用文字频道";
    if (/NotFoundError|device/i.test(message)) return "未检测到麦克风设备 · 仍可使用文字频道";
    if (/LiveKit|token|401|403|503/i.test(message)) return message;
    return `LiveKit 连接失败：${message}`;
  }

  async function connectVoiceRoom(tokenPayload) {
    await loadLiveKitScript();
    const sdk = liveKitSdk();
    if (!sdk?.Room) {
      voiceStore.set({ voiceLiveStatus: "error", voiceLiveError: "LiveKit 客户端未加载" });
      throw new Error("LiveKit 客户端未加载，请刷新页面后重试");
    }
    if (!tokenPayload?.url || !tokenPayload?.token) {
      voiceStore.set({ voiceLiveStatus: "error", voiceLiveError: "语音 Token 无效" });
      throw new Error("语音 Token 无效，请稍后重试");
    }
    await disconnectVoiceRoom();
    voiceStore.set({ voiceLiveStatus: "connecting", voiceLiveError: "", voicePlaybackBlocked: false });
    renderIfPlayer();
    const nextRoom = new sdk.Room({
      adaptiveStream: true,
      dynacast: true
    });
    wireRoomAudioPlayback(nextRoom, sdk);
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
        voiceStore.set({ voiceLiveStatus: "idle", voiceMicEnabled: false, voiceParticipants: [] });
        renderIfPlayer();
      }
    });
    try {
      await nextRoom.connect(tokenPayload.url, tokenPayload.token);
    } catch (error) {
      voiceStore.set({ voiceLiveStatus: "error", voiceLiveError: friendlyConnectError(error) });
      renderIfPlayer();
      throw new Error(voiceStore.get().voiceLiveError);
    }
    room = nextRoom;
    voiceStore.set({ voiceLiveStatus: "connected" });
    try {
      await nextRoom.localParticipant.setMicrophoneEnabled(true);
      voiceStore.set({ voiceMicEnabled: nextRoom.localParticipant.isMicrophoneEnabled });
    } catch (error) {
      voiceStore.set({ voiceMicEnabled: false, voiceLiveError: friendlyConnectError(error) });
    }
    attachExistingRemoteAudio(nextRoom, sdk.Track);
    await tryStartRoomAudio(nextRoom);
    syncParticipants(nextRoom);
    renderIfPlayer();
    return nextRoom;
  }

  async function toggleVoiceMic() {
    if (!room?.localParticipant) return false;
    const enabled = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(enabled);
    voiceStore.set({ voiceMicEnabled: enabled });
    syncParticipants(room);
    renderIfPlayer();
    return enabled;
  }

  window.zhimuLiveKitVoice = {
    connectVoiceRoom,
    disconnectVoiceRoom,
    toggleVoiceMic,
    startVoicePlayback,
    isConnected: () => Boolean(room)
  };
})(window);
export {};
