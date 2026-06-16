/* Cloud data loader — orchestrates workspace, runtime, and room live updates. */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const T = window.zhimuToast || {};
  const showToast = T.showToast || (() => {});
  const updateNotifyBadge = T.updateNotifyBadge || (() => {});

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

  async function loadCloudDataInternal(withToast = false) {
    state.cloudLoading = true;
    render();
    const errors = [];
    let hasRoom = Boolean(zhimuApi.context.roomId);
    const take = (result, apply, onError = () => {}) => result.status === "fulfilled"
      ? apply(result.value)
      : (onError(), errors.push(result.reason?.message || String(result.reason)));

    try {
      try {
        await ensureActiveWorld();
        const hasSession = workspace().isLoggedIn?.() ?? Boolean(localStorage.getItem("zhimuSessionToken"));
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
        } else if (/Authentication required/i.test(error.message) && !localStorage.getItem("zhimuSessionToken") && window.zhimuConfig?.demoMode) {
          errors.push("请先登录账号后再继续");
        } else {
          errors.push(error.message);
        }
      }

      state.apiError = errors.join(" · ");
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
        const phase2 = await Promise.allSettled([
          hasRoom ? zhimuApi.getPlayerHome() : Promise.resolve(null),
          hasRoom ? zhimuApi.getHostPlayers() : Promise.resolve(null),
          hasRoom ? zhimuApi.getExploration() : Promise.resolve(null),
          hasRoom ? zhimuApi.getHostEvents() : Promise.resolve(null),
          hasRoom ? zhimuApi.getHostClueMatrix() : Promise.resolve(null),
          hasRoom ? zhimuApi.getCheckpoints().catch(() => []) : Promise.resolve([]),
          hasRoom ? zhimuApi.getRecaps().catch(() => []) : Promise.resolve([]),
          hasRoom ? zhimuApi.getLatestRecap(state.view === "player").catch(() => null) : Promise.resolve(null),
          zhimuApi.getWorldLogs(logParams),
          zhimuApi.getRules(),
          hasRoom ? zhimuApi.getHostAuditLog().catch(() => ({ entries: [] })) : Promise.resolve({ entries: [] })
        ]);
        take(phase2[0], (value) => { state.cloudPlayer = value; }, () => { state.cloudPlayer = null; });
        take(phase2[1], (value) => applyHostPlayersPayload(value), () => {
          state.cloudHostPlayers = [];
          state.cloudHostStuckCount = 0;
          state.cloudHost = [];
        });
        take(phase2[2], (value) => { state.cloudExploration = value; }, () => { state.cloudExploration = null; });
        take(phase2[3], (value) => { state.cloudHostEvents = value || []; }, () => { state.cloudHostEvents = []; });
        take(phase2[4], (value) => { state.cloudHostClueMatrix = value; }, () => { state.cloudHostClueMatrix = null; });
        take(phase2[5], (value) => { state.cloudCheckpoints = value || []; }, () => { state.cloudCheckpoints = []; });
        take(phase2[6], (value) => { state.cloudRecaps = value || []; }, () => { state.cloudRecaps = []; });
        take(phase2[7], (value) => { state.cloudRecapLatest = value; }, () => { state.cloudRecapLatest = null; });
        take(phase2[8], (value) => { state.cloudWorldLogs = value || []; }, () => { state.cloudWorldLogs = []; });
        take(phase2[9], (value) => { state.cloudRules = value; }, () => { state.cloudRules = []; });
        take(phase2[10], (value) => { state.cloudHostAuditLog = value?.entries || []; }, () => { state.cloudHostAuditLog = []; });
      } else {
        state.cloudPlayer = null;
        state.cloudHostPlayers = [];
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
        if (localStorage.getItem("zhimuSessionToken")) {
          try {
            const usage = await zhimuApi.getStorageUsage();
            state.storageUsage = usage;
            if (state.view === "settings" || state.view === "overview") render();
            window.zhimuAccountHub?.refreshIfOpen?.();
          } catch {
            /* quota refresh best-effort */
          }
        }
      })();

      state.apiError = errors.join(" · ");
      roomEvents().syncDirectorPolling?.();
      if (worldReady) roomEvents().connectRoomEventStream?.();
      render();

      void (async () => {
        if (!zhimuApi.context.worldId) return;
        const params = {};
        if (state.assetKindFilter) params.kind = state.assetKindFilter;
        if (state.assetSearchQuery) params.q = state.assetSearchQuery;
        const phase3 = await Promise.allSettled([
          zhimuApi.getStorageUsage(),
          zhimuApi.getAssets(Object.keys(params).length ? params : {}),
          zhimuApi.getCreatorChecks()
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
        if (state.view === "overview" || state.view === "writer") render();
        window.zhimuAccountHub?.refreshAssetsPanel?.();
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
      if (withToast && !silent) showToast(error.message);
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
      if (withToast && !silent) showToast(error.message);
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
      if (withToast && !silent) showToast(error.message);
    }
  }

  async function refreshHostClueMatrix(withToast = false, silent = false) {
    if (!zhimuApi.context.roomId) return;
    try {
      state.cloudHostClueMatrix = await zhimuApi.getHostClueMatrix();
      if (state.view === "director") render();
      if (withToast && !silent) showToast("线索矩阵已刷新");
    } catch (error) {
      if (withToast && !silent) showToast(error.message);
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
      if (withToast) showToast(error.message);
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
