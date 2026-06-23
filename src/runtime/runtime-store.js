/** In-room runtime payload (player, host, exploration, voice) — cleared on room/world/auth changes. */
(function (window) {
  const state = window.zhimuState;

  function clearRuntimeFields() {
    state.cloudPlayer = null;
    state.cloudHost = [];
    state.cloudHostPlayers = [];
    state.cloudHostPlayersError = "";
    state.cloudHostStuckCount = 0;
    state.cloudExploration = null;
    state.cloudHostEvents = [];
    state.cloudHostClueMatrix = null;
    state.cloudHostAuditLog = [];
    state.cloudCheckpoints = [];
    state.cloudRecaps = [];
    state.cloudRecapLatest = null;
    state.cloudRecapDetail = null;
    state.activeRecapId = null;
    state.voiceRoomId = null;
    state.voiceRoom = "尚未选择";
    state.voiceMessages = [];
    state.voiceLiveStatus = "idle";
    state.voiceMicEnabled = false;
    state.voiceParticipants = [];
    state.voiceLiveError = "";
  }

  function clearRuntimeState() {
    window.zhimuRoomEvents?.disconnectRoomEventStream?.();
    window.zhimuLiveKitVoice?.disconnectVoiceRoom?.();
    clearRuntimeFields();
  }

  function applyHostPlayersPayload(value) {
    state.cloudHostPlayers = value?.players || [];
    state.cloudHostStuckCount = value?.stuckCount || 0;
    state.cloudHostPlayersError = "";
    state.cloudHost = state.cloudHostPlayers.map((player) => ({
      role_slot_id: player.role_slot_id,
      name: player.role_name,
      total_sections: player.total_sections,
      completed_sections: player.completed_sections,
      current_scene_id: player.current_scene_id,
      updated_at: player.last_activity_at
    }));
  }

  function formatHostPlayersLoadError(error) {
    const friendly = window.zhimuUserMessages?.friendlyApiError;
    if (typeof friendly === "function") {
      return friendly({ code: error?.code, error: error?.message }, error?.message || "无法加载玩家进度");
    }
    return error?.message || "无法加载玩家进度";
  }

  function failHostPlayersLoad(error) {
    state.cloudHostPlayers = [];
    state.cloudHostStuckCount = 0;
    state.cloudHost = [];
    state.cloudHostPlayersError = formatHostPlayersLoadError(error);
  }

  window.zhimuRuntimeStore = {
    clearRuntimeFields,
    clearRuntimeState,
    applyHostPlayersPayload,
    failHostPlayersLoad,
    formatHostPlayersLoadError
  };
})(window);
export {};
