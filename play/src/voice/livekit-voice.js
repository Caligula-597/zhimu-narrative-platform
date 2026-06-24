/**
 * LiveKit browser client — lazy-loaded npm bundle (no CDN).
 */
import { state } from "../state.js";

let room = null;
let disconnecting = false;
let renderCallback = () => {};
/** @type {Promise<typeof import("livekit-client")> | null} */
let livekitImport = null;
let audioRoot = null;

export function setVoiceRenderCallback(cb) {
  renderCallback = typeof cb === "function" ? cb : () => {};
}

async function loadLiveKit() {
  if (!livekitImport) livekitImport = import("livekit-client");
  return livekitImport;
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

function wireRoomAudioPlayback(activeRoom, RoomEvent, Track) {
  activeRoom.on(RoomEvent.TrackSubscribed, (track) => {
    attachRemoteAudioTrack(track, Track);
    renderCallback();
  });
  activeRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
    detachRemoteAudioTrack(track);
    renderCallback();
  });
  activeRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => {
    state.voicePlaybackBlocked = !activeRoom.canPlaybackAudio;
    renderCallback();
  });
}

async function tryStartRoomAudio(activeRoom) {
  if (!activeRoom?.startAudio) return;
  try {
    await activeRoom.startAudio();
    state.voicePlaybackBlocked = !activeRoom.canPlaybackAudio;
  } catch {
    state.voicePlaybackBlocked = true;
  }
}

export async function startVoicePlayback() {
  if (!room) return false;
  await tryStartRoomAudio(room);
  renderCallback();
  return !state.voicePlaybackBlocked;
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

function friendlyConnectError(error) {
  const message = error?.message || String(error || "连接失败");
  if (/NotAllowedError|Permission|permission/i.test(message)) {
    return "麦克风权限被拒绝 · 仍可使用文字频道";
  }
  if (/NotFoundError|device/i.test(message)) {
    return "未检测到麦克风设备 · 仍可使用文字频道";
  }
  if (/LiveKit|token|401|403|503/i.test(message)) return message;
  return `LiveKit 连接失败：${message}`;
}

export async function disconnectVoiceRoom() {
  if (!room || disconnecting) {
    state.voiceLiveStatus = "idle";
    state.voiceMicEnabled = false;
    state.voiceParticipants = [];
    state.voiceLiveError = "";
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
    state.voiceLiveError = "";
    state.voicePlaybackBlocked = false;
    clearAudioRoot();
    renderCallback();
  }
}

export async function connectVoiceRoom(tokenPayload) {
  if (!tokenPayload?.url || !tokenPayload?.token) {
    state.voiceLiveStatus = "error";
    state.voiceLiveError = "语音 Token 无效";
    throw new Error("语音 Token 无效，请稍后重试");
  }
  const { Room, RoomEvent, Track } = await loadLiveKit();
  await disconnectVoiceRoom();
  state.voiceLiveStatus = "connecting";
  state.voiceLiveError = "";
  state.voicePlaybackBlocked = false;
  renderCallback();

  const nextRoom = new Room({ adaptiveStream: true, dynacast: true });
  wireRoomAudioPlayback(nextRoom, RoomEvent, Track);
  const rerender = () => {
    syncParticipants(nextRoom);
    renderCallback();
  };
  nextRoom.on(RoomEvent.ParticipantConnected, rerender);
  nextRoom.on(RoomEvent.ParticipantDisconnected, rerender);
  nextRoom.on(RoomEvent.TrackMuted, rerender);
  nextRoom.on(RoomEvent.TrackUnmuted, rerender);
  nextRoom.on(RoomEvent.Disconnected, () => {
    if (room === nextRoom) {
      room = null;
      state.voiceLiveStatus = "idle";
      state.voiceMicEnabled = false;
      state.voiceParticipants = [];
      renderCallback();
    }
  });

  try {
    await nextRoom.connect(tokenPayload.url, tokenPayload.token);
  } catch (error) {
    state.voiceLiveStatus = "error";
    state.voiceLiveError = friendlyConnectError(error);
    renderCallback();
    throw new Error(state.voiceLiveError);
  }

  room = nextRoom;
  state.voiceLiveStatus = "connected";
  try {
    await nextRoom.localParticipant.setMicrophoneEnabled(true);
    state.voiceMicEnabled = nextRoom.localParticipant.isMicrophoneEnabled;
  } catch (error) {
    state.voiceMicEnabled = false;
    state.voiceLiveError = friendlyConnectError(error);
  }
  attachExistingRemoteAudio(nextRoom, Track);
  await tryStartRoomAudio(nextRoom);
  syncParticipants(nextRoom);
  renderCallback();
  return nextRoom;
}

export async function toggleVoiceMic() {
  if (!room?.localParticipant) return false;
  const enabled = !room.localParticipant.isMicrophoneEnabled;
  await room.localParticipant.setMicrophoneEnabled(enabled);
  state.voiceMicEnabled = enabled;
  syncParticipants(room);
  renderCallback();
  return enabled;
}

export function isVoiceConnected() {
  return Boolean(room);
}
