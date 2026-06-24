import "./styles.css";
import {
  api,
  clearSession,
  getPlayOrigin,
  getSessionToken,
  setSessionToken
} from "./api.js";
import { ALLOWED_OAUTH_PROVIDERS, isSafeOAuthRedirectUrl, isUuid, normalizeInviteCode, asArray } from "./security.js";
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

const app = document.getElementById("app");
let pullGeneration = 0;
let lastSyncErrorToastAt = 0;
let modalFocusReturn = null;

function patchSyncChromeOrRender() {
  if (patchSyncChrome(state)) return;
  render();
}

function render() {
  if (state.view === "game" && state.roomId) persistGameSession();
  const restoreKey = scrollRestoreKey(state);
  const scrollTop = window.scrollY;
  const dmEl = state.view === "dm" ? document.querySelector("[data-dm-scroll]") : null;
  const dmStickBottom = state.dmScrollStickBottom || shouldAutoScrollNearBottom(dmEl);
  const voiceLog = state.view === "game" && state.tab === "voice" ? document.querySelector("[data-voice-scroll]") : null;
  const voiceStickBottom = state.voiceScrollStickBottom || shouldAutoScrollNearBottom(voiceLog);

  app.innerHTML = renderApp();

  if (state.view === "dm") {
    const el = document.querySelector("[data-dm-scroll]");
    if (el && dmStickBottom) el.scrollTop = el.scrollHeight;
    state.dmScrollStickBottom = false;
  }
  if (state.view === "game" && state.tab === "voice") {
    const nextVoiceLog = document.querySelector("[data-voice-scroll]");
    if (nextVoiceLog && voiceStickBottom) nextVoiceLog.scrollTop = nextVoiceLog.scrollHeight;
    state.voiceScrollStickBottom = false;
  }
  if (state.view === "game" && state.tab === "sections" && state.roomId) {
    bindPlayReader({
      roomId: state.roomId,
      notesSource: () => state.home,
      onPatch: () => patchGameSectionsTab(state, gamePatchCtx),
      onToast: (message) => setToast(message, render, { patch: true })
    });
  }
  if (scrollRestoreKey(state) === restoreKey) {
    window.scrollTo(0, scrollTop);
  }
  bindModalFocus();
  syncPlayUrl(state);
}

setVoiceRenderCallback(render);

function normalizeUser(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.email,
    displayName: raw.display_name || raw.displayName,
    isGuest: raw.isGuest ?? raw.user_kind === "guest",
    emailVerified: raw.emailVerified ?? Boolean(raw.email_verified_at)
  };
}

async function loadSessionUser() {
  if (!getSessionToken()) return;
  try {
    state.user = normalizeUser(await api.me());
  } catch (error) {
    if (error.status === 401) clearSession();
  }
}

function cleanUrl() {
  const url = new URL(window.location.href);
  ["oauth_code", "oauth_error", "auth", "verify"].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

async function ensureSession() {
  if (getSessionToken()) return;
  const guestName = `玩家${Math.floor(Math.random() * 9000 + 1000)}`;
  const result = await api.guest(guestName);
  setSessionToken(result.token);
  state.user = normalizeUser(result.user);
}

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

function bindModalFocus() {
  const backdrop = document.querySelector(".modal-backdrop.is-open");
  if (!backdrop) {
    if (modalFocusReturn) {
      modalFocusReturn.focus?.();
      modalFocusReturn = null;
    }
    return;
  }
  const dialog = backdrop.querySelector(".modal");
  const focusable = dialog?.querySelector("textarea, input:not([type=hidden]), button:not([disabled])");
  focusable?.focus();
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

  const [home, explorationResult] = await Promise.all([
    api.playerHome(state.roomId),
    api.exploration(state.roomId)
      .then((data) => ({ ok: true, data }))
      .catch((error) => ({ ok: false, error }))
  ]);
  if (generation !== pullGeneration) return;

  state.home = home;
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
      return;
    }
  }
  render();
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
  hasSession: () => Boolean(getSessionToken()),
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
  if (getSessionToken()) connectPlatformEvents(platformEventCtx);
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

async function loadPlazaThread({ silent = false } = {}) {
  if (!state.plazaPostId) return;
  if (!silent) setBusy(true, render);
  try {
    const [post, replies] = await Promise.all([
      api.plazaPost(state.plazaPostId),
      api.plazaReplies(state.plazaPostId)
    ]);
    state.plazaPostDetail = post;
    state.plazaReplies = replies;
  } catch (error) {
    if (!silent) setToast(formatApiError(error, "无法加载帖子"), render);
    state.view = "plaza";
    state.plazaPostId = "";
  } finally {
    if (!silent) setBusy(false, render);
    else if (state.view === "plaza-thread") render();
  }
}

async function loadFriends({ silent = false } = {}) {
  if (!silent) setBusy(true, render);
  try {
    await ensureSession();
    state.friendsData = await api.listFriends();
    state.friendsError = "";
  } catch (error) {
    state.friendsError = formatApiError(error, "好友列表加载失败");
    if (!state.friendsData) state.friendsData = { friends: [], incoming: [], outgoing: [] };
  } finally {
    if (!silent) setBusy(false, render);
    else if (state.view === "friends") render();
  }
}

async function loadDmConversations({ silent = false } = {}) {
  if (!silent) setBusy(true, render);
  try {
    await ensureSession();
    state.dmConversations = await api.listDmConversations();
  } catch {
    if (!state.dmConversations) state.dmConversations = { items: [] };
  } finally {
    if (!silent) setBusy(false, render);
    else if (state.view === "messages" || state.view === "dm") render();
  }
}

async function loadDmThread({ silent = false } = {}) {
  if (!state.dmConversationId) return;
  if (!silent) setBusy(true, render);
  try {
    state.dmThread = await api.listDmMessages(state.dmConversationId);
  } catch (error) {
    if (!silent) setToast(formatApiError(error, "无法加载私信"), render);
    state.view = "messages";
    state.dmConversationId = "";
  } finally {
    if (!silent) setBusy(false, render);
    else if (state.view === "dm") render();
  }
}

async function openPlazaThread(postId) {
  state.plazaPostId = postId;
  state.view = "plaza-thread";
  render();
  await loadPlazaThread();
}

async function openDmConversation(conversationId) {
  state.dmConversationId = conversationId;
  state.view = "dm";
  render();
  await loadDmThread();
}

async function openDmWithPeer(peerUserId) {
  setBusy(true, render);
  try {
    await ensureSession();
    const { conversationId } = await api.openDmConversation(peerUserId);
    await loadDmConversations({ silent: true });
    await openDmConversation(conversationId);
  } catch (error) {
    setToast(formatApiError(error, "无法打开私信"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handlePlazaReplySubmit(form) {
  const body = form.body.value.trim();
  if (!body || !state.plazaPostId) return;
  setBusy(true, render);
  try {
    await ensureSession();
    await api.createPlazaReply(state.plazaPostId, { body });
    state.plazaReplyDraft = "";
    await loadPlazaThread({ silent: true });
    setToast("评论已发布", render);
  } catch (error) {
    setToast(formatApiError(error, "评论失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handlePlayerSearch(form) {
  const q = form.q.value.trim();
  state.playerSearchQuery = q;
  if (q.length < 2) return setToast("请输入至少 2 个字", render);
  setBusy(true, render);
  try {
    await ensureSession();
    state.playerSearchResults = await api.searchPlayers(q);
  } catch (error) {
    setToast(formatApiError(error, "搜索失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handleDmSend(form) {
  const body = form.body.value.trim();
  if (!body || !state.dmConversationId) return;
  setBusy(true, render);
  try {
    await ensureSession();
    await api.sendDmMessage(state.dmConversationId, body);
    state.dmDraftBody = "";
    state.dmScrollStickBottom = true;
    await Promise.all([loadDmThread({ silent: true }), loadDmConversations({ silent: true })]);
  } catch (error) {
    setToast(formatApiError(error, "发送失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handlePlazaReport(targetType, targetId) {
  openModalState({
    kind: "report",
    title: "举报内容",
    targetType,
    targetId
  });
  render();
}

async function submitPlazaReport() {
  const reason = (state.modalDraft || "").trim();
  if (reason.length < 4) return setToast("请填写至少 4 个字的举报原因", render);
  const { targetType, targetId } = state.modal || {};
  if (!targetType || !targetId) return;
  setBusy(true, render);
  try {
    await ensureSession();
    await api.reportPlaza({ targetType, targetId, reason });
    closeModalState();
    setToast("已提交举报，感谢反馈", render);
  } catch (error) {
    setToast(formatApiError(error, "举报失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function loadPlazaPosts({ silent = false } = {}) {
  if (!silent) setBusy(true, render);
  try {
    const kind = state.plazaFilter === "all" ? undefined : state.plazaFilter;
    state.plazaPosts = await api.plazaPosts({ kind });
    state.plazaError = "";
  } catch (error) {
    state.plazaError = formatApiError(error, "广场加载失败");
    if (!state.plazaPosts) state.plazaPosts = { total: 0, items: [] };
  } finally {
    if (!silent) setBusy(false, render);
    else if (state.view === "plaza") render();
  }
}

async function handlePlazaSubmit(form) {
  const kind = form.kind.value === "recruit" ? "recruit" : "chat";
  const body = form.body.value.trim();
  const inviteCode = normalizeInviteCode(form.inviteCode?.value || "");
  if (!body) return setToast("请填写内容", render);
  setBusy(true, render);
  try {
    await ensureSession();
    const result = await api.createPlazaPost({
      kind,
      body,
      ...(kind === "recruit" && inviteCode ? { inviteCode } : {})
    });
    state.plazaDraftBody = "";
    state.plazaDraftInvite = "";
    state.plazaDraftKind = kind;
    if (result.reviewPending) {
      setToast(result.message || "帖子已提交，等待人工复核", render);
    } else {
      await loadPlazaPosts({ silent: true });
      setToast("已通过审核并发布到广场", render);
    }
  } catch (error) {
    setToast(formatApiError(error, "发布失败"), render);
  } finally {
    setBusy(false, render);
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
  const params = new URLSearchParams(window.location.search);
  applyUrlToState(state, params);
  const joinCode = normalizeInviteCode(state.inviteCode || params.get("join") || params.get("invite") || "");
  const wantOfficial = params.get("experience") === "official";
  if (state.inviteCode) state.inviteCode = joinCode;
  if (state.roomId && !isUuid(state.roomId)) persistRoom("", isUuid);
  if (state.roomId && isUuid(state.roomId) && !joinCode && !wantOfficial && !params.get("reset")) {
    const urlView = params.get("view");
    if (!urlView || urlView === "game") state.view = "game";
  }

  const paintLandingAfterBootstrap = state.view === "landing";
  if (paintLandingAfterBootstrap) {
    state.busy = true;
  } else {
    setBusy(true, render);
  }
  try {
    await Promise.all([loadAuthConfig(), loadPlatform(), loadPublicRooms({ silent: true })]);
    const oauthCode = params.get("oauth_code");
    const oauthError = params.get("oauth_error");
    if (oauthError) state.error = `OAuth 登录失败：${oauthError}`;
    else if (oauthCode) {
      const result = await api.oauthComplete(oauthCode);
      setSessionToken(result.token);
      state.user = normalizeUser(result.user);
      setToast(`欢迎，${result.user.displayName || "玩家"}`, render);
      cleanUrl();
    }
    await ensureSession();
    await loadSessionUser();
    if (state.pendingVerifyToken) {
      try {
        await handleEmailVerify(state.pendingVerifyToken);
      } catch (error) {
        state.error = formatApiError(error, "邮箱验证失败");
      }
      state.pendingVerifyToken = "";
    }
    await loadDmConversations({ silent: true }).catch(() => {});
    if (state.view === "plaza") await loadPlazaPosts({ silent: true });
    if (state.view === "friends") await loadFriends({ silent: true });
    if (state.view === "messages") await loadDmConversations({ silent: true });
    if (state.view === "plaza-thread" && state.plazaPostId) await loadPlazaThread({ silent: true });
    if (wantOfficial) {
      await handleJoinOfficial({ silent: true });
    } else if (joinCode) {
      state.inviteCode = joinCode;
      await handleLookupInvite({ silent: true });
    } else if (state.roomId && state.view === "game") {
      await refreshHome();
      if (state.tab === "recap") await loadRecapSummary({ silent: true });
    }
  } catch (error) {
    if (!state.error) state.error = formatApiError(error, "加载失败");
    if (error.status === 401 || error.status === 403) {
      clearSession();
      persistRoom("", isUuid);
    }
  } finally {
    setBusy(false, render);
    syncPlatformStream();
  }
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
    cleanUrl();
    await refreshHome();
    state.tab = "home";
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
    cleanUrl();
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

async function handleEmailVerify(token) {
  const result = await api.verifyEmail(token);
  if (result.token) setSessionToken(result.token);
  state.user = normalizeUser(result.user);
  cleanUrl();
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
    cleanUrl();
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
    cleanUrl();
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
    cleanUrl();
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
    case "read-clue":
      await handleReadClue(button.dataset.clueId);
      break;
    case "investigate":
      await handleInvestigate(button.dataset.pointId);
      break;
    case "switch-tab":
      await flushPendingRoomRefresh();
      state.tab = button.dataset.tab;
      clearTabPulse(state.tab);
      if (state.view === "game" && patchGameTabSwitch(state, gamePatchCtx)) {
        syncPlayUrl(state);
        if (state.tab === "voice") {
          ensureDefaultVoiceRoom();
          if (state.voiceRoomId) {
            await refreshVoiceMessages(render, { silent: true }).catch(() => {});
            patchGameTabSwitch(state, gamePatchCtx);
          }
        } else if (state.tab === "recap") {
          await loadRecapSummary({ silent: true });
        } else if (state.tab === "sections" && state.roomId) {
          bindPlayReader({
            roomId: state.roomId,
            notesSource: () => state.home,
            onRefresh: async () => pullRoomData({ partial: true }),
            onToast: (message) => setToast(message, render)
          });
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
      } else if (state.tab === "recap") {
        await loadRecapSummary();
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
