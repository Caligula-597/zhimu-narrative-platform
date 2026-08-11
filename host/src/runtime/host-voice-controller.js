import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { state } from "../state.js";
import { refreshHostVoiceSession } from "./data.js";

let adapterPromise = null;
let renderCallback = () => {};

function loadAdapter() {
  if (!adapterPromise) {
    adapterPromise = import("../voice/livekit-voice.js").then((adapter) => {
      adapter.setHostVoiceRenderCallback(renderCallback);
      return adapter;
    }).catch((error) => {
      adapterPromise = null;
      throw error;
    });
  }
  return adapterPromise;
}

export function hostVoiceStatusLabel() {
  if (state.hostVoiceLiveError) return state.hostVoiceLiveError;
  if (state.hostVoicePlaybackBlocked) return "语音已连接 · 点击开启扬声器";
  return {
    idle: "尚未连接音频",
    connecting: "正在连接 LiveKit…",
    connected: "主持语音在线",
    error: "语音连接失败"
  }[state.hostVoiceLiveStatus] || "尚未连接音频";
}

export function hostVoiceRoster() {
  const liveById = new Map((state.hostVoiceParticipants || []).map((item) => [String(item.identity), item]));
  return (state.voiceSession?.voiceRoster || []).map((member) => {
    const live = liveById.get(String(member.user_id));
    return {
      ...member,
      name: member.display_name || member.role_name || "房间成员",
      roleLabel: ["host", "cohost"].includes(member.member_type)
        ? (member.member_type === "cohost" ? "协主持" : "主持人")
        : (member.role_name || "玩家"),
      connected: Boolean(live),
      micEnabled: live?.micEnabled ?? null
    };
  });
}

async function startSession({ render, showToast }) {
  state.hostVoiceBusy = true;
  render();
  try {
    const result = await api.startHostSession();
    if (result?.room) {
      state.room = { ...(state.room || {}), ...result.room };
      state.rooms = (state.rooms || []).map((room) => room.id === result.room.id
        ? { ...room, ...result.room }
        : room);
    }
    await refreshHostVoiceSession({ render: false });
    showToast(result?.alreadyStarted ? "本场已经正式开始" : "已正式开场 · 玩家密谈权限已开放");
  } catch (error) {
    showToast(formatApiError(error, "无法正式开场"));
  } finally {
    state.hostVoiceBusy = false;
    render();
  }
}

export function createHostVoiceActionHandler({ render, showToast }) {
  renderCallback = render;
  if (adapterPromise) void adapterPromise.then((adapter) => adapter.setHostVoiceRenderCallback(render));
  return async function handleHostVoiceAction(action) {
    if (action === "host-session-start") {
      await startSession({ render, showToast });
      return true;
    }
    if (action === "host-voice-connect") {
      if (!state.hostVoiceRoomId) {
        showToast("当前房间没有全员主语音房");
        return true;
      }
      state.hostVoiceBusy = true;
      render();
      try {
        const token = await api.getVoiceRoomToken(state.hostVoiceRoomId);
        await (await loadAdapter()).connectHostVoiceRoom(token);
        showToast("主持人已进入全员主语音房");
      } catch (error) {
        showToast(formatApiError(error, "语音连接失败"));
      } finally {
        state.hostVoiceBusy = false;
        render();
      }
      return true;
    }
    if (action === "host-voice-disconnect") {
      if (adapterPromise) await (await adapterPromise).disconnectHostVoiceRoom();
      showToast("已退出主语音房音频");
      render();
      return true;
    }
    if (action === "host-voice-mic") {
      try {
        const enabled = await (await loadAdapter()).toggleHostVoiceMic();
        showToast(enabled ? "主持麦克风已开启" : "主持麦克风已关闭");
      } catch (error) {
        showToast(formatApiError(error, "麦克风切换失败"));
      }
      return true;
    }
    if (action === "host-voice-playback") {
      try {
        await (await loadAdapter()).startHostVoicePlayback();
        showToast("扬声器已开启");
      } catch (error) {
        showToast(formatApiError(error, "无法开启扬声器"));
      }
      return true;
    }
    return false;
  };
}

export async function resetHostVoiceOnLeave() {
  if (adapterPromise) await (await adapterPromise).disconnectHostVoiceRoom();
  state.hostVoiceLiveStatus = "idle";
  state.hostVoiceMicEnabled = false;
  state.hostVoiceParticipants = [];
  state.hostVoicePlaybackBlocked = false;
  state.hostVoiceLiveError = "";
}
