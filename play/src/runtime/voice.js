import { api } from "../api.js";
import { closeModalState, openModalState } from "../components/modal.js";
import { formatApiError } from "../errors.js";
import { state } from "../state.js";

let voiceAdapterPromise = null;
let voiceRenderCallback = () => {};

function loadVoiceAdapter() {
  if (!voiceAdapterPromise) {
    voiceAdapterPromise = import("../voice/livekit-voice.js")
      .then((adapter) => {
        adapter.setVoiceRenderCallback(voiceRenderCallback);
        return adapter;
      })
      .catch((error) => {
        voiceAdapterPromise = null;
        throw error;
      });
  }
  return voiceAdapterPromise;
}

async function disconnectLoadedVoiceAdapter() {
  if (!voiceAdapterPromise) return;
  const adapter = await voiceAdapterPromise;
  await adapter.disconnectVoiceRoom();
}

export function setVoiceRenderCallback(callback) {
  voiceRenderCallback = typeof callback === "function" ? callback : () => {};
  if (voiceAdapterPromise) {
    void voiceAdapterPromise
      .then((adapter) => adapter.setVoiceRenderCallback(voiceRenderCallback))
      .catch(() => {});
  }
}

export function voiceLiveStatusLabel() {
  if (state.voiceLiveStatus === "error" && state.voiceLiveError) return state.voiceLiveError;
  if (state.voicePlaybackBlocked) return "音频已连接 · 请点击「开启扬声器」";
  return (
    {
      idle: "音频未连接",
      connecting: "正在连接 LiveKit…",
      connected: "音频已连接",
      error: "音频连接失败 · 仍可使用文字频道"
    }[state.voiceLiveStatus] || "音频未连接"
  );
}

export function ensureDefaultVoiceRoom() {
  const rooms = state.home?.voiceRooms || [];
  if (!rooms.length) {
    state.voiceRoomId = "";
    state.voiceRoomName = "";
    return;
  }
  if (state.voiceRoomId && rooms.some((r) => r.id === state.voiceRoomId)) return;
  const preferred = rooms.find((r) => r.id === state.home?.voicePolicy?.mainRoomId)
    || rooms.find((r) => r.room_type === "public")
    || rooms[0];
  state.voiceRoomId = preferred.id;
  state.voiceRoomName = preferred.name;
}

export function privateVoiceRoomsEnabled() {
  return Boolean(state.home?.voicePolicy?.privateRoomsEnabled);
}

export function voiceHubParticipants() {
  const activeRoom = (state.home?.voiceRooms || []).find((room) => room.id === state.voiceRoomId);
  const live = state.voiceParticipants || [];
  if (activeRoom?.room_type !== "public") return live;
  const liveByIdentity = new Map(live.map((participant) => [String(participant.identity), participant]));
  const roster = (state.home?.voiceRoster || []).map((member) => {
    const connected = liveByIdentity.get(String(member.user_id));
    if (connected) liveByIdentity.delete(String(member.user_id));
    const isHost = ["host", "cohost"].includes(member.member_type);
    return {
      identity: member.user_id,
      name: member.display_name || member.role_name || (isHost ? "主持人" : "玩家"),
      roleName: isHost ? (member.member_type === "cohost" ? "协主持" : "主持人") : member.role_name,
      memberType: member.member_type,
      connected: Boolean(connected),
      micEnabled: connected?.micEnabled ?? null,
      isLocal: Boolean(connected?.isLocal)
    };
  });
  return roster.concat([...liveByIdentity.values()].map((participant) => ({
    ...participant,
    connected: true
  })));
}

export async function refreshVoiceMessages(render, { silent = false } = {}) {
  if (!state.voiceRoomId) return;
  const rows = await api.getVoiceMessages(state.voiceRoomId);
  state.voiceMessages = Array.isArray(rows) ? rows : [];
  if (!silent) render();
}

export async function joinVoiceRoom(roomId, roomName, { render, setToast, connectAudio = true } = {}) {
  if (state.voiceRoomId && state.voiceRoomId !== roomId) {
    await disconnectLoadedVoiceAdapter();
  }
  state.voiceRoomId = roomId;
  state.voiceRoomName = roomName;
  state.voiceLiveError = "";
  closeModalState();
  render();
  await refreshVoiceMessages(render);

  if (!connectAudio) return;

  try {
    const tokenPayload = await api.getVoiceRoomToken(state.roomId, roomId);
    const adapter = await loadVoiceAdapter();
    await adapter.connectVoiceRoom(tokenPayload);
    setToast?.(`已进入 ${roomName} · 音频已连接`, render);
  } catch (error) {
    const message = error.message || "音频连接失败";
    setToast?.(/LiveKit|503|403|未加载|文字频道/.test(message) ? `${message}` : message, render);
  }
}

export async function connectVoiceLive({ render, setToast } = {}) {
  if (!state.voiceRoomId) {
    setToast?.("请先选择语音房", render);
    return;
  }
  try {
    state.voiceLiveError = "";
    const tokenPayload = await api.getVoiceRoomToken(state.roomId, state.voiceRoomId);
    const adapter = await loadVoiceAdapter();
    await adapter.connectVoiceRoom(tokenPayload);
    setToast?.("LiveKit 音频已连接", render);
  } catch (error) {
    const message = error.message || "音频连接失败";
    setToast?.(/LiveKit|503|403|未加载|文字频道/.test(message) ? message : message, render);
  }
}

export async function disconnectVoiceLive({ render, setToast } = {}) {
  await disconnectLoadedVoiceAdapter();
  render();
  setToast?.("已退出音频连接", render);
}

export async function toggleVoiceMicLive({ render, setToast } = {}) {
  try {
    const adapter = await loadVoiceAdapter();
    const enabled = await adapter.toggleVoiceMic();
    setToast?.(enabled ? "麦克风已开启" : "麦克风已关闭", render);
  } catch (error) {
    setToast?.(error.message || "麦克风切换失败", render);
  }
}

export async function unlockVoicePlayback({ render, setToast } = {}) {
  try {
    const adapter = await loadVoiceAdapter();
    const ok = await adapter.startVoicePlayback();
    setToast?.(ok ? "扬声器已开启" : "仍无法播放，请检查浏览器音量或权限", render);
    render?.();
  } catch (error) {
    setToast?.(error.message || "无法开启扬声器", render);
  }
}

export function openVoiceRoomPicker(render) {
  openModalState({ kind: "voice-pick", title: "选择语音空间" });
  render();
}

export function openCreateVoiceRoomModal(render) {
  state.voiceInviteUserIds = [];
  openModalState({
    kind: "voice-create",
    title: "创建临时密谈",
    initialName: "临时密谈"
  });
  state.modalDraft = "临时密谈";
  render();
}

export function openInviteVoiceRoomModal(voiceRoomId, roomName, render) {
  state.voiceInviteUserIds = [];
  openModalState({
    kind: "voice-invite",
    title: `邀请成员 · ${roomName}`,
    voiceRoomId,
    voiceRoomName: roomName
  });
  render();
}

export async function submitCreateVoiceRoom({ render, setBusy, setToast } = {}) {
  if (!privateVoiceRoomsEnabled()) {
    setToast?.("主持人正式开场后才会开放玩家密谈", render);
    return;
  }
  const name = (state.modalDraft || "").trim() || "临时密谈";
  const inviteUserIds = [...(state.voiceInviteUserIds || [])];
  setBusy(true, render);
  try {
    const created = await api.createVoiceRoom(state.roomId, {
      name,
      roomType: "invite_private",
      inviteUserIds
    });
    await pullAndResyncVoice({ render });
    closeModalState();
    await joinVoiceRoom(created.id, created.name, { render, setToast, connectAudio: true });
    setToast?.("临时密谈已创建", render);
  } catch (error) {
    setToast?.(formatApiError(error, "创建失败"), render);
  } finally {
    setBusy(false, render);
  }
}

export async function submitVoiceInvite({ render, setBusy, setToast } = {}) {
  const voiceRoomId = state.modal?.voiceRoomId;
  const inviteUserIds = [...(state.voiceInviteUserIds || [])];
  if (!voiceRoomId) return;
  if (!inviteUserIds.length) {
    setToast?.("请至少选择一名已进入房间的玩家", render);
    return;
  }
  setBusy(true, render);
  try {
    await api.inviteVoiceRoomMembers(voiceRoomId, inviteUserIds);
    closeModalState();
    await pullAndResyncVoice({ render });
    setToast?.("密谈成员已追加邀请", render);
  } catch (error) {
    setToast?.(formatApiError(error, "邀请失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function pullAndResyncVoice({ render }) {
  if (!state.roomId) return;
  const voiceSession = await api.getVoiceSession(state.roomId);
  state.home = { ...(state.home || {}), ...voiceSession };
  ensureDefaultVoiceRoom();
  render();
}

export async function sendVoiceChatMessage({ render, setToast, setBusy } = {}) {
  const body = (state.voiceChatDraft || "").trim();
  if (!body) {
    setToast?.("请输入聊天内容", render);
    return;
  }
  if (!state.voiceRoomId) {
    setToast?.("请先选择语音房", render);
    return;
  }
  if (state.busy) return;
  setBusy?.(true, render);
  try {
    await api.sendVoiceMessage(state.voiceRoomId, body);
    state.voiceChatDraft = "";
    state.voiceScrollStickBottom = true;
    await refreshVoiceMessages(render);
    setToast?.("消息已发送", render);
  } catch (error) {
    setToast?.(formatApiError(error, "发送失败"), render);
  } finally {
    setBusy?.(false, render);
  }
}

export async function pauseVoiceSession() {
  await disconnectLoadedVoiceAdapter();
}

export async function resetVoiceOnLeave() {
  await disconnectLoadedVoiceAdapter();
  state.voiceRoomId = "";
  state.voiceRoomName = "";
  state.voiceMessages = [];
  state.voiceParticipants = [];
  state.voiceLiveStatus = "idle";
  state.voiceMicEnabled = false;
  state.voicePlaybackBlocked = false;
  state.voiceLiveError = "";
  state.voiceChatDraft = "";
}
