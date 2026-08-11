/** Host LiveKit browser client. Loaded only when the host connects audio. */
import { state } from "../state.js";

let room = null;
let disconnecting = false;
let renderCallback = () => {};
let livekitImport = null;
let audioRoot = null;

export function setHostVoiceRenderCallback(callback) {
  renderCallback = typeof callback === "function" ? callback : () => {};
}

async function loadLiveKit() {
  if (!livekitImport) livekitImport = import("livekit-client");
  return livekitImport;
}

function ensureAudioRoot() {
  if (audioRoot?.isConnected) return audioRoot;
  audioRoot = document.getElementById("zhimu-host-voice-audio-root");
  if (!audioRoot) {
    audioRoot = document.createElement("div");
    audioRoot.id = "zhimu-host-voice-audio-root";
    audioRoot.hidden = true;
    audioRoot.setAttribute("aria-hidden", "true");
    document.body.appendChild(audioRoot);
  }
  return audioRoot;
}

function attachAudioTrack(track, Track) {
  if (!track || track.kind !== Track.Kind.Audio) return;
  const element = track.attach();
  if (element && !element.isConnected) ensureAudioRoot().appendChild(element);
}

function syncParticipants(activeRoom) {
  const participants = [];
  if (activeRoom?.localParticipant) {
    participants.push({
      identity: activeRoom.localParticipant.identity,
      name: activeRoom.localParticipant.name || activeRoom.localParticipant.identity,
      isLocal: true,
      micEnabled: activeRoom.localParticipant.isMicrophoneEnabled
    });
  }
  for (const participant of activeRoom?.remoteParticipants?.values?.() || []) {
    participants.push({
      identity: participant.identity,
      name: participant.name || participant.identity,
      isLocal: false,
      micEnabled: participant.isMicrophoneEnabled
    });
  }
  state.hostVoiceParticipants = participants;
}

function friendlyError(error) {
  const message = error?.message || String(error || "连接失败");
  if (/NotAllowedError|Permission|permission/i.test(message)) return "麦克风权限被拒绝";
  if (/NotFoundError|device/i.test(message)) return "未检测到麦克风设备";
  return /LiveKit|token|401|403|503/i.test(message) ? message : `LiveKit 连接失败：${message}`;
}

export async function disconnectHostVoiceRoom() {
  if (!room || disconnecting) {
    state.hostVoiceLiveStatus = "idle";
    state.hostVoiceMicEnabled = false;
    state.hostVoiceParticipants = [];
    state.hostVoiceLiveError = "";
    return;
  }
  disconnecting = true;
  const current = room;
  room = null;
  try {
    await current.disconnect();
  } catch {
    // Best-effort cleanup on room changes and logout.
  } finally {
    disconnecting = false;
    state.hostVoiceLiveStatus = "idle";
    state.hostVoiceMicEnabled = false;
    state.hostVoiceParticipants = [];
    state.hostVoicePlaybackBlocked = false;
    state.hostVoiceLiveError = "";
    audioRoot?.replaceChildren();
    renderCallback();
  }
}

export async function connectHostVoiceRoom(tokenPayload) {
  if (!tokenPayload?.url || !tokenPayload?.token) throw new Error("语音 Token 无效，请稍后重试");
  const { Room, RoomEvent, Track } = await loadLiveKit();
  await disconnectHostVoiceRoom();
  state.hostVoiceLiveStatus = "connecting";
  state.hostVoiceLiveError = "";
  renderCallback();
  const nextRoom = new Room({ adaptiveStream: true, dynacast: true });
  const rerender = () => {
    syncParticipants(nextRoom);
    renderCallback();
  };
  nextRoom.on(RoomEvent.TrackSubscribed, (track) => attachAudioTrack(track, Track));
  nextRoom.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((element) => element.remove()));
  nextRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => {
    state.hostVoicePlaybackBlocked = !nextRoom.canPlaybackAudio;
    renderCallback();
  });
  nextRoom.on(RoomEvent.ParticipantConnected, rerender);
  nextRoom.on(RoomEvent.ParticipantDisconnected, rerender);
  nextRoom.on(RoomEvent.TrackMuted, rerender);
  nextRoom.on(RoomEvent.TrackUnmuted, rerender);
  nextRoom.on(RoomEvent.Disconnected, () => {
    if (room !== nextRoom) return;
    room = null;
    state.hostVoiceLiveStatus = "idle";
    state.hostVoiceMicEnabled = false;
    state.hostVoiceParticipants = [];
    renderCallback();
  });
  try {
    await nextRoom.connect(tokenPayload.url, tokenPayload.token);
  } catch (error) {
    state.hostVoiceLiveStatus = "error";
    state.hostVoiceLiveError = friendlyError(error);
    renderCallback();
    throw new Error(state.hostVoiceLiveError);
  }
  room = nextRoom;
  state.hostVoiceLiveStatus = "connected";
  try {
    await nextRoom.localParticipant.setMicrophoneEnabled(true);
    state.hostVoiceMicEnabled = nextRoom.localParticipant.isMicrophoneEnabled;
  } catch (error) {
    state.hostVoiceMicEnabled = false;
    state.hostVoiceLiveError = friendlyError(error);
  }
  for (const participant of nextRoom.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      if (publication.track) attachAudioTrack(publication.track, Track);
    }
  }
  try {
    await nextRoom.startAudio?.();
    state.hostVoicePlaybackBlocked = !nextRoom.canPlaybackAudio;
  } catch {
    state.hostVoicePlaybackBlocked = true;
  }
  syncParticipants(nextRoom);
  renderCallback();
}

export async function toggleHostVoiceMic() {
  if (!room?.localParticipant) return false;
  const enabled = !room.localParticipant.isMicrophoneEnabled;
  await room.localParticipant.setMicrophoneEnabled(enabled);
  state.hostVoiceMicEnabled = enabled;
  syncParticipants(room);
  renderCallback();
  return enabled;
}

export async function startHostVoicePlayback() {
  if (!room?.startAudio) return false;
  await room.startAudio();
  state.hostVoicePlaybackBlocked = !room.canPlaybackAudio;
  renderCallback();
  return !state.hostVoicePlaybackBlocked;
}
