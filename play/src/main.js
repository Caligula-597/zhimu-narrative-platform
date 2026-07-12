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

async function handleCompletePlayerTask(taskId) {
  try {
    await api.completePlayerTask(state.roomId, taskId);
    await pullRoomData({ partial: true });
    setToast("任务已标记完成", render, { patch: true });
  } catch (error) {
    setToast(formatApiError(error, "操作失败"), render, { patch: true });
  }
}

async function handleSubmitTestimony() {
  const textarea = document.querySelector("[data-testimony-body]");
  const body = textarea?.value?.trim();
  if (!body) {
    setToast("请填写口供内容", render);
    return;
  }
  try {
    await api.submitTestimony(state.roomId, { actKey: state.home?.currentActKey, body });
    if (textarea) textarea.value = "";
    await pullRoomData({ partial: true });
    setToast("口供已提交给主持人", render);
  } catch (error) {
    setToast(formatApiError(error, "提交失败"), render);
  }
}

async function handleSubmitSatisfaction() {
  const rating = document.querySelector("[data-satisfaction-rating]")?.value;
  const comment = document.querySelector("[data-satisfaction-comment]")?.value?.trim() || "";
  if (!rating) {
    setToast("请选择满意度评分", render);
    return;
  }
  try {
    await api.submitSatisfaction({
      roomId: state.roomId,
      subject: `满意度 ${rating}/5`,
      body: comment || `玩家评分：${rating}/5`
    });
    state.satisfactionSubmitted = true;
    setToast("感谢你的反馈", render);
  } catch (error) {
    setToast(formatApiError(error, "提交失败"), render);
  }
}

async function handleCompleteSection(sectionId) {
  const sections = state.home?.sections || [];
  const target = sections.find((section) => section.id === sectionId);
  const prevCompleted = target ? { ...target } : null;

  if (target) {
    target.completed = true;
    if (state.tab === "sections") {
      patchGameSectionsTab(state, gamePatchCtx);
    } else {
      patchGameView(state, gamePatchCtx);
    }
  }

  try {
    const result = await api.completeSection(state.roomId, sectionId);
    if (result?.executedRules?.length) {
      void coalescedPartialRefresh();
    }
    setToast("已标记阅读完成", render, { patch: true });
  } catch (error) {
    if (prevCompleted && target) Object.assign(target, prevCompleted);
    if (state.tab === "sections") patchGameSectionsTab(state, gamePatchCtx);
    else patchGameView(state, gamePatchCtx);
    setToast(formatApiError(error, "操作失败"), render, { patch: true });
  }
}

async function handleInvestigate(pointId) {
  const scenes = state.exploration?.scenes || [];
  let pointRef = null;
  for (const scene of scenes) {
    const found = asArray(scene.investigation_points).find((p) => p.id === pointId);
    if (found) {
      pointRef = found;
      break;
    }
  }
  const prevInvestigated = pointRef?.investigated;
  const prevResultText = pointRef?.resultText;

  if (pointRef) {
    pointRef.investigated = true;
    pointRef.resultText = "调查中…";
    if (state.tab === "explore" && patchGameView(state, gamePatchCtx) === "chrome") {
      render();
    } else if (state.tab === "explore") {
      /* patched */
    }
  } else {
    setBusy(true, render);
  }

  try {
    const result = await api.investigate(state.roomId, pointId);
    await pullRoomData({ partial: true });
    openModalState({
      kind: "investigate",
      title: "调查结果",
      investigation: {
        resultText: result.resultText,
        clueName: result.clue?.name || ""
      }
    });
    render();
  } catch (error) {
    if (pointRef) {
      pointRef.investigated = prevInvestigated ?? false;
      pointRef.resultText = prevInvestigated ? (prevResultText ?? pointRef.resultText) : (prevResultText ?? "");
      if (state.tab === "explore") patchGameView(state, gamePatchCtx);
    }
    setToast(formatApiError(error, "调查失败"), render);
  } finally {
    if (!pointRef) setBusy(false, render);
  }
}

async function handleMiniGameSubmit(button) {
  const game = normalizeMiniGame(state.currentGame);
  if (!game?.instanceId) return setToast("当前没有可提交的解密机关", render);
  const root = button.closest("[data-mini-game]");
  const answer = root?.querySelector("[data-mini-game-answer]")?.value?.trim() || "";
  if (!answer) return setToast("请输入密码", render);
  setBusy(true, render);
  try {
    const result = await api.submitMiniGame({
      roomId: state.roomId,
      instance_id: game.instanceId,
      instanceId: game.instanceId,
      answer
    });
    state.currentGame = normalizeMiniGame(result.currentGame || result.current_game || result.game || {
      ...game,
      status: result.correct ? "success" : "playing",
      attempts_left: result.attempts_left ?? result.attemptsLeft ?? game.attemptsLeft
    });
    setToast(result.correct ? "机关已解开" : "密码不正确", render);
  } catch (error) {
    setToast(formatApiError(error, "提交失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handleReadClue(clueId) {
  setBusy(true, render);
  try {
    await api.readClue(state.roomId, clueId);
    await pullRoomData({ partial: true });
    state.clueId = clueId;
  } catch (error) {
    setToast(formatApiError(error, "无法阅读线索"), render);
  } finally {
    setBusy(false, render);
  }
}

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

async function handleEmailVerify(token) {
  const result = await api.verifyEmail(token);
  if (result.token) setSessionToken(result.token);
  state.user = normalizeUser(result.user);
  cleanAuthUrl();
  setToast("邮箱已验证，可以使用社区功能了", render);
}

async function handleForgotSubmit(form) {
  const email = form.email.value.trim();
  setBusy(true, render);
  try {
    await api.forgotPassword(email);
    setToast("若该邮箱已注册，重置链接已发送，请查收邮件", render);
    state.authMode = "login";
    render();
  } catch (error) {
    setToast(formatApiError(error, "发送失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handleResetSubmit(form) {
  const password = form.password.value;
  if (!state.resetToken) return setToast("重置链接无效", render);
  setBusy(true, render);
  try {
    await api.resetPassword(state.resetToken, password);
    state.authMode = "login";
    state.resetToken = "";
    cleanAuthUrl();
    setToast("密码已更新，请使用新密码登录", render);
    render();
  } catch (error) {
    setToast(formatApiError(error, "重置失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handleResendVerification() {
  setBusy(true, render);
  try {
    await api.resendVerification();
    setToast("验证邮件已发送，请查收", render);
  } catch (error) {
    setToast(formatApiError(error, "发送失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handleGuestSubmit(form) {
  const customName = form.displayName?.value?.trim() || "";
  const displayName = customName || `玩家${Math.floor(Math.random() * 9000 + 1000)}`;
  setBusy(true, render);
  try {
    const result = await api.guest(displayName);
    setSessionToken(result.token);
    state.user = normalizeUser(result.user);
    state.view = state.roomId ? "game" : (state.joinPreview ? "join" : "landing");
    cleanAuthUrl();
    if (state.roomId) await refreshHome();
    else if (state.inviteCode && !state.joinPreview) await handleLookupInvite({ silent: true }).catch(() => {});
    setToast(`欢迎，${state.user.displayName || "访客"}`, render);
    syncPlatformStream();
  } catch (error) {
    setToast(formatApiError(error, "访客登录失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handleAuthSubmit(form) {
  const email = form.email.value.trim();
  const password = form.password.value;
  const displayName = form.displayName?.value?.trim() || "";
  setBusy(true, render);
  try {
    let result;
    if (state.authMode === "register") {
      result = await api.register(email, displayName, password);
      if (result.pendingEmailVerification && !result.token) {
        setToast(result.message || "注册成功，请先验证邮箱后再登录", render);
        state.authMode = "login";
        render();
        return;
      }
    } else {
      result = await api.login(email, password);
    }
    setSessionToken(result.token);
    state.user = normalizeUser(result.user);
    state.view = state.roomId ? "game" : (state.joinPreview ? "join" : "landing");
    cleanAuthUrl();
    if (state.roomId) await refreshHome();
    else if (state.inviteCode && !state.joinPreview) await handleLookupInvite({ silent: true }).catch(() => {});
    setToast(`欢迎，${result.user.displayName || result.user.email || "玩家"}`, render);
    syncPlatformStream();
  } catch (error) {
    setToast(formatApiError(error, "登录失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handleOAuth(provider) {
  if (!ALLOWED_OAUTH_PROVIDERS.has(provider)) {
    setToast("不支持的登录方式", render);
    return;
  }
  setBusy(true, render);
  try {
    await ensureSession();
    const { url } = await api.oauthStartUrl(provider, getPlayOrigin());
    if (!isSafeOAuthRedirectUrl(url)) throw new Error("OAuth 跳转地址无效");
    window.location.assign(url);
  } catch (error) {
    setToast(error.message || "OAuth 暂不可用", render);
    setBusy(false, render);
  }
}

async function handleLogout() {
  await resetVoiceOnLeave();
  disconnectRoomEvents(roomEventCtx);
  disconnectPlatformEvents(platformEventCtx);
  clearSession();
  persistRoom("", isUuid);
  state.home = null;
  state.user = null;
  state.view = "landing";
  render();
  ensureSession().catch(() => {});
}

app.addEventListener("input", (event) => {
  if (event.target.dataset.bind === "inviteCode") state.inviteCode = event.target.value;
  if (event.target.dataset.bind === "plazaBody") state.plazaDraftBody = event.target.value;
  if (event.target.dataset.bind === "plazaInvite") state.plazaDraftInvite = event.target.value;
  if (event.target.dataset.bind === "plazaReplyBody") state.plazaReplyDraft = event.target.value;
  if (event.target.dataset.bind === "playerSearch") state.playerSearchQuery = event.target.value;
  if (event.target.dataset.bind === "dmBody") state.dmDraftBody = event.target.value;
  if (event.target.dataset.bind === "modalDraft") state.modalDraft = event.target.value;
  if (event.target.dataset.bind === "voiceChat") state.voiceChatDraft = event.target.value;
  if (event.target.dataset.bind === "notesTitle") state.notesDraftTitle = event.target.value;
  if (event.target.dataset.bind === "notesBody") state.notesDraft = event.target.value;
});

app.addEventListener("change", (event) => {
  if (event.target.matches("[data-voice-invite]")) {
    state.voiceInviteUserIds = [...document.querySelectorAll("[data-voice-invite]:checked")]
      .map((input) => input.value)
      .filter(Boolean);
    return;
  }
  if (event.target.matches("[data-share-role]")) {
    state.clueShareRoles = [...document.querySelectorAll("[data-share-role]:checked")].map((input) => input.value);
    return;
  }
  if (event.target.dataset.bind === "sectionId") {
    state.sectionId = event.target.value;
    render();
  }
  if (event.target.dataset.bind === "plazaKind") {
    state.plazaDraftKind = event.target.value === "recruit" ? "recruit" : "chat";
    render();
  }
});

app.addEventListener("submit", async (event) => {
  const voiceForm = event.target.closest("[data-form='voice-send']");
  if (voiceForm) {
    event.preventDefault();
    state.voiceChatDraft = voiceForm.body.value;
    await sendVoiceChatMessage({ render, setToast, setBusy });
    return;
  }
  const plazaForm = event.target.closest("[data-form='plaza']");
  if (plazaForm) {
    event.preventDefault();
    if (state.busy) return;
    await handlePlazaSubmit(plazaForm);
    return;
  }
  const replyForm = event.target.closest("[data-form='plaza-reply']");
  if (replyForm) {
    event.preventDefault();
    if (state.busy) return;
    await handlePlazaReplySubmit(replyForm);
    return;
  }
  const searchForm = event.target.closest("[data-form='player-search']");
  if (searchForm) {
    event.preventDefault();
    if (state.busy) return;
    await handlePlayerSearch(searchForm);
    return;
  }
  const dmForm = event.target.closest("[data-form='dm-send']");
  if (dmForm) {
    event.preventDefault();
    if (state.busy) return;
    await handleDmSend(dmForm);
    return;
  }
  const form = event.target.closest("[data-form='auth']");
  if (form) {
    event.preventDefault();
    if (state.busy) return;
    await handleAuthSubmit(form);
    return;
  }
  const forgotForm = event.target.closest("[data-form='forgot']");
  if (forgotForm) {
    event.preventDefault();
    if (state.busy) return;
    await handleForgotSubmit(forgotForm);
    return;
  }
  const resetForm = event.target.closest("[data-form='reset']");
  if (resetForm) {
    event.preventDefault();
    if (state.busy) return;
    await handleResetSubmit(resetForm);
    return;
  }
  const guestForm = event.target.closest("[data-form='guest']");
  if (guestForm) {
    event.preventDefault();
    if (state.busy) return;
    await handleGuestSubmit(guestForm);
    return;
  }
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
  switch (action) {
    case "go-home":
      event.preventDefault();
      await goToLanding();
      break;
    case "go-lobby":
      await loadPublicRooms();
      state.view = "lobby";
      syncPlatformStream();
      render();
      break;
    case "go-plaza":
      await loadPlazaPosts();
      state.view = "plaza";
      syncPlatformStream();
      render();
      break;
    case "go-friends":
      await loadFriends();
      state.view = "friends";
      syncPlatformStream();
      render();
      break;
    case "go-messages":
      await loadDmConversations();
      state.view = "messages";
      syncPlatformStream();
      render();
      break;
    case "refresh-plaza":
      await loadPlazaPosts();
      break;
    case "plaza-open":
      await openPlazaThread(button.dataset.postId);
      break;
    case "plaza-back":
      state.view = "plaza";
      state.plazaPostId = "";
      state.plazaPostDetail = null;
      state.plazaReplies = null;
      render();
      break;
    case "plaza-delete-post":
      openModalState({
        kind: "confirm-delete-post",
        title: "删除帖子",
        message: "确定删除这条帖子？此操作不可撤销。",
        postId: button.dataset.postId
      });
      render();
      break;
    case "plaza-delete-reply":
      openModalState({
        kind: "confirm-delete-reply",
        title: "删除评论",
        message: "确定删除这条评论？",
        replyId: button.dataset.replyId
      });
      render();
      break;
    case "plaza-report":
      handlePlazaReport(button.dataset.targetType, button.dataset.targetId);
      break;
    case "modal-close":
      closeModalState();
      render();
      break;
    case "modal-backdrop-close":
      if (event.target !== button) return;
      closeModalState();
      render();
      break;
    case "modal-confirm": {
      const modal = state.modal;
      if (modal?.kind === "confirm-delete-post") {
        setBusy(true, render);
        try {
          await api.deletePlazaPost(modal.postId);
          closeModalState();
          state.view = "plaza";
          state.plazaPostId = "";
          await loadPlazaPosts();
          setToast("帖子已删除", render);
        } catch (error) {
          setToast(formatApiError(error, "删除失败"), render);
        } finally {
          setBusy(false, render);
        }
      } else if (modal?.kind === "confirm-delete-reply") {
        setBusy(true, render);
        try {
          await api.deletePlazaReply(modal.replyId);
          closeModalState();
          await loadPlazaThread({ silent: true });
          setToast("评论已删除", render);
        } catch (error) {
          setToast(formatApiError(error, "删除失败"), render);
        } finally {
          setBusy(false, render);
        }
      }
      break;
    }
    case "modal-submit-report":
      await submitPlazaReport();
      break;
    case "edit-clue-note": {
      const clue = (state.home?.clues || []).find((c) => c.id === button.dataset.clueId);
      if (!clue) return setToast("线索不存在", render);
      openModalState({
        kind: "clue-note",
        title: `我的线索解读 · ${clue.name}`,
        clueId: clue.id,
        initialNote: clue.player_note || ""
      });
      render();
      break;
    }
    case "share-clue-room": {
      const clue = (state.home?.clues || []).find((c) => c.id === button.dataset.clueId);
      if (!clue) return setToast("线索不存在", render);
      setBusy(true, render);
      try {
        const next = !clue.shared_with_room;
        await api.shareClueToRoom(state.roomId, clue.id, next);
        await pullRoomData();
        state.clueId = clue.id;
        setToast(next ? `已公开「${clue.name}」到全房间` : `已取消公开「${clue.name}」`, render);
      } catch (error) {
        setToast(formatApiError(error, "操作失败"), render);
      } finally {
        setBusy(false, render);
      }
      break;
    }
    case "share-clue-roles": {
      const clue = (state.home?.clues || []).find((c) => c.id === button.dataset.clueId);
      if (!clue) return setToast("线索不存在", render);
      openModalState({
        kind: "clue-share",
        title: `私享线索 · ${clue.name}`,
        clueId: clue.id,
        initialRoles: clue.shared_with_roles || []
      });
      render();
      break;
    }
    case "modal-save-clue-note": {
      const clueId = button.dataset.clueId;
      setBusy(true, render);
      try {
        await api.updateCluePlayerNote(state.roomId, clueId, state.modalDraft || "");
        closeModalState();
        await pullRoomData();
        state.clueId = clueId;
        setToast("线索解读已保存", render);
      } catch (error) {
        setToast(formatApiError(error, "保存失败"), render);
      } finally {
        setBusy(false, render);
      }
      break;
    }
    case "modal-save-clue-share": {
      const clueId = button.dataset.clueId;
      setBusy(true, render);
      try {
        await api.shareClueToRoles(state.roomId, clueId, state.clueShareRoles || []);
        closeModalState();
        await pullRoomData();
        state.clueId = clueId;
        const count = (state.clueShareRoles || []).length;
        setToast(count ? `已私享给 ${count} 名玩家` : "已清空私享名单", render);
      } catch (error) {
        setToast(formatApiError(error, "保存失败"), render);
      } finally {
        setBusy(false, render);
      }
      break;
    }
    case "friend-request":
      setBusy(true, render);
      try {
        await ensureSession();
        await api.sendFriendRequest(button.dataset.userId);
        await loadFriends({ silent: true });
        setToast("好友请求已发送", render);
      } catch (error) {
        setToast(formatApiError(error, "发送失败"), render);
      } finally {
        setBusy(false, render);
      }
      break;
    case "friend-accept":
      setBusy(true, render);
      try {
        await api.respondFriendRequest(button.dataset.userId, true);
        await loadFriends({ silent: true });
        setToast("已添加好友", render);
      } catch (error) {
        setToast(formatApiError(error, "操作失败"), render);
      } finally {
        setBusy(false, render);
      }
      break;
    case "friend-decline":
      setBusy(true, render);
      try {
        await api.respondFriendRequest(button.dataset.userId, false);
        await loadFriends({ silent: true });
        setToast("已拒绝请求", render);
      } catch (error) {
        setToast(formatApiError(error, "操作失败"), render);
      } finally {
        setBusy(false, render);
      }
      break;
    case "dm-open":
      await openDmConversation(button.dataset.conversationId);
      break;
    case "dm-open-peer":
      await openDmWithPeer(button.dataset.userId);
      break;
    case "plaza-filter":
      state.plazaFilter = button.dataset.kind || "all";
      await loadPlazaPosts();
      break;
    case "plaza-join":
      state.inviteCode = normalizeInviteCode(button.dataset.inviteCode || "");
      if (!state.inviteCode) return setToast("邀请码无效", render);
      state.view = "join";
      state.joinStep = 1;
      await handleLookupInvite();
      break;
    case "refresh-lobby":
      await loadPublicRooms();
      break;
    case "lobby-join":
      state.inviteCode = normalizeInviteCode(button.dataset.inviteCode || "");
      if (!state.inviteCode) return setToast("房间无效", render);
      state.view = "join";
      state.joinStep = 1;
      await handleLookupInvite();
      break;
    case "start-join":
      if (!normalizeInviteCode(state.inviteCode)) {
        state.view = "join";
        state.joinStep = 1;
        render();
        return;
      }
      state.view = "join";
      state.joinStep = 1;
      await handleLookupInvite();
      break;
    case "lookup-invite":
      await handleLookupInvite();
      break;
    case "confirm-join":
      await handleJoinRoom();
      break;
    case "join-official":
      await handleJoinOfficial();
      break;
    case "pick-role":
      state.selectedRoleId = button.dataset.roleId;
      render();
      break;
    case "section-prev": {
      const sections = state.home?.sections || [];
      const index = sections.findIndex((section) => section.id === state.sectionId);
      if (index > 0) state.sectionId = sections[index - 1].id;
      render();
      break;
    }
    case "section-next": {
      const sections = state.home?.sections || [];
      const index = sections.findIndex((section) => section.id === state.sectionId);
      if (index >= 0 && index < sections.length - 1) state.sectionId = sections[index + 1].id;
      render();
      break;
    }
    case "pick-section":
      state.sectionId = button.dataset.sectionId;
      render();
      break;
    case "pick-clue":
      state.clueId = button.dataset.clueId;
      render();
      break;
    case "goto-section":
      state.sectionId = button.dataset.sectionId;
      state.tab = "sections";
      render();
      break;
    case "complete-section":
      await handleCompleteSection(button.dataset.sectionId);
      break;
    case "complete-player-task":
      await handleCompletePlayerTask(button.dataset.taskId);
      break;
    case "submit-testimony":
      await handleSubmitTestimony();
      break;
    case "submit-satisfaction":
      await handleSubmitSatisfaction();
      break;
    case "save-suspicion": {
      const card = button.closest(".suspicion-card");
      const level = Number(card?.querySelector("[data-suspicion-level]")?.value || 0);
      const reason = card?.querySelector("[data-suspicion-reason]")?.value || "";
      try {
        await api.setSuspicion(state.roomId, button.dataset.targetRole, { level, reason });
        await pullRoomData({ partial: true });
        setToast("怀疑度已保存", render, { patch: true });
      } catch (error) {
        setToast(formatApiError(error, "保存失败"), render, { patch: true });
      }
      break;
    }
    case "submit-vote-ballot": {
      const voteId = button.dataset.voteId;
      const optionId = button.dataset.optionId;
      if (!voteId || !optionId) break;
      try {
        await api.submitVoteBallot(state.roomId, voteId, { optionId });
        await pullRoomData({ partial: true });
        setToast("投票已提交", render, { patch: true });
      } catch (error) {
        setToast(formatApiError(error, "提交失败"), render, { patch: true });
      }
      break;
    }
    case "submit-private-action": {
      const title = document.querySelector("[data-private-action-title]")?.value?.trim();
      const body = document.querySelector("[data-private-action-body]")?.value?.trim() || "";
      const actionType = document.querySelector("[data-private-action-type]")?.value || "ask_host";
      if (!title) {
        setToast("请填写标题", render, { patch: true });
        break;
      }
      try {
        await api.createPrivateAction(state.roomId, { actionType, title, body });
        const titleEl = document.querySelector("[data-private-action-title]");
        const bodyEl = document.querySelector("[data-private-action-body]");
        if (titleEl) titleEl.value = "";
        if (bodyEl) bodyEl.value = "";
        await pullRoomData({ partial: true });
        setToast("已提交给主持人", render, { patch: true });
      } catch (error) {
        setToast(formatApiError(error, "提交失败"), render, { patch: true });
      }
      break;
    }
    case "read-clue":
      await handleReadClue(button.dataset.clueId);
      break;
    case "investigate":
      await handleInvestigate(button.dataset.pointId);
      break;
    case "mini-game-submit":
      await handleMiniGameSubmit(button);
      break;
    case "switch-tab":
      await flushPendingRoomRefresh();
      state.tab = defaultGameTabFor(button.dataset.primaryTab || button.dataset.tab);
      for (const tabId of tabGroupFor(state.tab)) clearTabPulse(tabId);
      const primaryTab = primaryTabFor(state.tab);
      if (state.view === "game" && patchGameTabSwitch(state, gamePatchCtx)) {
        syncPlayUrl(state);
        if (state.tab === "voice") {
          ensureDefaultVoiceRoom();
          if (state.voiceRoomId) {
            await refreshVoiceMessages(render, { silent: true }).catch(() => {});
            patchGameTabSwitch(state, gamePatchCtx);
          }
        } else if (primaryTab === "recap") {
          await loadRecapSummary({ silent: true });
          if (state.roomId) await loadMyTimeline({ silent: true });
          patchGameTabSwitch(state, gamePatchCtx);
        } else if (primaryTab === "story" && state.roomId) {
          bindPlayReader({
            roomId: state.roomId,
            notesSource: () => state.home,
            onRefresh: async () => pullRoomData({ partial: true }),
            onToast: (message) => setToast(message, render)
          });
        } else if (state.tab === "timeline" && state.roomId) {
          await loadMyTimeline({ silent: true });
          patchGameTabSwitch(state, gamePatchCtx);
        }
        break;
      }
      if (state.tab === "voice") {
        ensureDefaultVoiceRoom();
        if (state.voiceRoomId) {
          await refreshVoiceMessages(render).catch(() => render());
        } else {
          render();
        }
      } else if (primaryTab === "recap") {
        await loadRecapSummary();
        if (state.roomId) await loadMyTimeline({ silent: true });
      } else if (state.tab === "timeline" && state.roomId) {
        await loadMyTimeline();
      } else {
        render();
      }
      break;
    case "voice-room":
      openVoiceRoomPicker(render);
      break;
    case "voice-room-create":
      openCreateVoiceRoomModal(render);
      break;
    case "voice-room-invite":
      openInviteVoiceRoomModal(button.dataset.voiceId, button.dataset.voiceName, render);
      break;
    case "voice-join":
      await joinVoiceRoom(button.dataset.voiceId, button.dataset.voiceName, { render, setToast });
      break;
    case "voice-live-connect":
      await connectVoiceLive({ render, setToast });
      break;
    case "voice-live-disconnect":
      await disconnectVoiceLive({ render, setToast });
      break;
    case "voice-mic-toggle":
      await toggleVoiceMicLive({ render, setToast });
      break;
    case "voice-playback-unlock":
      await unlockVoicePlayback({ render, setToast });
      break;
    case "voice-chat-refresh":
      try {
        await refreshVoiceMessages(render);
      } catch (error) {
        setToast(formatApiError(error, "刷新失败"), render);
      }
      break;
    case "voice-chat-send":
      await sendVoiceChatMessage({ render, setToast, setBusy });
      break;
    case "modal-create-voice":
      await submitCreateVoiceRoom({ render, setBusy, setToast });
      break;
    case "modal-voice-invite":
      await submitVoiceInvite({ render, setBusy, setToast });
      break;
    case "show-auth":
      state.view = "auth";
      render();
      break;
    case "toggle-auth-mode":
      state.authMode = state.authMode === "login" ? "register" : "login";
      render();
      break;
    case "auth-forgot":
      state.authMode = "forgot";
      render();
      break;
    case "auth-login":
      state.authMode = "login";
      state.resetToken = "";
      render();
      break;
    case "resend-verification":
      await handleResendVerification();
      break;
    case "open-recap-detail":
      await loadRecapDetail();
      break;
    case "close-recap-detail":
      state.recapDetail = null;
      state.recapId = "";
      render();
      break;
    case "reload-recap":
      await loadRecapSummary();
      break;
    case "back-landing":
      await goToLanding();
      break;
    case "join-back-code":
      state.joinPreview = null;
      state.joinStep = 1;
      render();
      break;
    case "guest-continue":
      await handleGuestSubmit({ displayName: { value: "" } });
      break;
    case "oauth":
      await handleOAuth(button.dataset.provider);
      break;
    case "logout":
      await handleLogout();
      break;
    case "leave-room":
      await resetVoiceOnLeave();
      disconnectRoomEvents(roomEventCtx);
      persistRoom("", isUuid);
      state.home = null;
      state.recapLatest = null;
      state.recapDetail = null;
      state.view = "landing";
      state.tab = "home";
      syncPlatformStream();
      render();
      break;
    case "dismiss-error":
      state.error = "";
      render();
      break;
    case "dismiss-host-nudge":
      state.hostNudge = null;
      if (!patchGameHostBanner()) render();
      break;
    case "toggle-sidebar":
      state.gameSidebarCollapsed = !state.gameSidebarCollapsed;
      persistGameSidebarCollapsed(state.gameSidebarCollapsed);
      render();
      break;
    case "go-messages-ingame":
      await loadDmConversations();
      state.view = "messages";
      render();
      break;
    case "return-game":
      if (state.roomId && isUuid(state.roomId)) {
        await refreshHome();
      } else {
        setToast("当前没有进行中的对局", render);
      }
      break;
    case "retry-exploration":
      setBusy(true, render);
      try {
        state.exploration = await api.exploration(state.roomId);
        state.explorationError = "";
        render();
      } catch (error) {
        state.explorationError = formatApiError(error, "探索数据加载失败");
        render();
      } finally {
        setBusy(false, render);
      }
      break;
    case "add-notebook-entry":
      await handleAddNotebookEntry();
      break;
    case "delete-notebook-entry":
      await handleDeleteNotebookEntry(button.dataset.noteId);
      break;
    case "clear-notes-draft":
      state.notesDraft = "";
      state.notesDraftTitle = "";
      render();
      break;
    default:
      break;
  }
});

app.addEventListener("focusout", () => {
  if (!state.pendingRoomRefresh) return;
  window.setTimeout(() => {
    if (!isGameInputFocused()) void flushPendingRoomRefresh();
  }, 120);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.modal) {
    closeModalState();
    render();
  }
});

bootstrap();
