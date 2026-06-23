/**
 * Coordinates auth / world / room context resets so demo, login, and runtime state stay in sync.
 * Call these instead of scattering zhimuApi + state mutations across views.
 */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;

  function clearWorldScopedState() {
    state.cloudStudio = null;
    state.cloudRules = [];
    state.cloudCreatorChecks = [];
    state.cloudHost = [];
    state.cloudHostPlayers = [];
    state.cloudHostPlayersError = "";
    state.cloudHostStuckCount = 0;
    state.cloudHostEvents = [];
    state.cloudHostAuditLog = [];
    state.cloudCheckpoints = [];
    state.cloudRecaps = [];
    state.cloudRecapLatest = null;
    state.cloudRecapDetail = null;
    state.activeRecapId = null;
    state.cloudWorldLogs = [];
    state.cloudPlayer = null;
    state.cloudExploration = null;
    state.cloudAssets = [];
    state.storageUsage = null;
    state.apiError = "";
  }

  /** After login / register / OAuth — drop demo world pointer and in-memory account cache. */
  function resetAccountContext() {
    zhimuApi.resetActiveWorld?.();
    state.cloudStudio = null;
    state.accountView = null;
    window.zhimuRuntimeStore?.clearRuntimeState?.();
  }

  /** User switched to another world — keep session, clear room + world-scoped cloud cache. */
  function prepareWorldSwitch(worldId) {
    if (!worldId) return;
    zhimuApi.selectWorld(worldId);
    zhimuApi.clearRoom();
    clearWorldScopedState();
  }

  /** User picked another parallel room in the same world. */
  function prepareRoomSwitch(roomId) {
    if (!roomId) return;
    zhimuApi.selectRoom(roomId);
    window.zhimuRuntimeStore?.clearRuntimeState?.();
  }

  /** Logout — token cleared by caller; resets workspace + session UI flags. */
  function onSessionLogout() {
    zhimuApi.resetActiveWorld?.();
    state.cloudStudio = null;
    state.accountView = null;
    sessionStorage.removeItem("zhimuAuthPrompted");
    window.zhimuRuntimeStore?.clearRuntimeState?.();
  }

  /** Current world deleted — drop pointers and runtime. */
  function onCurrentWorldDeleted() {
    zhimuApi.clearWorld();
    zhimuApi.clearRoom();
    state.cloudStudio = null;
    window.zhimuRuntimeStore?.clearRuntimeState?.();
  }

  window.zhimuContext = {
    clearWorldScopedState,
    resetAccountContext,
    prepareWorldSwitch,
    prepareRoomSwitch,
    onSessionLogout,
    onCurrentWorldDeleted
  };
})(window);
export {};
