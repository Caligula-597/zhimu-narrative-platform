import "./styles.css";
import {
  api,
  clearSession,
  getPlayOrigin,
  getSessionToken,
  setSessionToken
} from "./api.js";
import { ALLOWED_OAUTH_PROVIDERS, isSafeOAuthRedirectUrl, isUuid, normalizeInviteCode, asArray } from "../../shared/security.js";
import { connectRoomEvents, disconnectRoomEvents } from "./room-events.js";
import { connectPlatformEvents, disconnectPlatformEvents } from "./platform-events.js";
import { formatApiError } from "./errors.js";
import { renderApp } from "./render.js";
import { closeModalState, openModalState } from "./components/modal.js";
import {
  connectVoiceLive,
  disconnectVoiceLive,
  ensureDefaultVoiceRoom,
  joinVoiceRoom,
  openCreateVoiceRoomModal,
  openInviteVoiceRoomModal,
  openVoiceRoomPicker,
  pauseVoiceSession,
  refreshVoiceMessages,
  resetVoiceOnLeave,
  sendVoiceChatMessage,
  submitCreateVoiceRoom,
  submitVoiceInvite,
  toggleVoiceMicLive,
  unlockVoicePlayback
} from "./runtime/voice.js";
import { bindPlayReader } from "./runtime/reader.js";
import { patchGameView, patchGameHostBanner, patchGameTabSwitch, patchGameSectionsTab, isGameInputFocused } from "./runtime/patch-game.js";
import { normalizeMiniGame } from "./components/mini-games.js";
import { defaultGameTabFor, primaryTabFor, tabGroupFor } from "./views/game.js";
import { initWebVitalsReporting } from "../../shared/web-vitals.js";
import {
  createRefreshCoalescer,
  patchSyncChrome,
  renderSyncStatusBannerHtml,
  shouldAutoScrollNearBottom
} from "./runtime/sync-helpers.js";
import { applyUrlToState, scrollRestoreKey, syncPlayUrl } from "./runtime/url.js";
import {
  bumpTabPulse,
  clearTabPulse,
  dmUnreadTotal,
  persistRoom,
  persistGameSession,
  persistGameSidebarCollapsed,
  setBusy,
  setToast,
  state
} from "./state.js";
import { setVoiceRenderCallback } from "./voice/livekit-voice.js";
import { createSessionController } from "./runtime/session-controller.js";
import { createSocialController } from "./runtime/social-controller.js";
import { resolveInitialRoute } from "./runtime/router.js";
import { runPlayStartup } from "./runtime/startup.js";
import { createPlayViewController } from "./runtime/view-controller.js";
import { bindPlayDomEvents } from "./runtime/dom-event-controller.js";
import { bindPlayFormEvents } from "./runtime/form-controller.js";
import { handlePlayStateAction } from "./runtime/state-action-controller.js";
import { handlePlayVoiceAction } from "./runtime/voice-action-controller.js";
import { handlePlaySocialAction } from "./runtime/social-action-controller.js";
import { handlePlayGameAction } from "./runtime/game-action-controller.js";
import { handlePlayClueAction } from "./runtime/clue-action-controller.js";
import { handlePlayTabAction } from "./runtime/tab-action-controller.js";
import { handlePlaySessionAction } from "./runtime/session-action-controller.js";
import { handlePlayContentAction } from "./runtime/content-action-controller.js";
import { createAuthFlowController } from "./runtime/auth-flow-controller.js";
import { createPlayerGameController } from "./runtime/player-game-controller.js";

const app = document.getElementById("app");
let pullGeneration = 0;
let lastSyncErrorToastAt = 0;

function patchSyncChromeOrRender() {
  if (patchSyncChrome(state)) return;
  render();
}

const { render } = createPlayViewController({
  app,
  state,
  renderApp,
  persistGameSession,
  scrollRestoreKey,
  shouldAutoScrollNearBottom,
  bindPlayReader,
  patchGameSectionsTab,
  getGamePatchCtx: () => gamePatchCtx,
  setToast,
  syncPlayUrl
});

setVoiceRenderCallback(render);

const {
  cleanAuthUrl,
  ensureSession,
  loadSessionUser,
  normalizeUser
} = createSessionController({ api, state, clearSession, getSessionToken, setSessionToken });

const {
  loadPlazaThread,
  loadFriends,
  loadDmConversations,
  loadDmThread,
  openPlazaThread,
  openDmConversation,
  openDmWithPeer,
  handlePlazaReplySubmit,
  handlePlayerSearch,
  handleDmSend,
  handlePlazaReport,
  submitPlazaReport,
  loadPlazaPosts,
  handlePlazaSubmit
} = createSocialController({
  api,
  state,
  render,
  setBusy,
  setToast,
  formatApiError,
  ensureSession,
  openModalState,
  closeModalState,
  normalizeInviteCode
});

async function loadPlatform() {
  try {
    state.platform = await api.platformSite();
  } catch {
    state.platform = null;
  }
}

async function loadAuthConfig() {
  try {
    state.authConfig = await api.authConfig();
  } catch {
    state.authConfig = null;
  }
}

async function flushPendingRoomRefresh() {
  if (!state.pendingRoomRefresh) return;
  state.pendingRoomRefresh = false;
  await pullRoomData({ partial: true });
}

function handleAuthLost() {
  clearSession();
  disconnectRoomEvents(roomEventCtx);
  disconnectPlatformEvents(platformEventCtx);
  state.user = null;
  state.home = null;
  setToast("登录已过期，请重新登录", render);
  state.view = "auth";
  render();
}

async function pullRoomData(options = {}) {
  const { partial = false } = options;
  if (!state.roomId || !isUuid(state.roomId)) return;
  const generation = ++pullGeneration;

  const [homeCore, explorationResult] = await Promise.all([
    loadPlayerHomeCoreCompat(state.roomId),
    api.exploration(state.roomId)
      .then((data) => ({ ok: true, data }))
      .catch((error) => ({ ok: false, error }))
  ]);
  if (generation !== pullGeneration) return;

  const previousSocial = state.home ? {
    notes: state.home.notes || [],
    clues: state.home.clues || [],
    sharedClues: state.home.sharedClues || [],
    roomMembers: state.home.roomMembers || [],
    suspicions: state.home.suspicions || [],
    testimonies: state.home.testimonies || [],
    privateActions: state.home.privateActions || []
  } : null;
  state.home = previousSocial ? { ...homeCore, ...previousSocial } : homeCore;
  const homeGame = homeCore.currentGame ?? homeCore.current_game ?? homeCore.roomRunningState?.current_game ?? homeCore.room_running_state?.current_game;
  if (homeGame !== undefined) state.currentGame = normalizeMiniGame(homeGame);
  if (explorationResult.ok) {
    state.exploration = explorationResult.data;
    state.explorationError = "";
  } else if (!state.exploration?.scenes?.length) {
    state.exploration = { scenes: [] };
    state.explorationError = formatApiError(explorationResult.error, "探索数据加载失败");
  } else {
    state.explorationError = formatApiError(explorationResult.error, "探索数据刷新失败");
  }
  const sections = state.home.sections || [];
  if (state.sectionId && !sections.some((section) => section.id === state.sectionId)) {
    state.sectionId = sections.find((section) => !section.completed)?.id || sections[0]?.id || "";
  } else if (!state.sectionId && sections.length) {
    state.sectionId = sections.find((section) => !section.completed)?.id || sections[0].id;
  }
  ensureDefaultVoiceRoom();
  if (state.tab === "voice" && state.voiceRoomId) {
    try {
      await refreshVoiceMessages(render, { silent: true });
    } catch {
      /* voice messages are best-effort on refresh */
    }
  }
  if (partial) {
    try {
      state.recapLatest = await api.latestRecap(state.roomId);
      state.recapError = "";
    } catch (error) {
      if (error.code === "RECAP_NOT_GENERATED") {
        state.recapLatest = null;
        state.recapError = "";
      }
    }
  }
  if (partial) {
    const patchResult = patchGameView(state, {
      pullRoomData: (opts) => pullRoomData(opts),
      onToast: (message) => setToast(message, render)
    });
    if (patchResult === "full" || patchResult === "chrome") {
      patchSyncChrome(state);
      if (patchResult === "chrome") state.pendingRoomRefresh = true;
      void refreshPlayerHomeSocial(generation, partial);
      return;
    }
  }
  render();
  void refreshPlayerHomeSocial(generation, partial);
}

async function loadPlayerHomeCoreCompat(roomId) {
  try {
    return await api.playerHomeCore(roomId);
  } catch (error) {
    if (error?.status === 404) return api.playerHome(roomId);
    throw error;
  }
}

async function refreshPlayerHomeSocial(generation, partial) {
  try {
    const social = await api.playerHomeSocial(state.roomId, state.home.currentActKey);
    if (generation !== pullGeneration || !state.home) return;
    state.home = { ...state.home, ...social };
    if (partial) {
      const patchResult = patchGameView(state, {
        pullRoomData: (opts) => pullRoomData(opts),
        onToast: (message) => setToast(message, render)
      });
      if (patchResult !== "full") return;
    }
    render();
  } catch {
    // Core data remains usable; social data is best-effort and retries on the next sync.
  }
}

const coalescedPartialRefresh = createRefreshCoalescer(async () => {
  try {
    await pullRoomData({ partial: true });
  } catch (error) {
    const now = Date.now();
    if (now - lastSyncErrorToastAt > 8000) {
      lastSyncErrorToastAt = now;
      setToast(formatApiError(error, "同步失败，将自动重试"), render);
    }
  }
});

const roomEventCtx = {
  getView: () => state.view,
  getRoomId: () => state.roomId,
  getRoleId: () => state.home?.role?.id || "",
  getUserId: () => state.user?.id || "",
  getTab: () => state.tab,
  getVoiceRoomId: () => state.voiceRoomId || "",
  bumpTabPulse,
  onVoiceRefresh: async () => {
    try {
      state.voiceScrollStickBottom = true;
      await refreshVoiceMessages(render, { silent: true });
      if (patchGameView(state, {
        pullRoomData: (opts) => pullRoomData(opts),
        onToast: (message) => setToast(message, render)
      }) !== "full") render();
    } catch {
      /* SSE voice refresh is best-effort */
    }
  },
  onRefresh: () => coalescedPartialRefresh(),
  onToast: (message) => setToast(message, render),
  onAuthLost: handleAuthLost,
  onKicked: handleKicked,
  setHostNudge: (message) => {
    state.hostNudge = message ? { message } : null;
    if (state.view === "game" && !patchGameHostBanner()) render();
  },
  setCurrentGame: (game) => {
    state.currentGame = normalizeMiniGame(game);
    if (state.view === "game" && patchGameView(state, gamePatchCtx) !== "full") return;
    render();
  },
  getHostConfirmWaiting: () => Boolean(state.home?.hostConfirm?.waitingForYou),
  setStreamStatus: (status) => {
    if (state.roomEventsStatus === status) return;
    state.roomEventsStatus = status;
    patchSyncChromeOrRender();
  },
  setConnected: (connected) => {
    if (state.roomEventsConnected === connected) return;
    state.roomEventsConnected = connected;
    patchSyncChromeOrRender();
  }
};

const platformEventCtx = {
  hasSession: () => Boolean(getSessionToken() || state.user?.id),
  getView: () => state.view,
  getPlazaPostId: () => state.plazaPostId,
  getDmConversationId: () => state.dmConversationId,
  onPlazaRefresh: () => loadPlazaPosts({ silent: true }),
  onPlazaThreadRefresh: () => loadPlazaThread({ silent: true }),
  onPlazaThreadClosed: () => {
    state.view = "plaza";
    state.plazaPostId = "";
    state.plazaPostDetail = null;
    state.plazaReplies = null;
    loadPlazaPosts({ silent: true });
    render();
  },
  onFriendsRefresh: () => loadFriends({ silent: true }),
  onMessagesRefresh: () => loadDmConversations({ silent: true }),
  onDmRefresh: () => loadDmThread({ silent: true }),
  onInGameCommRefresh: () => loadDmConversations({ silent: true }),
  onToast: (message) => setToast(message, render),
  onAuthLost: handleAuthLost,
  setStreamStatus: (status) => {
    if (state.platformEventsStatus === status) return;
    state.platformEventsStatus = status;
    patchSyncChromeOrRender();
  },
  setConnected: (connected) => {
    if (state.platformEventsConnected === connected) return;
    state.platformEventsConnected = connected;
    patchSyncChromeOrRender();
  }
};

function syncPlatformStream() {
  if (getSessionToken() || state.user?.id) connectPlatformEvents(platformEventCtx);
  else disconnectPlatformEvents(platformEventCtx);
}

async function goToLanding() {
  if (state.view === "game") {
    disconnectRoomEvents(roomEventCtx);
    await pauseVoiceSession();
  }
  state.view = "landing";
  state.joinPreview = null;
  state.joinStep = 1;
  state.plazaPostId = "";
  state.plazaPostDetail = null;
  state.plazaReplies = null;
  state.plazaReplyDraft = "";
  state.dmConversationId = "";
  state.dmThread = null;
  syncPlatformStream();
  render();
}

async function handleKicked(data) {
  disconnectRoomEvents(roomEventCtx);
  await pauseVoiceSession();
  persistRoom("", isUuid);
  state.home = null;
  state.exploration = null;
  state.view = "landing";
  const message = data?.roleName
    ? `主持人已将你移出角色「${data.roleName}」。同账号重新选角可继承进度。`
    : "主持人已将你移出房间。同账号重新选角可继承进度。";
  state.error = message;
  setToast(message, render);
  render();
}

function syncRoomStream() {
  if (state.view === "game" && state.roomId && isUuid(state.roomId)) {
    connectRoomEvents(state.roomId, roomEventCtx);
  } else {
    disconnectRoomEvents(roomEventCtx);
  }
  syncPlatformStream();
}

async function refreshHome() {
  if (!state.roomId) {
    disconnectRoomEvents(roomEventCtx);
    state.home = null;
    state.view = "landing";
    return;
  }
  if (!isUuid(state.roomId)) {
    persistRoom("", isUuid);
    disconnectRoomEvents(roomEventCtx);
    state.home = null;
    state.view = "landing";
    return;
  }
  try {
    await pullRoomData();
    state.view = "game";
    state.tab = state.tab || "home";
    persistGameSession();
    syncRoomStream();
    void loadRecapSummary({ silent: true });
    void loadDmConversations({ silent: true });
  } catch (error) {
    if (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 409) {
      disconnectRoomEvents(roomEventCtx);
      persistRoom("", isUuid);
      state.home = null;
      state.view = "landing";
      state.error = error.status === 409
        ? "你尚未在本房间选择角色，请重新输入邀请码加入。"
        : "无法进入上次房间，请重新输入邀请码。";
      throw error;
    }
    throw error;
  }
}

async function loadPublicRooms({ silent = false } = {}) {
  if (!silent) setBusy(true, render);
  try {
    state.publicRooms = await api.publicRooms();
    state.lobbyError = "";
  } catch (error) {
    state.lobbyError = formatApiError(error, "大厅列表加载失败");
    if (!state.publicRooms) state.publicRooms = { total: 0, items: [] };
  } finally {
    if (!silent) setBusy(false, render);
    else if (state.view === "landing" || state.view === "lobby") render();
  }
}

async function bootstrap() {
  initWebVitalsReporting({ app: "play", endpoint: "/api/metrics/web-vitals" });
  return runPlayStartup({
    state, api, render, setBusy, setToast, formatApiError, normalizeUser,
    setSessionToken, clearSession, cleanAuthUrl, loadSessionUser, ensureSession,
    loadAuthConfig, loadPlatform, loadPublicRooms, loadDmConversations,
    loadPlazaPosts, loadFriends, loadPlazaThread, handleJoinOfficial,
    handleLookupInvite, refreshHome, loadRecapSummary, syncPlatformStream,
    handleEmailVerify, normalizeInviteCode, isUuid, persistRoom, resolveInitialRoute
  });
}

async function refreshJoinPreview(code) {
  state.joinPreview = await api.lookupInvite(code);
  state.inviteCode = code;
  const boundRoleId = state.joinPreview.current_role_slot_id || "";
  const roles = state.joinPreview.roles || [];
  if (boundRoleId) {
    state.selectedRoleId = boundRoleId;
    return state.joinPreview;
  }
  const selected = roles.find((role) => role.id === state.selectedRoleId);
  if (!selected || (selected.occupied && !selected.occupied_by_current)) {
    state.selectedRoleId = roles.find((role) => !role.occupied || role.occupied_by_current)?.id || "";
  }
  return state.joinPreview;
}

async function handleLookupInvite({ silent = false } = {}) {
  const code = normalizeInviteCode(state.inviteCode);
  if (!code) return silent ? undefined : setToast("请输入邀请码", render);
  setBusy(true, render);
  try {
    await ensureSession();
    await refreshJoinPreview(code);
    const boundRoleId = state.joinPreview?.current_role_slot_id || "";
    const roomId = state.joinPreview?.room?.id || "";
    if (boundRoleId && roomId && isUuid(roomId)) {
      persistRoom(roomId, isUuid);
      await refreshHome();
      state.joinPreview = null;
      state.view = "game";
      if (!silent) showToast("已回到你绑定的角色", render);
      else render();
      return;
    }
    state.view = "join";
    state.joinStep = 2;
    render();
  } catch (error) {
    state.joinPreview = null;
    state.joinStep = 1;
    const message = formatApiError(error, "邀请码无效");
    if (!silent) setToast(message, render);
    else state.error = message;
  } finally {
    setBusy(false, render);
  }
}

async function handleJoinRoom() {
  const code = normalizeInviteCode(state.inviteCode);
  if (!code || !state.selectedRoleId) return setToast("请选择角色", render);
  setBusy(true, render);
  state.joinStep = 3;
  render();
  try {
    await ensureSession();
    await refreshJoinPreview(code);
    const selected = state.joinPreview?.roles?.find((role) => role.id === state.selectedRoleId);
    if (!selected || (selected.occupied && !selected.occupied_by_current)) {
      state.joinStep = 2;
      setToast("该角色刚被其他玩家选走，请重新选择", render);
      return;
    }
    const result = await api.joinRoom(code, state.selectedRoleId);
    persistRoom(result.roomId, isUuid);
    state.joinPreview = null;
    cleanAuthUrl();
    await refreshHome();
    const sections = state.home?.sections || [];
    const hasIncomplete = sections.some((section) => !section.completed);
    state.tab = hasIncomplete && sections.length ? "sections" : "home";
    setToast("已加入房间，欢迎来到故事现场", render);
  } catch (error) {
    state.joinStep = 2;
    if (error.code === "ROLE_SLOT_OCCUPIED") {
      try {
        await refreshJoinPreview(code);
      } catch {
        state.joinPreview = null;
      }
    }
    setToast(formatApiError(error, "加入失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handleJoinOfficial({ silent = false } = {}) {
  setBusy(true, render);
  try {
    await ensureSession();
    const result = await api.joinOfficialExample();
    state.inviteCode = result.room?.invite_code || "";
    if (!state.inviteCode) throw new Error("示例房间创建失败");
    cleanAuthUrl();
    await handleLookupInvite({ silent: true });
    if (!silent) setToast("已创建示例运行房，请选择角色", render);
  } catch (error) {
    const needsAuth = error.code === "EMAIL_NOT_VERIFIED" || error.status === 403;
    if (needsAuth) {
      state.error = "体验官方示例需要登录并验证邮箱。";
      state.view = "auth";
    } else if (!silent) {
      setToast(error.message || "无法进入示例", render);
    } else {
      state.error = formatApiError(error, "无法进入官方示例");
    }
  } finally {
    setBusy(false, render);
  }
}

const gamePatchCtx = {
  pullRoomData: (opts) => pullRoomData(opts),
  onToast: (message) => setToast(message, render),
  render
};

const {
  handleCompletePlayerTask,
  handleSubmitTestimony,
  handleSubmitSatisfaction,
  handleCompleteSection,
  handleInvestigate,
  handleMiniGameSubmit,
  handleReadClue
} = createPlayerGameController({
  api, state, render, setBusy, setToast, formatApiError, pullRoomData,
  patchGameView, patchGameSectionsTab, gamePatchCtx, coalescedPartialRefresh,
  openModalState, normalizeMiniGame, asArray
});

async function loadRecapSummary({ silent = false } = {}) {
  if (!state.roomId) return;
  if (!silent) {
    state.recapLoading = true;
    state.recapError = "";
    render();
  }
  try {
    state.recapLatest = await api.latestRecap(state.roomId);
    state.recapError = "";
  } catch (error) {
    if (error.code === "RECAP_NOT_GENERATED") {
      state.recapLatest = null;
      state.recapError = "";
    } else {
      state.recapError = formatApiError(error, "加载复盘失败");
    }
  } finally {
    state.recapLoading = false;
    if (!silent || state.tab === "recap") render();
  }
}

async function loadRecapDetail() {
  if (!state.roomId || !state.recapLatest?.id) return;
  setBusy(true, render);
  try {
    state.recapDetail = await api.getRecap(state.roomId, state.recapLatest.id);
    state.recapId = state.recapDetail.id;
    render();
  } catch (error) {
    setToast(formatApiError(error, "无法打开复盘"), render);
  } finally {
    setBusy(false, render);
  }
}

async function loadMyTimeline({ silent = false } = {}) {
  if (!state.roomId) return;
  if (!silent) {
    state.myTimelineLoading = true;
    state.myTimelineError = "";
    render();
  }
  try {
    state.myTimeline = await api.myTimeline(state.roomId);
    state.myTimelineError = "";
  } catch (error) {
    state.myTimelineError = formatApiError(error, "加载时间线失败");
  } finally {
    state.myTimelineLoading = false;
    if (!silent || state.tab === "timeline") render();
  }
}

async function handleAddNotebookEntry() {
  if (!state.roomId) return;
  const title = (state.notesDraftTitle || "").trim();
  const body = (state.notesDraft || "").trim();
  if (!title || !body) {
    setToast("请填写标题和正文", render);
    return;
  }
  setBusy(true, render);
  try {
    await api.addNotebookEntry(state.roomId, {
      sourceType: "free",
      sourceId: null,
      title,
      body
    });
    state.notesDraft = "";
    state.notesDraftTitle = "";
    await pullRoomData({ partial: true });
    setToast("笔记已保存", render);
  } catch (error) {
    setToast(formatApiError(error, "保存失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handleDeleteNotebookEntry(entryId) {
  if (!state.roomId || !entryId) return;
  setBusy(true, render);
  try {
    await api.deleteNotebookEntry(state.roomId, entryId);
    await pullRoomData({ partial: true });
    setToast("笔记已删除", render);
  } catch (error) {
    setToast(formatApiError(error, "删除失败"), render);
  } finally {
    setBusy(false, render);
  }
}

const {
  handleEmailVerify,
  handleForgotSubmit,
  handleResetSubmit,
  handleResendVerification,
  handleGuestSubmit,
  handleAuthSubmit,
  handleOAuth,
  handleLogout
} = createAuthFlowController({
  api, state, render, setBusy, setToast, formatApiError, setSessionToken,
  clearSession, cleanAuthUrl, normalizeUser, refreshHome, handleLookupInvite,
  syncPlatformStream, ensureSession, getPlayOrigin, isSafeOAuthRedirectUrl,
  allowedOAuthProviders: ALLOWED_OAUTH_PROVIDERS, resetVoiceOnLeave,
  disconnectRoomEvents, disconnectPlatformEvents, roomEventCtx, platformEventCtx,
  persistRoom, isUuid
});

bindPlayDomEvents({
  app,
  state,
  render,
  closeModalState,
  flushPendingRoomRefresh,
  isGameInputFocused
});

bindPlayFormEvents({
  app,
  state,
  render,
  setToast,
  setBusy,
  sendVoiceChatMessage,
  handlePlazaSubmit,
  handlePlazaReplySubmit,
  handlePlayerSearch,
  handleDmSend,
  handleAuthSubmit,
  handleForgotSubmit,
  handleResetSubmit,
  handleGuestSubmit
});

app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (
    state.busy
    && !["dismiss-error", "modal-close", "modal-backdrop-close", "voice-room", "voice-join"].includes(
      button.dataset.action
    )
  ) {
    return;
  }
  const action = button.dataset.action;
  if (handlePlayStateAction({
    action,
    button,
    event,
    state,
    render,
    closeModalState,
    persistGameSidebarCollapsed
  })) return;
  if (await handlePlayVoiceAction({
    action,
    button,
    render,
    setBusy,
    setToast,
    formatApiError,
    openVoiceRoomPicker,
    openCreateVoiceRoomModal,
    openInviteVoiceRoomModal,
    joinVoiceRoom,
    connectVoiceLive,
    disconnectVoiceLive,
    toggleVoiceMicLive,
    unlockVoicePlayback,
    refreshVoiceMessages,
    sendVoiceChatMessage,
    submitCreateVoiceRoom,
    submitVoiceInvite
  })) return;
  if (await handlePlaySocialAction({
    action,
    button,
    state,
    render,
    api,
    setBusy,
    setToast,
    formatApiError,
    openModalState,
    closeModalState,
    normalizeInviteCode,
    syncPlatformStream,
    loadPublicRooms,
    loadPlazaPosts,
    openPlazaThread,
    handlePlazaReport,
    submitPlazaReport,
    loadPlazaThread,
    loadFriends,
    loadDmConversations,
    openDmConversation,
    openDmWithPeer,
    ensureSession,
    handleLookupInvite
  })) return;
  if (await handlePlayGameAction({
    action,
    button,
    state,
    api,
    render,
    setToast,
    formatApiError,
    pullRoomData,
    handleCompleteSection,
    handleCompletePlayerTask,
    handleSubmitTestimony,
    handleSubmitSatisfaction,
    handleReadClue,
    handleInvestigate,
    handleMiniGameSubmit
  })) return;
  if (await handlePlayClueAction({
    action,
    button,
    state,
    api,
    render,
    setBusy,
    setToast,
    formatApiError,
    openModalState,
    closeModalState,
    pullRoomData
  })) return;
  if (await handlePlayTabAction({
    action, button, state, render, gamePatchCtx, flushPendingRoomRefresh,
    defaultGameTabFor, tabGroupFor, clearTabPulse, primaryTabFor,
    patchGameTabSwitch, syncPlayUrl, ensureDefaultVoiceRoom, refreshVoiceMessages,
    loadRecapSummary, loadMyTimeline, bindPlayReader, pullRoomData, setToast
  })) return;
  if (await handlePlaySessionAction({
    action, button, event, state, render, normalizeInviteCode, handleLookupInvite,
    handleJoinRoom, handleJoinOfficial, handleResendVerification, goToLanding,
    handleGuestSubmit, handleOAuth, handleLogout, resetVoiceOnLeave,
    disconnectRoomEvents, roomEventCtx, persistRoom, isUuid, syncPlatformStream,
    refreshHome, setToast
  })) return;
  await handlePlayContentAction({
    action, button, state, api, render, setBusy, setToast, formatApiError,
    loadRecapDetail, loadRecapSummary, patchGameHostBanner,
    handleAddNotebookEntry, handleDeleteNotebookEntry
  });
});

bootstrap();
