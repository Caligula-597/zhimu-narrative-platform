/* Cloud data loader — orchestrates workspace, runtime, and room live updates. */
import * as zhimuApi from "../api/index.js";
import { showToast, updateNotifyBadge } from "../components/toast.js";
import { uiStore, worldStore, studioStore, roomStore, assetStore, userStore } from "../state/index.js";
import { registerRuntime, render as runtimeRender } from "./runtime-facade.js";
import { callView } from "./view-registry.js";
import * as workspaceStore from "./workspace-store.js";
import * as runtimeStore from "./runtime-store.js";
import { ensureStudioSnapshot, viewRequiresStudio } from "./studio-loader.js";
import { normalizeError } from "../components/status-ui.js";

  const reportError = (error, fallback = "操作失败，请稍后重试") =>
    showToast(normalizeError(error, fallback));

  const roomEvents = () => window.zhimuRoomEvents || {};

  function render() {
    runtimeRender();
  }

  let loadCloudDataPromise = null;
  let loadCloudDataKey = "";
  let hostEventsRefreshSeq = 0;
  let hostPlayersRefreshSeq = 0;
  let hostRoomRefreshSeq = 0;

export async function ensureActiveWorld() {
    return workspaceStore.ensureActiveWorld();
  }

export function prefetchWorlds() {
    return workspaceStore.prefetchWorlds();
  }

export async function loadCloudData(withToast = false, force = false) {
    const key = zhimuApi.loadKey();
    if (force && loadCloudDataPromise && loadCloudDataKey === key) return loadCloudDataPromise;
    if (force) {
      loadCloudDataPromise = null;
      loadCloudDataKey = "";
    }
    if (loadCloudDataPromise && loadCloudDataKey === key) return loadCloudDataPromise;
    loadCloudDataKey = key;
    loadCloudDataPromise = loadCloudDataInternal(withToast, true, key).finally(() => {
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

  function isCurrentLoad(loadKey) {
    return !loadKey || zhimuApi.loadKey() === loadKey;
  }

  async function loadCloudDataInternal(withToast = false, allowRoomRecover = true, activeLoadKey = zhimuApi.loadKey()) {
    studioStore.set({ cloudLoading: true });
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
        worldStore.set({ cloudCatalog: [], cloudCatalogError: "" });
        if (!zhimuApi.context.worldId) {
          studioStore.set({ cloudStudio: null, studioLoading: false, studioError: "" });
          worldStore.set({ cloudWorkspacePreview: null });
          errors.push("当前账号还没有可访问的项目");
        } else {
          const activeView = uiStore.get().view;
          const cockpitHydrationPromise = activeView === "creatorCockpit"
            ? Promise.resolve(callView("creatorCockpit", "refreshCockpitData"))
            : null;
          if (viewRequiresStudio(activeView)) {
            try {
              const studioData = await ensureStudioSnapshot({ force: true });
              studioStore.set({ cloudStudio: studioData });
              window.zhimuWorldRevision?.trackRevision?.(studioData?.world);
              const roles = studioData?.roles?.length || 0;
              const sections = studioData?.sections?.length || 0;
              if (roles === 0) {
                errors.push("当前剧本暂无角色或分幕，请刷新或重新选择剧本。");
              }
            } catch (studioErr) {
              studioStore.set({ cloudStudio: null });
              const msg = studioErr.message || String(studioErr);
              if (studioErr.code === "WORLD_EDITOR_REQUIRED" || /WORLD_EDITOR_REQUIRED/i.test(msg)) {
                errors.push("无法读取剧本正文，请刷新页面后重试。");
              } else {
                errors.push(msg);
              }
            }
          }
          if (cockpitHydrationPromise) await cockpitHydrationPromise;
          const worldSnap = worldStore.get();
          const studioSnap = studioStore.get();
          const listed = (worldSnap.cloudWorlds || []).find((w) => w.id === zhimuApi.context.worldId);
          if (listed && studioSnap.cloudStudio?.world) {
            const updatedWorld = { ...studioSnap.cloudStudio.world };
            if (!updatedWorld.membership_role) updatedWorld.membership_role = listed.membership_role;
            if (listed.catalog_public != null) updatedWorld.catalog_public = listed.catalog_public;
            studioStore.set({ cloudStudio: { ...studioSnap.cloudStudio, world: updatedWorld } });
          }
        }
      } catch (error) {
        studioStore.set({ cloudStudio: null });
        worldStore.set({ cloudWorkspacePreview: null });
        if (/Authentication required/i.test(error.message) && window.zhimuConfig?.requireAuth) {
          errors.push("请先登录账号后再继续");
          window.zhimuAuthSession?.promptAuthIfNeeded?.();
        } else if (/Authentication required/i.test(error.message) && !window.zhimuSessionAuth?.isAuthenticated?.() && window.zhimuConfig?.demoMode) {
          errors.push("请先登录账号后再继续");
        } else {
          errors.push(error.message);
        }
      }

      userStore.set({ apiError: [...new Set(errors)].join(" · ") });
      studioStore.set({ cloudLoading: false });
      render();

      if (hasRoom && studioStore.get().cloudStudio && !workspaceStore.roomBelongsToActiveWorld()) {
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
        const view = uiStore.get().view;
        const needsOverviewRuntime = hasRoom && view === "overview";
        const needsArchiveRuntime = hasRoom && view === "archive";
        const needsRules = ["overview", "rules"].includes(view);
        const phase2 = await Promise.allSettled([
          needsOverviewRuntime ? zhimuApi.getHostPlayers() : Promise.resolve(null),
          needsOverviewRuntime ? zhimuApi.getHostEvents() : Promise.resolve(null),
          needsArchiveRuntime ? zhimuApi.getCheckpoints().catch(() => []) : Promise.resolve([]),
          needsArchiveRuntime ? zhimuApi.getRecaps().catch(() => []) : Promise.resolve([]),
          needsArchiveRuntime ? zhimuApi.getLatestRecap(false).catch(() => null) : Promise.resolve(null),
          view === "overview" ? zhimuApi.getWorldLogs(logParams) : Promise.resolve([]),
          needsRules ? zhimuApi.getRules() : Promise.resolve(worldStore.get().cloudRules || [])
        ]);
        if (hasRoom && phase2.some(isRoomMembershipError)) {
          zhimuApi.clearRoom();
          clearRuntimeState();
          hasRoom = false;
          pushUniqueError(errors, "你不是该运行房的成员，已解除本地上次选中的房间。请重新选择或创建平行房。");
          if (allowRoomRecover && await trySelectOwnedRoom()) {
            return loadCloudDataInternal(withToast, false, zhimuApi.loadKey());
          }
        } else {
          if (needsOverviewRuntime && phase2[0].status === "fulfilled") {
            applyHostPlayersPayload(phase2[0].value);
          } else if (needsOverviewRuntime && phase2[0].status === "rejected") {
            failHostPlayersLoad(phase2[0].reason);
            pushUniqueError(errors, phase2[0].reason?.message || String(phase2[0].reason));
          }
        }
        if (hasRoom) {
          take(phase2[1], (value) => { roomStore.set({ cloudHostEvents: value || [] }); }, () => { roomStore.set({ cloudHostEvents: [] }); });
          take(phase2[2], (value) => { roomStore.set({ cloudCheckpoints: value || [] }); }, () => { roomStore.set({ cloudCheckpoints: [] }); });
          take(phase2[3], (value) => { roomStore.set({ cloudRecaps: value || [] }); }, () => { roomStore.set({ cloudRecaps: [] }); });
          take(phase2[4], (value) => { roomStore.set({ cloudRecapLatest: value }); }, () => { roomStore.set({ cloudRecapLatest: null }); });
        }
        take(phase2[5], (value) => { worldStore.set({ cloudWorldLogs: value || [] }); }, () => { worldStore.set({ cloudWorldLogs: [] }); });
        take(phase2[6], (value) => { worldStore.set({ cloudRules: value }); }, () => { worldStore.set({ cloudRules: [] }); });
      } else {
        roomStore.set({
          cloudHostPlayers: [],
          cloudHostPlayersError: "",
          cloudHostStuckCount: 0,
          cloudHost: [],
          cloudHostEvents: [],
          cloudCheckpoints: [],
          cloudRecaps: [],
          cloudRecapLatest: null
        });
        worldStore.set({
          cloudWorldLogs: [],
          cloudRules: [],
          cloudCreatorChecks: [],
          cloudStoryDiagnostics: null,
          cloudStoryDiagnosticsStandard: "classic",
          cloudStoryDiagnosticsLoading: false,
          cloudStoryDiagnosticsError: "",
          cloudAiPlaytestRuns: null,
          cloudAiPlaytestActive: null,
          cloudAiPlaytestLoading: false,
          cloudAiPlaytestRunning: false,
          cloudAiPlaytestError: "",
          cloudAiPlaytestLlmStatus: null,
          cloudAiPlaytestDraftConfig: null
        });
        assetStore.set({ cloudAssets: [], assetTotal: 0, storageUsage: null });
      }

      void (async () => {
        const viewAtStart = uiStore.get().view;
        if (window.zhimuSessionAuth?.isAuthenticated?.() && !["overview", "creatorCockpit", "account", "settings"].includes(viewAtStart)) {
          try {
            const usage = await zhimuApi.getStorageUsage();
            if (!isCurrentLoad(activeLoadKey)) return;
            assetStore.set({ storageUsage: usage });
            if (["settings", "overview", "account"].includes(uiStore.get().view)) render();
          } catch {
            /* quota refresh best-effort */
          }
        }
      })();

      userStore.set({ apiError: [...new Set(errors)].join(" · ") });
      if (worldReady && hasRoom && ["overview", "archive"].includes(uiStore.get().view)) {
        roomEvents().connectRoomEventStream?.();
      }
      render();

        if (["overview", "creatorCockpit", "account", "settings", "writer", "studio", "clues"].includes(uiStore.get().view)) void (async () => {
        if (!zhimuApi.context.worldId) return;
        const assetSnap = assetStore.get();
        const params = {};
        if (assetSnap.assetKindFilter) params.kind = assetSnap.assetKindFilter;
        if (assetSnap.assetSearchQuery) params.q = assetSnap.assetSearchQuery;
        const needsStorageUsage = ["overview", "account", "settings"].includes(uiStore.get().view);
        const needsAssets = ["overview", "account", "settings", "writer", "studio", "clues"].includes(uiStore.get().view);
        const view = uiStore.get().view;
        const needsCreatorDashboard = view === "overview";
        const needsCreatorChecks = ["writer", "settings"].includes(view);
        if (!needsStorageUsage && !needsAssets && !needsCreatorDashboard && !needsCreatorChecks) return;
        const activeRoomId = zhimuApi.context.roomId || null;
        const phase3 = await Promise.allSettled([
          needsStorageUsage ? zhimuApi.getStorageUsage() : Promise.resolve(assetStore.get().storageUsage),
          needsAssets ? zhimuApi.getAssets(Object.keys(params).length ? params : {}) : Promise.resolve({ assets: assetStore.get().cloudAssets, total: assetStore.get().assetTotal }),
          needsCreatorDashboard
            ? zhimuApi.getCreatorDashboard(activeRoomId ? { roomId: activeRoomId } : {})
            : needsCreatorChecks
              ? zhimuApi.getCreatorChecks()
              : Promise.resolve({ checks: worldStore.get().cloudCreatorChecks })
        ]);
        if (!isCurrentLoad(activeLoadKey)) return;
        take(phase3[0], (value) => { assetStore.set({ storageUsage: value }); });
        take(phase3[1], (value) => {
          if (Array.isArray(value)) {
            assetStore.set({ cloudAssets: value, assetTotal: value.length });
          } else {
            assetStore.set({ cloudAssets: value.assets || [], assetTotal: value.total ?? (value.assets || []).length });
          }
        });
        take(phase3[2], (value) => {
          if (value?.production) {
            worldStore.set({ cloudCreatorDashboard: value, cloudCreatorChecks: value.checks || [] });
          } else {
            worldStore.set({ cloudCreatorChecks: value.checks || value });
          }
        });
        if (["overview", "creatorCockpit", "account", "settings", "writer", "studio", "clues"].includes(uiStore.get().view)) render();
      })();

      if (withToast) showToast(errors.length ? `部分运行数据尚未连接：${errors[0]}` : "云端数据已刷新");
    } finally {
      if (studioStore.get().cloudLoading) {
        studioStore.set({ cloudLoading: false });
        render();
      }
    }
  }

export function clearRuntimeState() {
    runtimeStore.clearRuntimeState();
  }

export function applyHostPlayersPayload(value) {
    runtimeStore.applyHostPlayersPayload(value);
  }

  function failHostPlayersLoad(error) {
    runtimeStore.failHostPlayersLoad(error);
  }

export async function refreshHostEvents(withToast = false, silent = false) {
    if (!zhimuApi.context.roomId) {
      if (withToast && !silent) showToast("请先选择运行房");
      return;
    }
    const refreshSeq = ++hostEventsRefreshSeq;
    const refreshKey = zhimuApi.loadKey();
    try {
      const cloudHostEvents = await zhimuApi.getHostEvents() || [];
      if (refreshSeq !== hostEventsRefreshSeq || !isCurrentLoad(refreshKey)) return;
      roomStore.set({ cloudHostEvents });
      updateNotifyBadge();
      if (uiStore.get().view === "overview") render();
      if (withToast && !silent) showToast(`待确认事件已刷新（${cloudHostEvents.length} 条）`);
    } catch (error) {
      if (refreshSeq !== hostEventsRefreshSeq || !isCurrentLoad(refreshKey)) return;
      if (withToast && !silent) reportError(error, "刷新待确认事件失败");
    }
  }

export async function refreshHostPlayers(withToast = false, silent = false) {
    if (!zhimuApi.context.roomId) {
      if (withToast && !silent) showToast("请先选择运行房");
      return;
    }
    const refreshSeq = ++hostPlayersRefreshSeq;
    const refreshKey = zhimuApi.loadKey();
    try {
      const payload = await zhimuApi.getHostPlayers();
      if (refreshSeq !== hostPlayersRefreshSeq || !isCurrentLoad(refreshKey)) return;
      applyHostPlayersPayload(payload);
      if (uiStore.get().view === "overview") render();
      if (withToast && !silent) showToast(`玩家进度已刷新（${roomStore.get().cloudHostPlayers.filter((player) => player.joined).length} 人已加入）`);
    } catch (error) {
      if (refreshSeq !== hostPlayersRefreshSeq || !isCurrentLoad(refreshKey)) return;
      failHostPlayersLoad(error);
      if (uiStore.get().view === "overview") render();
      if (withToast && !silent) reportError(error, "刷新玩家进度失败");
    }
  }

export async function refreshHostRoom(withToast = false) {
    if (!zhimuApi.context.roomId) {
      if (withToast) showToast("请先选择运行房");
      return;
    }
    const refreshSeq = ++hostRoomRefreshSeq;
    const refreshKey = zhimuApi.loadKey();
    try {
      const logParams = { limit: "20", roomId: zhimuApi.context.roomId };
      const [hostPlayers, hostEvents, worldLogs] = await Promise.all([
        zhimuApi.getHostPlayers(),
        zhimuApi.getHostEvents(),
        zhimuApi.getWorldLogs(logParams)
      ]);
      if (refreshSeq !== hostRoomRefreshSeq || !isCurrentLoad(refreshKey)) return;
      applyHostPlayersPayload(hostPlayers);
      const cloudHostEvents = hostEvents || [];
      const cloudWorldLogs = worldLogs || [];
      roomStore.set({ cloudHostEvents });
      worldStore.set({ cloudWorldLogs });
      updateNotifyBadge();
      if (uiStore.get().view === "overview") render();
      if (withToast) {
        showToast(`房间状态已刷新 · 待确认 ${cloudHostEvents.length} 条 · 玩家 ${roomStore.get().cloudHostPlayers.filter((player) => player.joined).length} 人`);
      }
    } catch (error) {
      if (refreshSeq !== hostRoomRefreshSeq || !isCurrentLoad(refreshKey)) return;
      failHostPlayersLoad(error);
      if (uiStore.get().view === "overview") render();
      if (withToast) reportError(error, "刷新房间状态失败");
    }
  }

export function enhanceCloudPanels() {}

export function refreshHostRuntimeSnapshot(...args) { return roomEvents().refreshHostRuntimeSnapshot?.(...args); }
export function disconnectRoomEventStream(...args) { return roomEvents().disconnectRoomEventStream?.(...args); }
export function scheduleRoomEventReconnect(...args) { return roomEvents().scheduleRoomEventReconnect?.(...args); }
export function connectRoomEventStream(...args) { return roomEvents().connectRoomEventStream?.(...args); }
export function handleRoomEvent(...args) { return roomEvents().handleRoomEvent?.(...args); }
export function streamUserIdForRoom(...args) { return roomEvents().streamUserIdForRoom?.(...args); }
export function renderQuotaSection(...args) { return window.zhimuAccountQuota?.renderQuotaSection?.(...args); }

registerRuntime({ loadCloudData, ensureActiveWorld, prefetchWorlds, clearRuntimeState, applyHostPlayersPayload, refreshHostRuntimeSnapshot, refreshHostEvents, refreshHostPlayers, refreshHostRoom, disconnectRoomEventStream, scheduleRoomEventReconnect, connectRoomEventStream, handleRoomEvent, streamUserIdForRoom, enhanceCloudPanels, renderQuotaSection });
