/** Creator in-room runtime payload cleared on room/world/auth changes. */
import { roomStore } from "../state/index.js";
import { friendlyApiError } from "../utils/user-messages.js";

export function clearRuntimeFields() {
  roomStore.set({
    cloudHost: [],
    cloudHostPlayers: [],
    cloudHostPlayersError: "",
    cloudHostStuckCount: 0,
    cloudHostEvents: [],
    cloudCheckpoints: [],
    cloudRecaps: [],
    cloudRecapLatest: null,
    cloudRecapDetail: null,
    activeRecapId: null
  });
}

export function clearRuntimeState() {
  window.zhimuRoomEvents?.disconnectRoomEventStream?.();
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
  return friendlyApiError({ code: error?.code, error: error?.message }, error?.message || "无法加载玩家进度");
}

export function failHostPlayersLoad(error) {
  roomStore.set({
    cloudHostPlayers: [],
    cloudHostStuckCount: 0,
    cloudHost: [],
    cloudHostPlayersError: formatHostPlayersLoadError(error)
  });
}
