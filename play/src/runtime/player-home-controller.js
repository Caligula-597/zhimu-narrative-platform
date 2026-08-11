import { createRefreshCoalescer } from "./sync-helpers.js";

const SOCIAL_FIELDS = [
  "notes", "clues", "sharedClues", "roomMembers",
  "suspicions", "testimonies", "privateActions"
];

export function createPlayerHomeController({
  api, state, render, isUuid, normalizeMiniGame, formatApiError,
  ensureDefaultVoiceRoom, refreshVoiceMessages, patchGameView,
  patchSyncChrome, setToast, now = Date.now
}) {
  let generation = 0;
  let lastSyncErrorToastAt = 0;

  async function loadPlayerHomeCoreCompat(roomId) {
    try {
      return await api.playerHomeCore(roomId);
    } catch (error) {
      if (error?.status === 404) return api.playerHome(roomId);
      throw error;
    }
  }

  async function pullRoomData({ partial = false } = {}) {
    if (!state.roomId || !isUuid(state.roomId)) return;
    const currentGeneration = ++generation;
    const [homeCore, explorationResult, discoveryResult, paceClockResult, conclusionResult, itemActionsResult, relationshipsResult] = await Promise.all([
      loadPlayerHomeCoreCompat(state.roomId),
      api.exploration(state.roomId)
        .then((data) => ({ ok: true, data }))
        .catch((error) => ({ ok: false, error })),
      typeof api.discoverySessions === "function"
        ? api.discoverySessions(state.roomId)
            .then((data) => ({ ok: true, data }))
            .catch((error) => ({ ok: false, error }))
        : Promise.resolve({ ok: true, data: { sessions: [] } }),
      typeof api.paceClock === "function"
        ? api.paceClock(state.roomId)
            .then((data) => ({ ok: true, data }))
            .catch((error) => ({ ok: false, error }))
        : Promise.resolve({ ok: true, data: { clock: null } }),
      typeof api.roomConclusion === "function"
        ? api.roomConclusion(state.roomId)
            .then((data) => ({ ok: true, data }))
            .catch((error) => ({ ok: false, error }))
        : Promise.resolve({ ok: true, data: { conclusion: null } }),
      typeof api.itemActions === "function"
        ? api.itemActions(state.roomId)
            .then((data) => ({ ok: true, data }))
            .catch((error) => ({ ok: false, error }))
        : Promise.resolve({ ok: true, data: { itemActions: [] } }),
      typeof api.relationships === "function"
        ? api.relationships(state.roomId)
            .then((data) => ({ ok: true, data }))
            .catch((error) => ({ ok: false, error }))
        : Promise.resolve({ ok: true, data: { relationships: [] } })
    ]);
    if (currentGeneration !== generation) return;

    state.home = mergeCoreWithPreviousSocial(homeCore, state.home);
    const homeGame = homeCore.currentGame ?? homeCore.current_game
      ?? homeCore.roomRunningState?.current_game ?? homeCore.room_running_state?.current_game;
    if (homeGame !== undefined) state.currentGame = normalizeMiniGame(homeGame);
    applyExplorationResult(explorationResult);
    applyDiscoveryResult(discoveryResult);
    applyPaceClockResult(paceClockResult);
    applyConclusionResult(conclusionResult);
    applyItemActionsResult(itemActionsResult);
    applyRelationshipsResult(relationshipsResult);
    selectAvailableSection();
    await refreshVoiceIfActive();

    if (partial) {
      const patchResult = patchGameView(state, patchContext());
      if (patchResult === "full" || patchResult === "chrome") {
        patchSyncChrome(state);
        if (patchResult === "chrome") state.pendingRoomRefresh = true;
        void refreshSupplemental(currentGeneration, partial);
        return;
      }
    }
    render();
    void refreshSupplemental(currentGeneration, partial);
  }

  function patchContext() {
    return {
      pullRoomData: (options) => pullRoomData(options),
      onToast: (message) => setToast(message, render)
    };
  }

  function applyExplorationResult(result) {
    if (result.ok) {
      state.exploration = result.data;
      state.explorationError = "";
    } else if (!state.exploration?.scenes?.length) {
      state.exploration = { scenes: [] };
      state.explorationError = formatApiError(result.error, "探索数据加载失败");
    } else {
      state.explorationError = formatApiError(result.error, "探索数据刷新失败");
    }
  }

  function applyDiscoveryResult(result) {
    if (result.ok) {
      state.discoverySessions = Array.isArray(result.data?.sessions) ? result.data.sessions : [];
      state.discoverySyncError = "";
      return;
    }
    state.discoverySyncError = formatApiError(result.error, "地点探索进度同步失败");
  }

  function applyPaceClockResult(result) {
    if (!result.ok) return;
    state.paceClock = result.data?.clock
      ? { ...result.data.clock, _receivedAt: Date.now() }
      : null;
  }

  function applyConclusionResult(result) {
    if (!result.ok) return;
    state.sessionConclusion = result.data?.conclusion || null;
  }

  function applyItemActionsResult(result) {
    if (!result.ok) return;
    state.itemActions = Array.isArray(result.data?.itemActions) ? result.data.itemActions : [];
  }

  function applyRelationshipsResult(result) {
    if (!result.ok) return;
    state.relationships = Array.isArray(result.data?.relationships) ? result.data.relationships : [];
  }

  function selectAvailableSection() {
    const sections = state.home?.sections || [];
    if (state.sectionId && !sections.some((section) => section.id === state.sectionId)) {
      state.sectionId = sections.find((section) => !section.completed)?.id || sections[0]?.id || "";
    } else if (!state.sectionId && sections.length) {
      state.sectionId = sections.find((section) => !section.completed)?.id || sections[0].id;
    }
  }

  async function refreshVoiceIfActive() {
    ensureDefaultVoiceRoom();
    if (state.tab !== "voice" || !state.voiceRoomId) return;
    await refreshVoiceMessages(render, { silent: true }).catch(() => {});
  }

  async function refreshSupplemental(currentGeneration, partial) {
    const socialPromise = api.playerHomeSocial(state.roomId, state.home?.currentActKey);
    const recapPromise = partial
      ? api.latestRecap(state.roomId)
      : Promise.resolve(undefined);
    const [socialResult, recapResult] = await Promise.allSettled([
      socialPromise,
      recapPromise
    ]);
    if (currentGeneration !== generation || !state.home) return;

    if (socialResult.status === "fulfilled") {
      state.home = { ...state.home, ...socialResult.value };
    }
    if (partial) applyRecapResult(recapResult);
    if (
      socialResult.status !== "fulfilled"
      || !socialResult.value?.currentState
    ) {
      await refreshCurrentState(currentGeneration, partial);
      if (currentGeneration !== generation || !state.home) return;
    }

    if (partial && patchGameView(state, patchContext()) !== "full") return;
    render();
  }

  async function refreshCurrentState(currentGeneration, partial) {
    if (typeof api.playerCurrentState !== "function") return;
    try {
      const currentState = await api.playerCurrentState(state.roomId);
      if (currentGeneration !== generation || !state.home) return;
      state.home = { ...state.home, currentState };
      if (partial && patchGameView(state, patchContext()) !== "full") return;
      render();
    } catch {
      // Current-state guidance is an enhancement; the authored reader remains
      // usable while SSE/poll recovery retries this projection.
    }
  }

  function applyRecapResult(result) {
    if (result.status === "fulfilled") {
      state.recapLatest = result.value;
      state.recapError = "";
    } else if (result.reason?.code === "RECAP_NOT_GENERATED") {
      state.recapLatest = null;
      state.recapError = "";
    }
  }

  async function flushPendingRoomRefresh() {
    if (!state.pendingRoomRefresh) return;
    state.pendingRoomRefresh = false;
    await pullRoomData({ partial: true });
  }

  const coalescedPartialRefresh = createRefreshCoalescer(async () => {
    try {
      await pullRoomData({ partial: true });
    } catch (error) {
      const timestamp = now();
      if (timestamp - lastSyncErrorToastAt > 8000) {
        lastSyncErrorToastAt = timestamp;
        setToast(formatApiError(error, "同步失败，将自动重试"), render);
      }
    }
  });

  return { pullRoomData, flushPendingRoomRefresh, coalescedPartialRefresh, loadPlayerHomeCoreCompat };
}

function mergeCoreWithPreviousSocial(homeCore, previousHome) {
  if (!previousHome) return homeCore;
  const previousSocial = Object.fromEntries(
    SOCIAL_FIELDS.map((field) => [field, previousHome[field] || []])
  );
  return {
    ...homeCore,
    ...previousSocial,
    // Voice availability is runtime state, not an append-only social slice.
    // Prefer every fresh core value so host start/end policy changes become
    // visible immediately after SSE or reconnect refreshes.
    voiceRooms: homeCore.voiceRooms ?? previousHome.voiceRooms ?? [],
    voiceRoster: homeCore.voiceRoster ?? previousHome.voiceRoster ?? [],
    voicePolicy: homeCore.voicePolicy ?? previousHome.voicePolicy ?? null
  };
}
