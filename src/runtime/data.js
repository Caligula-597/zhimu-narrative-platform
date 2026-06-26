/* Cloud data loader — orchestrates workspace, runtime, and room live updates. */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const T = window.zhimuToast || {};
  const showToast = T.showToast || (() => {});
  const updateNotifyBadge = T.updateNotifyBadge || (() => {});
  const reportError = (error, fallback = "操作失败，请稍后重试") =>
    showToast(window.zhimuStatus?.normalizeError?.(error, fallback) || error?.message || fallback);

  const workspace = () => window.zhimuWorkspace || {};
  const runtimeStore = () => window.zhimuRuntimeStore || {};
  const roomEvents = () => window.zhimuRoomEvents || {};

  function render() {
    window.zhimuRender?.();
  }

  let loadCloudDataPromise = null;
  let loadCloudDataKey = "";

  async function ensureActiveWorld() {
    return workspace().ensureActiveWorld?.();
  }

  async function loadCloudData(withToast = false, force = false) {
    const key = zhimuApi.loadKey();
    if (force) {
      loadCloudDataPromise = null;
      loadCloudDataKey = "";
    }
    if (loadCloudDataPromise && loadCloudDataKey === key) return loadCloudDataPromise;
    loadCloudDataKey = key;
    loadCloudDataPromise = loadCloudDataInternal(withToast).finally(() => {
      if (loadCloudDataKey === key) {
        loadCloudDataPromise = null;
        loadCloudDataKey = "";
      }
    });
    return loadCloudDataPromise;
  }

  function pushUniqueError(errors, message) {
    if (message && !errors.includes(message)) errors.push(message);
  }

  function isRoomMembershipError(result) {
    return result?.status === "rejected" && result.reason?.code === "ROOM_MEMBERSHIP_REQUIRED";
  }

  async function trySelectOwnedRoom() {
    if (!zhimuApi.context.worldId || zhimuApi.context.roomId) return false;
    try {
      const rooms = await zhimuApi.getWorldRooms();
      const owned = rooms.find((room) => room.is_mine);
      if (!owned) return false;
      zhimuApi.selectRoom(owned.id);
      return true;
    } catch {
      return false;
    }
  }

  async function loadCloudDataInternal(withToast = false, allowRoomRecover = true) {
    state.cloudLoading = true;
    render();
    const errors = [];
    let hasRoom = Boolean(zhimuApi.context.roomId);
    const take = (result, apply, onError = () => {}) => {
      if (result.status === "fulfilled") return apply(result.value);
      onError();
      if (result.reason?.code === "ROOM_MEMBERSHIP_REQUIRED") return;
      pushUniqueError(errors, result.reason?.message || String(result.reason));
    };

    try {
      try {
        await ensureActiveWorld();
        const hasSession = workspace().isLoggedIn?.() ?? window.zhimuSessionAuth?.isAuthenticated?.() ?? false;
        if (hasSession) {
          try {
            state.cloudCatalog = await zhimuApi.getWorldCatalog();
            state.cloudCatalogError = "";
          } catch (catalogErr) {
            state.cloudCatalog = [];
            state.cloudCatalogError = catalogErr.message || String(catalogErr);
            if (/catalog_public|does not exist/i.test(state.cloudCatalogError)) {
              errors.push("公开剧本库暂时无法加载，请稍后刷新");
            }
          }
        } else {
          state.cloudCatalog = [];
          state.cloudCatalogError = "";
        }
        if (!zhimuApi.context.worldId) {
          state.cloudStudio = null;
          errors.push("当前账号还没有可访问的剧本");
        } else {
          try {
            state.cloudStudio = await zhimuApi.getStudio();
            window.zhimuWorldRevision?.trackRevision?.(state.cloudStudio?.world);
            const roles = state.cloudStudio?.roles?.length || 0;
            const sections = state.cloudStudio?.sections?.length || 0;
            if (roles === 0) {
              errors.push("当前剧本暂无角色或分幕，请刷新或重新选择剧本。");
            }
          } catch (studioErr) {
            state.cloudStudio = null;
            const msg = studioErr.message || String(studioErr);
            if (studioErr.code === "WORLD_EDITOR_REQUIRED" || /WORLD_EDITOR_REQUIRED/i.test(msg)) {
              errors.push("无法读取剧本正文，请刷新页面后重试。");
            } else {
              errors.push(msg);
            }
          }
          const listed = (state.cloudWorlds || []).find((w) => w.id === zhimuApi.context.worldId);
          if (listed && state.cloudStudio?.world) {
            if (!state.cloudStudio.world.membership_role) state.cloudStudio.world.membership_role = listed.membership_role;
            if (listed.catalog_public != null) state.cloudStudio.world.catalog_public = listed.catalog_public;
          }
        }
      } catch (error) {
        state.cloudStudio = null;
        if (/Authentication required/i.test(error.message) && window.zhimuConfig?.requireAuth) {
          errors.push("请先登录账号后再继续");
          window.zhimuAuthSession?.promptAuthIfNeeded?.();
        } else if (/Authentication required/i.test(error.message) && !window.zhimuSessionAuth?.isAuthenticated?.() && window.zhimuConfig?.demoMode) {
          errors.push("请先登录账号后再继续");
        } else {
          errors.push(error.message);
        }
      }

      state.apiError = [...new Set(errors)].join(" · ");
      state.cloudLoading = false;
      render();

      if (hasRoom && state.cloudStudio && !workspace().roomBelongsToActiveWorld?.()) {
        zhimuApi.clearRoom();
        clearRuntimeState();
        hasRoom = false;
        errors.push("当前运行房不属于所选世界，已自动解除绑定");
      }
      if (!hasRoom) clearRuntimeState();

      const worldReady = Boolean(zhimuApi.context.worldId);
      if (worldReady) {
        const logParams = { limit: "20" };
        if (hasRoom) logParams.roomId = zhimuApi.context.roomId;
        const needsPlayerRuntime = hasRoom && state.view === "player";
        const needsDirectorRuntime = hasRoom && state.view === "director";
        const needsOverviewRuntime = hasRoom && state.view === "overview";
        const needsArchiveRuntime = hasRoom && state.view === "archive";
        const needsRules = ["overview", "rules", "director"].includes(state.view);
        const phase2 = await Promise.allSettled([
          needsPlayerRuntime ? zhimuApi.getPlayerHome() : Promise.resolve(null),
          needsDirectorRuntime ? zhimuApi.getHostPlayers() : Promise.resolve(null),
          needsPlayerRuntime ? zhimuApi.getExploration() : Promise.resolve(null),
          needsDirectorRuntime || needsOverviewRuntime ? zhimuApi.getHostEvents() : Promise.resolve(null),
          needsDirectorRuntime ? zhimuApi.getHostClueMatrix() : Promise.resolve(null),
          needsArchiveRuntime ? zhimuApi.getCheckpoints().catch(() => []) : Promise.resolve([]),
          needsArchiveRuntime ? zhimuApi.getRecaps().catch(() => []) : Promise.resolve([]),
          needsArchiveRuntime || needsPlayerRuntime ? zhimuApi.getLatestRecap(state.view === "player").catch(() => null) : Promise.resolve(null),
          state.view === "overview" || state.view === "director" ? zhimuApi.getWorldLogs(logParams) : Promise.resolve([]),
          needsRules ? zhimuApi.getRules() : Promise.resolve(state.cloudRules || []),
          needsDirectorRuntime ? zhimuApi.getHostAuditLog().catch(() => ({ entries: [] })) : Promise.resolve({ entries: state.cloudHostAuditLog || [] })
        ]);
        if (hasRoom && phase2.some(isRoomMembershipError)) {
          zhimuApi.clearRoom();
          clearRuntimeState();
          hasRoom = false;
          pushUniqueError(errors, "你不是该运行房的成员，已解除本地上次选中的房间。请重新选择或创建平行房。");
          if (allowRoomRecover && await trySelectOwnedRoom()) {
            return loadCloudDataInternal(withToast, false);
          }
        } else {
          take(phase2[0], (value) => { state.cloudPlayer = value; }, () => { state.cloudPlayer = null; });
          if (needsDirectorRuntime && phase2[1].status === "fulfilled") {
            applyHostPlayersPayload(phase2[1].value);
          } else if (needsDirectorRuntime && phase2[1].status === "rejected") {
            failHostPlayersLoad(phase2[1].reason);
            pushUniqueError(errors, phase2[1].reason?.message || String(phase2[1].reason));
          }
          take(phase2[2], (value) => { state.cloudExploration = value; }, () => { state.cloudExploration = null; });
        }
        if (hasRoom) {
          take(phase2[3], (value) => { state.cloudHostEvents = value || []; }, () => { state.cloudHostEvents = []; });
          take(phase2[4], (value) => { state.cloudHostClueMatrix = value; }, () => { state.cloudHostClueMatrix = null; });
          take(phase2[5], (value) => { state.cloudCheckpoints = value || []; }, () => { state.cloudCheckpoints = []; });
          take(phase2[6], (value) => { state.cloudRecaps = value || []; }, () => { state.cloudRecaps = []; });
          take(phase2[7], (value) => { state.cloudRecapLatest = value; }, () => { state.cloudRecapLatest = null; });
          take(phase2[10], (value) => { state.cloudHostAuditLog = value?.entries || []; }, () => { state.cloudHostAuditLog = []; });
        }
        take(phase2[8], (value) => { state.cloudWorldLogs = value || []; }, () => { state.cloudWorldLogs = []; });
        take(phase2[9], (value) => { state.cloudRules = value; }, () => { state.cloudRules = []; });
      } else {
        state.cloudPlayer = null;
        state.cloudHostPlayers = [];
        state.cloudHostPlayersError = "";
        state.cloudHostStuckCount = 0;
        state.cloudHost = [];
        state.cloudExploration = null;
        state.cloudHostEvents = [];
        state.cloudHostClueMatrix = null;
        state.cloudHostAuditLog = [];
        state.cloudCheckpoints = [];
        state.cloudRecaps = [];
        state.cloudRecapLatest = null;
        state.cloudWorldLogs = [];
        state.cloudRules = [];
        state.cloudAssets = [];
        state.assetTotal = 0;
        state.cloudCreatorChecks = [];
        state.storageUsage = null;
      }

      void (async () => {
        if (window.zhimuSessionAuth?.isAuthenticated?.()) {
          try {
            const usage = await zhimuApi.getStorageUsage();
            state.storageUsage = usage;
            if (state.view === "settings" || state.view === "overview" || state.view === "account") render();
          } catch {
            /* quota refresh best-effort */
          }
        }
      })();

      state.apiError = [...new Set(errors)].join(" · ");
      roomEvents().syncDirectorPolling?.();
      if (worldReady) roomEvents().connectRoomEventStream?.();
      render();

      if (["overview", "account", "settings", "writer", "studio", "clues"].includes(state.view)) void (async () => {
        if (!zhimuApi.context.worldId) return;
        const params = {};
        if (state.assetKindFilter) params.kind = state.assetKindFilter;
        if (state.assetSearchQuery) params.q = state.assetSearchQuery;
        const needsStorageUsage = ["overview", "account", "settings"].includes(state.view);
        const needsAssets = ["overview", "account", "settings", "writer", "studio", "clues"].includes(state.view);
        const needsCreatorChecks = ["overview", "writer", "settings"].includes(state.view);
        if (!needsStorageUsage && !needsAssets && !needsCreatorChecks) return;
        const phase3 = await Promise.allSettled([
          needsStorageUsage ? zhimuApi.getStorageUsage() : Promise.resolve(state.storageUsage),
          needsAssets ? zhimuApi.getAssets(Object.keys(params).length ? params : {}) : Promise.resolve({ assets: state.cloudAssets, total: state.assetTotal }),
          needsCreatorChecks ? zhimuApi.getCreatorChecks() : Promise.resolve({ checks: state.cloudCreatorChecks })
        ]);
        take(phase3[0], (value) => { state.storageUsage = value; });
        take(phase3[1], (value) => {
          if (Array.isArray(value)) {
            state.cloudAssets = value;
            state.assetTotal = value.length;
          } else {
            state.cloudAssets = value.assets || [];
            state.assetTotal = value.total ?? state.cloudAssets.length;
          }
        });
        take(phase3[2], (value) => { state.cloudCreatorChecks = value.checks; });
        if (state.view === "overview" || state.view === "account" || state.view === "settings" || state.view === "writer" || state.view === "studio" || state.view === "clues") render();
      })();

      void (async () => {
        const voiceRooms = state.cloudPlayer?.voiceRooms || [];
        const currentRoom = voiceRooms.find((room) => room.id === state.voiceRoomId) || voiceRooms[0];
        if (!currentRoom) return;
        state.voiceRoomId = currentRoom.id;
        state.voiceRoom = currentRoom.name;
        try {
          state.voiceMessages = await zhimuApi.getVoiceMessages(currentRoom.id);
          if (state.view === "player") render();
        } catch (error) {
          state.apiError = [state.apiError, error.message].filter(Boolean).join(" · ");
        }
      })();

      if (withToast) showToast(errors.length ? `部分运行数据尚未连接：${errors[0]}` : "云端数据已刷新");
    } finally {
      if (state.cloudLoading) {
        state.cloudLoading = false;
        render();
      }
    }
  }

  function clearRuntimeState() {
    runtimeStore().clearRuntimeState?.();
  }

  function applyHostPlayersPayload(value) {
    runtimeStore().applyHostPlayersPayload?.(value);
  }

  function failHostPlayersLoad(error) {
    runtimeStore().failHostPlayersLoad?.(error);
  }

  async function refreshHostEvents(withToast = false, silent = false) {
    if (!zhimuApi.context.roomId) {
      if (withToast && !silent) showToast("请先选择运行房");
      return;
    }
    try {
      state.cloudHostEvents = await zhimuApi.getHostEvents() || [];
      updateNotifyBadge();
      if (state.view === "director" || state.view === "overview") render();
      if (withToast && !silent) showToast(`待确认事件已刷新（${state.cloudHostEvents.length} 条）`);
    } catch (error) {
      if (withToast && !silent) reportError(error, "刷新待确认事件失败");
    }
  }

  async function refreshHostPlayers(withToast = false, silent = false) {
    if (!zhimuApi.context.roomId) {
      if (withToast && !silent) showToast("请先选择运行房");
      return;
    }
    try {
      applyHostPlayersPayload(await zhimuApi.getHostPlayers());
      if (state.view === "director" || state.view === "overview") render();
      if (withToast && !silent) showToast(`玩家进度已刷新（${state.cloudHostPlayers.filter((player) => player.joined).length} 人已加入）`);
    } catch (error) {
      failHostPlayersLoad(error);
      if (state.view === "director" || state.view === "overview") render();
      if (withToast && !silent) reportError(error, "刷新玩家进度失败");
    }
  }

  async function refreshHostAuditLog(withToast = false, silent = false) {
    if (!zhimuApi.context.roomId) {
      if (withToast && !silent) showToast("请先选择运行房");
      return;
    }
    try {
      const payload = await zhimuApi.getHostAuditLog();
      state.cloudHostAuditLog = payload?.entries || [];
      if (state.view === "director") render();
      if (withToast && !silent) showToast(`主持审计已刷新（${state.cloudHostAuditLog.length} 条）`);
    } catch (error) {
      if (withToast && !silent) reportError(error, "刷新主持审计失败");
    }
  }

  async function refreshHostClueMatrix(withToast = false, silent = false) {
    if (!zhimuApi.context.roomId) return;
    try {
      state.cloudHostClueMatrix = await zhimuApi.getHostClueMatrix();
      if (state.view === "director") render();
      if (withToast && !silent) showToast("线索矩阵已刷新");
    } catch (error) {
      if (withToast && !silent) reportError(error, "刷新线索矩阵失败");
    }
  }

  async function refreshHostRoom(withToast = false) {
    if (!zhimuApi.context.roomId) {
      if (withToast) showToast("请先选择运行房");
      return;
    }
    try {
      const logParams = { limit: "20", roomId: zhimuApi.context.roomId };
      const [hostPlayers, hostEvents, worldLogs, clueMatrix, auditLog] = await Promise.all([
        zhimuApi.getHostPlayers(),
        zhimuApi.getHostEvents(),
        zhimuApi.getWorldLogs(logParams),
        zhimuApi.getHostClueMatrix(),
        zhimuApi.getHostAuditLog().catch(() => ({ entries: [] }))
      ]);
      applyHostPlayersPayload(hostPlayers);
      state.cloudHostEvents = hostEvents || [];
      state.cloudWorldLogs = worldLogs || [];
      state.cloudHostClueMatrix = clueMatrix;
      state.cloudHostAuditLog = auditLog?.entries || [];
      updateNotifyBadge();
      if (state.view === "director" || state.view === "overview") render();
      if (withToast) {
        showToast(`房间状态已刷新 · 待确认 ${state.cloudHostEvents.length} 条 · 玩家 ${state.cloudHostPlayers.filter((player) => player.joined).length} 人`);
      }
    } catch (error) {
      failHostPlayersLoad(error);
      if (state.view === "director" || state.view === "overview") render();
      if (withToast) reportError(error, "刷新房间状态失败");
    }
  }

  function enhanceCloudPanels() {}

  window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, {
    loadCloudData,
    ensureActiveWorld,
    clearRuntimeState,
    applyHostPlayersPayload,
    refreshPlayerHome: (...args) => roomEvents().refreshPlayerHome?.(...args),
    refreshExploration: (...args) => roomEvents().refreshExploration?.(...args),
    syncDirectorPolling: (...args) => roomEvents().syncDirectorPolling?.(...args),
    refreshDirectorPoll: (...args) => roomEvents().refreshDirectorPoll?.(...args),
    refreshHostEvents,
    refreshHostPlayers,
    refreshHostClueMatrix,
    refreshHostAuditLog,
    refreshHostRoom,
    disconnectRoomEventStream: (...args) => roomEvents().disconnectRoomEventStream?.(...args),
    scheduleRoomEventReconnect: (...args) => roomEvents().scheduleRoomEventReconnect?.(...args),
    connectRoomEventStream: (...args) => roomEvents().connectRoomEventStream?.(...args),
    handleRoomEvent: (...args) => roomEvents().handleRoomEvent?.(...args),
    streamUserIdForRoom: (...args) => roomEvents().streamUserIdForRoom?.(...args),
    enhanceCloudPanels,
    renderQuotaSection: (...args) => window.zhimuAccountQuota?.renderQuotaSection?.(...args)
  });
})(window);
export {};
