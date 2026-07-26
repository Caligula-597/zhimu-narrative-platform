/**
 * Coordinates auth / world / room context resets so demo, login, and runtime state stay in sync.
 * Call these instead of scattering zhimuApi + state mutations across views.
 */
import * as zhimuApi from "../api/index.js";
import { studioStore, worldStore, roomStore, assetStore, userStore, uiStore } from "../state/index.js";
import { clearRuntimeState } from "./runtime-store.js";
import { invalidateStudioSnapshot } from "./studio-loader.js";
(function (window) {
  function clearWorldScopedState() {
    invalidateStudioSnapshot({ clear: true });
    studioStore.set({ cloudStudio: null, studioLoading: false, studioError: "" });
    worldStore.set({
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
      cloudAiPlaytestDraftConfig: null,
      cloudCreatorDashboard: null,
      cloudWorkspacePreview: null,
      cloudWorldLogs: [],
      cloudWorldReleases: null
    });
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
      activeRecapId: null,
      cloudPlayer: null,
      cloudExploration: null
    });
    assetStore.set({ cloudAssets: [], storageUsage: null });
    userStore.set({ apiError: "" });
  }

  /** After login / register / OAuth — drop demo world pointer and in-memory account cache. */
  function resetAccountContext() {
    zhimuApi.resetActiveWorld?.();
    invalidateStudioSnapshot({ clear: true });
    studioStore.set({ cloudStudio: null, studioLoading: false, studioError: "" });
    worldStore.set({
      cloudWorkspacePreview: null,
      cloudWorldReleases: null,
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
    uiStore.set({ accountView: null });
    clearRuntimeState();
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
    clearRuntimeState();
  }

  /** Logout — token cleared by caller; resets workspace + session UI flags. */
  function onSessionLogout() {
    zhimuApi.resetActiveWorld?.();
    invalidateStudioSnapshot({ clear: true });
    studioStore.set({ cloudStudio: null, studioLoading: false, studioError: "" });
    worldStore.set({
      cloudWorkspacePreview: null,
      cloudWorldReleases: null,
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
    uiStore.set({ accountView: null });
    sessionStorage.removeItem("zhimuAuthPrompted");
    clearRuntimeState();
  }

  /** Current world deleted — drop pointers and runtime. */
  function onCurrentWorldDeleted() {
    zhimuApi.clearWorld();
    zhimuApi.clearRoom();
    invalidateStudioSnapshot({ clear: true });
    studioStore.set({ cloudStudio: null, studioLoading: false, studioError: "" });
    worldStore.set({
      cloudWorkspacePreview: null,
      cloudWorldReleases: null,
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
    clearRuntimeState();
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
