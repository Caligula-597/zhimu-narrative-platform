/* Cloud data loader — orchestrates workspace, runtime, and room live updates. */
import * as zhimuApi from "../api/index.js";
import { showToast, updateNotifyBadge } from "../components/toast.js";
import { uiStore, worldStore, studioStore, roomStore, assetStore, userStore, voiceStore } from "../state/index.js";
import { registerRuntime, render as runtimeRender } from "./runtime-facade.js";

  const reportError = (error, fallback = "操作失败，请稍后重试") =>
    showToast(window.zhimuStatus?.normalizeError?.(error, fallback) || error?.message || fallback);

  const workspace = () => window.zhimuWorkspace || {};
  const runtimeStore = () => window.zhimuRuntimeStore || {};
  const roomEvents = () => window.zhimuRoomEvents || {};

  function render() {
    runtimeRender();
  }

  let loadCloudDataPromise = null;
  let loadCloudDataKey = "";

export async function ensureActiveWorld() {
    return workspace().ensureActiveWorld?.();
  }

export async function loadCloudData(withToast = false, force = false) {
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
        const hasSession = workspace().isLoggedIn?.() ?? window.zhimuSessionAuth?.isAuthenticated?.() ?? false;
        if (hasSession) {
          try {
            worldStore.set({ cloudCatalog: await zhimuApi.getWorldCatalog(), cloudCatalogError: "" });
          } catch (catalogErr) {
            const catalogErrorMsg = catalogErr.message || String(catalogErr);
            worldStore.set({ cloudCatalog: [], cloudCatalogError: catalogErrorMsg });
            if (/catalog_public|does not exist/i.test(catalogErrorMsg)) {
              errors.push("公开剧本库暂时无法加载，请稍后刷新");
            }
          }
        } else {
          worldStore.set({ cloudCatalog: [], cloudCatalogError: "" });
        }
        if (!zhimuApi.context.worldId) {
          studioStore.set({ cloudStudio: null });
          errors.push("当前账号还没有可访问的剧本");
        } else {
          try {
            const studioData = await zhimuApi.getStudio();
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

      if (hasRoom && studioStore.get().cloudStudio && !workspace().roomBelongsToActiveWorld?.()) {
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
        const needsPlayerRuntime = hasRoom && view === "player";
        const needsDirectorRuntime = hasRoom && view === "director";
        const needsOverviewRuntime = hasRoom && view === "overview";
        const needsArchiveRuntime = hasRoom && view === "archive";
        const needsRules = ["overview", "rules", "director"].includes(view);
        const phase2 = await Promise.allSettled([
          needsPlayerRuntime ? zhimuApi.getPlayerHome() : Promise.resolve(null),
          needsDirectorRuntime ? zhimuApi.getHostPlayers() : Promise.resolve(null),
          needsPlayerRuntime ? zhimuApi.getExploration() : Promise.resolve(null),
          needsDirectorRuntime || needsOverviewRuntime ? zhimuApi.getHostEvents() : Promise.resolve(null),
          needsDirectorRuntime ? zhimuApi.getHostClueMatrix() : Promise.resolve(null),
          needsArchiveRuntime ? zhimuApi.getCheckpoints().catch(() => []) : Promise.resolve([]),
          needsArchiveRuntime ? zhimuApi.getRecaps().catch(() => []) : Promise.resolve([]),
          needsArchiveRuntime || needsPlayerRuntime ? zhimuApi.getLatestRecap(view === "player").catch(() => null) : Promise.resolve(null),
          view === "overview" || view === "director" ? zhimuApi.getWorldLogs(logParams) : Promise.resolve([]),
          needsRules ? zhimuApi.getRules() : Promise.resolve(worldStore.get().cloudRules || []),
          needsDirectorRuntime ? zhimuApi.getHostAuditLog().catch(() => ({ entries: [] })) : Promise.resolve({ entries: roomStore.get().cloudHostAuditLog || [] })
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
          take(phase2[0], (value) => { roomStore.set({ cloudPlayer: value }); }, () => { roomStore.set({ cloudPlayer: null }); });
          if (needsDirectorRuntime && phase2[1].status === "fulfilled") {
            applyHostPlayersPayload(phase2[1].value);
          } else if (needsDirectorRuntime && phase2[1].status === "rejected") {
            failHostPlayersLoad(phase2[1].reason);
            pushUniqueError(errors, phase2[1].reason?.message || String(phase2[1].reason));
          }
          take(phase2[2], (value) => { roomStore.set({ cloudExploration: value }); }, () => { roomStore.set({ cloudExploration: null }); });
        }
        if (hasRoom) {
          take(phase2[3], (value) => { roomStore.set({ cloudHostEvents: value || [] }); }, () => { roomStore.set({ cloudHostEvents: [] }); });
          take(phase2[4], (value) => { roomStore.set({ cloudHostClueMatrix: value }); }, () => { roomStore.set({ cloudHostClueMatrix: null }); });
          take(phase2[5], (value) => { roomStore.set({ cloudCheckpoints: value || [] }); }, () => { roomStore.set({ cloudCheckpoints: [] }); });
          take(phase2[6], (value) => { roomStore.set({ cloudRecaps: value || [] }); }, () => { roomStore.set({ cloudRecaps: [] }); });
          take(phase2[7], (value) => { roomStore.set({ cloudRecapLatest: value }); }, () => { roomStore.set({ cloudRecapLatest: null }); });
          take(phase2[10], (value) => { roomStore.set({ cloudHostAuditLog: value?.entries || [] }); }, () => { roomStore.set({ cloudHostAuditLog: [] }); });
        }
        take(phase2[8], (value) => { worldStore.set({ cloudWorldLogs: value || [] }); }, () => { worldStore.set({ cloudWorldLogs: [] }); });
        take(phase2[9], (value) => { worldStore.set({ cloudRules: value }); }, () => { worldStore.set({ cloudRules: [] }); });
      } else {
        roomStore.set({
          cloudPlayer: null,
          cloudHostPlayers: [],
          cloudHostPlayersError: "",
          cloudHostStuckCount: 0,
          cloudHost: [],
          cloudExploration: null,
          cloudHostEvents: [],
          cloudHostClueMatrix: null,
          cloudHostAuditLog: [],
          cloudCheckpoints: [],
          cloudRecaps: [],
          cloudRecapLatest: null
        });
        worldStore.set({ cloudWorldLogs: [], cloudRules: [], cloudCreatorChecks: [] });
        assetStore.set({ cloudAssets: [], assetTotal: 0, storageUsage: null });
      }

      void (async () => {
        if (window.zhimuSessionAuth?.isAuthenticated?.()) {
          try {
            const usage = await zhimuApi.getStorageUsage();
            assetStore.set({ storageUsage: usage });
            if (["settings", "overview", "account"].includes(uiStore.get().view)) render();
          } catch {
            /* quota refresh best-effort */
          }
        }
      })();

      userStore.set({ apiError: [...new Set(errors)].join(" · ") });
      roomEvents().syncDirectorPolling?.();
      if (worldReady) roomEvents().connectRoomEventStream?.();
      render();

      if (["overview", "account", "settings", "writer", "studio", "clues"].includes(uiStore.get().view)) void (async () => {
        if (!zhimuApi.context.worldId) return;
        const assetSnap = assetStore.get();
        const params = {};
        if (assetSnap.assetKindFilter) params.kind = assetSnap.assetKindFilter;
        if (assetSnap.assetSearchQuery) params.q = assetSnap.assetSearchQuery;
        const needsStorageUsage = ["overview", "account", "settings"].includes(uiStore.get().view);
        const needsAssets = ["overview", "account", "settings", "writer", "studio", "clues"].includes(uiStore.get().view);
        const needsCreatorChecks = ["overview", "writer", "settings"].includes(uiStore.get().view);
        if (!needsStorageUsage && !needsAssets && !needsCreatorChecks) return;
        const phase3 = await Promise.allSettled([
          needsStorageUsage ? zhimuApi.getStorageUsage() : Promise.resolve(assetStore.get().storageUsage),
          needsAssets ? zhimuApi.getAssets(Object.keys(params).length ? params : {}) : Promise.resolve({ assets: assetStore.get().cloudAssets, total: assetStore.get().assetTotal }),
          needsCreatorChecks ? zhimuApi.getCreatorChecks() : Promise.resolve({ checks: worldStore.get().cloudCreatorChecks })
        ]);
        take(phase3[0], (value) => { assetStore.set({ storageUsage: value }); });
        take(phase3[1], (value) => {
          if (Array.isArray(value)) {
            assetStore.set({ cloudAssets: value, assetTotal: value.length });
          } else {
            assetStore.set({ cloudAssets: value.assets || [], assetTotal: value.total ?? (value.assets || []).length });
          }
        });
        take(phase3[2], (value) => { worldStore.set({ cloudCreatorChecks: value.checks }); });
        if (["overview", "account", "settings", "writer", "studio", "clues"].includes(uiStore.get().view)) render();
      })();

      void (async () => {
        const roomSnap = roomStore.get();
        const voiceSnap = voiceStore.get();
        const voiceRooms = roomSnap.cloudPlayer?.voiceRooms || [];
        const currentRoom = voiceRooms.find((r) => r.id === voiceSnap.voiceRoomId) || voiceRooms[0];
        if (!currentRoom) return;
        voiceStore.set({ voiceRoomId: currentRoom.id, voiceRoom: currentRoom.name });
        try {
          voiceStore.set({ voiceMessages: await zhimuApi.getVoiceMessages(currentRoom.id) });
          if (uiStore.get().view === "player") render();
        } catch (error) {
          userStore.set({ apiError: [userStore.get().apiError, error.message].filter(Boolean).join(" · ") });
        }
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
    runtimeStore().clearRuntimeState?.();
  }

export function applyHostPlayersPayload(value) {
    runtimeStore().applyHostPlayersPayload?.(value);
  }

  function failHostPlayersLoad(error) {
    runtimeStore().failHostPlayersLoad?.(error);
  }

export async function refreshHostEvents(withToast = false, silent = false) {
    if (!zhimuApi.context.roomId) {
      if (withToast && !silent) showToast("请先选择运行房");
      return;
    }
    try {
      const cloudHostEvents = await zhimuApi.getHostEvents() || [];
      roomStore.set({ cloudHostEvents });
      updateNotifyBadge();
      if (["director", "overview"].includes(uiStore.get().view)) render();
      if (withToast && !silent) showToast(`待确认事件已刷新（${cloudHostEvents.length} 条）`);
    } catch (error) {
      if (withToast && !silent) reportError(error, "刷新待确认事件失败");
    }
  }

export async function refreshHostPlayers(withToast = false, silent = false) {
    if (!zhimuApi.context.roomId) {
      if (withToast && !silent) showToast("请先选择运行房");
      return;
    }
    try {
      applyHostPlayersPayload(await zhimuApi.getHostPlayers());
      if (["director", "overview"].includes(uiStore.get().view)) render();
      if (withToast && !silent) showToast(`玩家进度已刷新（${roomStore.get().cloudHostPlayers.filter((player) => player.joined).length} 人已加入）`);
    } catch (error) {
      failHostPlayersLoad(error);
      if (["director", "overview"].includes(uiStore.get().view)) render();
      if (withToast && !silent) reportError(error, "刷新玩家进度失败");
    }
  }

export async function refreshHostAuditLog(withToast = false, silent = false) {
    if (!zhimuApi.context.roomId) {
      if (withToast && !silent) showToast("请先选择运行房");
      return;
    }
    try {
      const payload = await zhimuApi.getHostAuditLog();
      const cloudHostAuditLog = payload?.entries || [];
      roomStore.set({ cloudHostAuditLog });
      if (uiStore.get().view === "director") render();
      if (withToast && !silent) showToast(`主持审计已刷新（${cloudHostAuditLog.length} 条）`);
    } catch (error) {
      if (withToast && !silent) reportError(error, "刷新主持审计失败");
    }
  }

export async function refreshHostClueMatrix(withToast = false, silent = false) {
    if (!zhimuApi.context.roomId) return;
    try {
      roomStore.set({ cloudHostClueMatrix: await zhimuApi.getHostClueMatrix() });
      if (uiStore.get().view === "director") render();
      if (withToast && !silent) showToast("线索矩阵已刷新");
    } catch (error) {
      if (withToast && !silent) reportError(error, "刷新线索矩阵失败");
    }
  }

export async function refreshHostRoom(withToast = false) {
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
      const cloudHostEvents = hostEvents || [];
      const cloudWorldLogs = worldLogs || [];
      const cloudHostClueMatrix = clueMatrix;
      const cloudHostAuditLog = auditLog?.entries || [];
      roomStore.set({ cloudHostEvents, cloudHostClueMatrix, cloudHostAuditLog });
      worldStore.set({ cloudWorldLogs });
      updateNotifyBadge();
      if (["director", "overview"].includes(uiStore.get().view)) render();
      if (withToast) {
        showToast(`房间状态已刷新 · 待确认 ${cloudHostEvents.length} 条 · 玩家 ${roomStore.get().cloudHostPlayers.filter((player) => player.joined).length} 人`);
      }
    } catch (error) {
      failHostPlayersLoad(error);
      if (["director", "overview"].includes(uiStore.get().view)) render();
      if (withToast) reportError(error, "刷新房间状态失败");
    }
  }

export function enhanceCloudPanels() {}

export function refreshPlayerHome(...args) { return roomEvents().refreshPlayerHome?.(...args); }
export function refreshExploration(...args) { return roomEvents().refreshExploration?.(...args); }
export function syncDirectorPolling(...args) { return roomEvents().syncDirectorPolling?.(...args); }
export function refreshDirectorPoll(...args) { return roomEvents().refreshDirectorPoll?.(...args); }
export function disconnectRoomEventStream(...args) { return roomEvents().disconnectRoomEventStream?.(...args); }
export function scheduleRoomEventReconnect(...args) { return roomEvents().scheduleRoomEventReconnect?.(...args); }
export function connectRoomEventStream(...args) { return roomEvents().connectRoomEventStream?.(...args); }
export function handleRoomEvent(...args) { return roomEvents().handleRoomEvent?.(...args); }
export function streamUserIdForRoom(...args) { return roomEvents().streamUserIdForRoom?.(...args); }
export function renderQuotaSection(...args) { return window.zhimuAccountQuota?.renderQuotaSection?.(...args); }

registerRuntime({ loadCloudData, ensureActiveWorld, clearRuntimeState, applyHostPlayersPayload, refreshPlayerHome, refreshExploration, syncDirectorPolling, refreshDirectorPoll, refreshHostEvents, refreshHostPlayers, refreshHostClueMatrix, refreshHostAuditLog, refreshHostRoom, disconnectRoomEventStream, scheduleRoomEventReconnect, connectRoomEventStream, handleRoomEvent, streamUserIdForRoom, enhanceCloudPanels, renderQuotaSection });
