/** World / room selection and workspace domain helpers (demo vs logged-in). */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;

  function isLoggedIn() {
    return window.zhimuAuthSession?.isLoggedIn?.() ?? Boolean(localStorage.getItem("zhimuSessionToken"));
  }

  function isDemoBrowseMode() {
    return Boolean(window.zhimuConfig?.demoMode) && !isLoggedIn();
  }

  function activeRuntimeRoom() {
    return (state.cloudStudio?.rooms || []).find((room) => room.id === zhimuApi.context.roomId)
      || (state.cloudPlayer?.room?.id === zhimuApi.context.roomId ? state.cloudPlayer.room : null)
      || null;
  }

  function isWorldOwner(worldId) {
    const id = worldId || zhimuApi.context.worldId;
    if (!id) return false;
    const studioWorld = state.cloudStudio?.world;
    if (studioWorld?.id === id) {
      if (studioWorld.membership_role === "owner") return true;
      if (state.currentUser?.id && studioWorld.owner_user_id === state.currentUser.id) return true;
    }
    const listed = (state.cloudWorlds || []).find((w) => w.id === id);
    return listed?.membership_role === "owner";
  }

  function roomBelongsToActiveWorld() {
    if (!zhimuApi.context.roomId) return true;
    return Boolean(activeRuntimeRoom());
  }

  async function ensureActiveWorld() {
    let worlds;
    try {
      worlds = await zhimuApi.getWorlds();
    } catch (error) {
      state.cloudWorlds = [];
      throw error;
    }
    state.cloudWorlds = worlds;
    const hasSession = isLoggedIn();
    const current = zhimuApi.context.worldId;

    // Logged-in users must not keep a demo-world id from prior anonymous browsing.
    if (hasSession && current && !worlds.some((world) => world.id === current)) {
      zhimuApi.clearWorld();
      zhimuApi.clearRoom();
    }

    if (!worlds.length) {
      zhimuApi.clearWorld();
      zhimuApi.clearRoom();
      return null;
    }

    const activeId = zhimuApi.context.worldId;
    if (activeId && worlds.some((world) => world.id === activeId)) return activeId;

    zhimuApi.selectWorld(worlds[0].id);
    zhimuApi.clearRoom();
    return worlds[0].id;
  }

  window.zhimuWorkspace = {
    isLoggedIn,
    isDemoBrowseMode,
    ensureActiveWorld,
    activeRuntimeRoom,
    isWorldOwner,
    roomBelongsToActiveWorld
  };
})(window);
export {};
