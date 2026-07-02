/** In-room runtime payload (player, host, exploration, voice) cleared on room/world/auth changes. */
import { roomStore, voiceStore } from "../state/index.js";

export function clearRuntimeFields() {
  roomStore.set({
    cloudPlayer: null,
    cloudHost: [],
    cloudHostPlayers: [],
    cloudHostPlayersError: "",
    cloudHostStuckCount: 0,
    cloudExploration: null,
    cloudHostEvents: [],
    cloudHostClueMatrix: null,
    cloudHostAuditLog: [],
    cloudCheckpoints: [],
    cloudRecaps: [],
    cloudRecapLatest: null,
    cloudRecapDetail: null,
    activeRecapId: null
  });
  voiceStore.set({
    voiceRoomId: null,
    voiceRoom: "尚未选择",
    voiceMessages: [],
    voiceLiveStatus: "idle",
    voiceMicEnabled: false,
    voiceParticipants: [],
    voiceLiveError: ""
  });
}

export function clearRuntimeState() {
  window.zhimuRoomEvents?.disconnectRoomEventStream?.();
  window.zhimuLiveKitVoice?.disconnectVoiceRoom?.();
  clearRuntimeFields();
}

export function applyHostPlayersPayload(value) {
  const cloudHostPlayers = value?.players || [];
  roomStore.set({
    cloudHostPlayers,
    cloudHostStuckCount: value?.stuckCount || 0,
    cloudHostPlayersError: "",
    cloudHost: cloudHostPlayers.map((player) => ({
      role_slot_id: player.role_slot_id,
      name: player.role_name,
      total_sections: player.total_sections,
      completed_sections: player.completed_sections,
      current_scene_id: player.current_scene_id,
      updated_at: player.last_activity_at
    }))
  });
}

export function formatHostPlayersLoadError(error) {
  const friendly = window.zhimuUserMessages?.friendlyApiError;
  if (typeof friendly === "function") {
    return friendly({ code: error?.code, error: error?.message }, error?.message || "无法加载玩家进度");
  }
  return error?.message || "无法加载玩家进度";
}

export function failHostPlayersLoad(error) {
  roomStore.set({
    cloudHostPlayers: [],
    cloudHostStuckCount: 0,
    cloudHost: [],
    cloudHostPlayersError: formatHostPlayersLoadError(error)
  });
}
