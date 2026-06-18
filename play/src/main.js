import "./styles.css";
import {
  api,
  clearSession,
  getPlayOrigin,
  getSessionToken,
  setSessionToken
} from "./api.js";
import { ALLOWED_OAUTH_PROVIDERS, isSafeOAuthRedirectUrl, isUuid, normalizeInviteCode } from "./security.js";
import { connectRoomEvents, disconnectRoomEvents } from "./room-events.js";
import { connectPlatformEvents, disconnectPlatformEvents } from "./platform-events.js";
import { formatApiError } from "./errors.js";
import { renderApp } from "./render.js";
import { persistRoom, setBusy, setToast, state } from "./state.js";

const app = document.getElementById("app");

function render() {
  app.innerHTML = renderApp();
}

function cleanUrl() {
  const url = new URL(window.location.href);
  ["oauth_code", "oauth_error", "auth", "join", "invite", "experience"].forEach((key) =>
    url.searchParams.delete(key)
  );
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

async function ensureSession() {
  if (getSessionToken()) return;
  const guestName = `玩家${Math.floor(Math.random() * 9000 + 1000)}`;
  const result = await api.guest(guestName);
  setSessionToken(result.token);
  state.user = result.user;
}

async function loadPlatform() {
  try {
    state.platform = await api.platformSite();
  } catch {
    state.platform = null;
  }
}

async function loadAuthConfig() {
  state.authConfig = await api.authConfig();
}

async function pullRoomData() {
  if (!state.roomId || !isUuid(state.roomId)) return;
  state.home = await api.playerHome(state.roomId);
  state.exploration = await api.exploration(state.roomId).catch(() => ({ scenes: [] }));
  const sections = state.home.sections || [];
  if (state.sectionId && !sections.some((section) => section.id === state.sectionId)) {
    state.sectionId = sections.find((section) => !section.completed)?.id || sections[0]?.id || "";
  } else if (!state.sectionId && sections.length) {
    state.sectionId = sections.find((section) => !section.completed)?.id || sections[0].id;
  }
  render();
}

const roomEventCtx = {
  getView: () => state.view,
  getRoomId: () => state.roomId,
  getRoleId: () => state.home?.role?.id || "",
  onRefresh: async () => {
    try {
      await pullRoomData();
    } catch {
      /* SSE/poll refresh is best-effort */
    }
  },
  onToast: (message) => setToast(message, render),
  setConnected: (connected) => {
    if (state.roomEventsConnected === connected) return;
    state.roomEventsConnected = connected;
    render();
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
  onToast: (message) => setToast(message, render),
  setConnected: (connected) => {
    if (state.platformEventsConnected === connected) return;
    state.platformEventsConnected = connected;
    render();
  }
};

function syncPlatformStream() {
  if (state.view === "game") {
    disconnectPlatformEvents(platformEventCtx);
    return;
  }
  if (getSessionToken()) connectPlatformEvents(platformEventCtx);
  else disconnectPlatformEvents(platformEventCtx);
}

function syncRoomStream() {
  if (state.view === "game" && state.roomId && isUuid(state.roomId)) {
    connectRoomEvents(state.roomId, roomEventCtx);
    disconnectPlatformEvents(platformEventCtx);
  } else {
    disconnectRoomEvents(roomEventCtx);
    syncPlatformStream();
  }
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
    syncRoomStream();
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
  } catch {
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
    await Promise.all([loadDmThread({ silent: true }), loadDmConversations({ silent: true })]);
  } catch (error) {
    setToast(formatApiError(error, "发送失败"), render);
  } finally {
    setBusy(false, render);
  }
}

async function handlePlazaReport(targetType, targetId) {
  const reason = window.prompt("请简要说明举报原因（4～200 字）：");
  if (!reason) return;
  setBusy(true, render);
  try {
    await ensureSession();
    await api.reportPlaza({ targetType, targetId, reason: reason.trim() });
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
  } catch {
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
  } catch {
    state.publicRooms = { total: 0, items: [] };
  } finally {
    if (!silent) setBusy(false, render);
    else if (state.view === "landing" || state.view === "lobby") render();
  }
}

async function bootstrap() {
  setBusy(true, render);
  try {
    await Promise.all([loadAuthConfig(), loadPlatform(), loadPublicRooms({ silent: true })]);
    const params = new URLSearchParams(window.location.search);
    const oauthCode = params.get("oauth_code");
    const oauthError = params.get("oauth_error");
    if (oauthError) state.error = `OAuth 登录失败：${oauthError}`;
    else if (oauthCode) {
      const result = await api.oauthComplete(oauthCode);
      setSessionToken(result.token);
      state.user = result.user;
      setToast(`欢迎，${result.user.displayName || "玩家"}`, render);
      cleanUrl();
    }
    if (params.get("auth") === "login") state.view = "auth";
    const joinCode = normalizeInviteCode(params.get("join") || params.get("invite") || "");
    const wantOfficial = params.get("experience") === "official";
    if (joinCode) {
      state.inviteCode = joinCode;
      state.view = "join";
      state.joinStep = 1;
    }
    if (state.roomId && !isUuid(state.roomId)) persistRoom("", isUuid);
    await ensureSession();
    await loadDmConversations({ silent: true }).catch(() => {});
    if (wantOfficial) {
      await handleJoinOfficial({ silent: true });
    } else if (joinCode) {
      await handleLookupInvite({ silent: true });
    } else if (state.roomId) {
      await refreshHome();
    }
  } catch (error) {
    if (!state.error) state.error = error.message || "加载失败";
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
  const roles = state.joinPreview.roles || [];
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
      state.error = error.message || "无法进入官方示例";
    }
  } finally {
    setBusy(false, render);
  }
}

async function handleCompleteSection(sectionId) {
  setBusy(true, render);
  try {
    await api.completeSection(state.roomId, sectionId);
    await pullRoomData();
    setToast("已标记阅读完成", render);
  } catch (error) {
    setToast(error.message || "操作失败", render);
  } finally {
    setBusy(false, render);
  }
}

async function handleInvestigate(pointId) {
  setBusy(true, render);
  try {
    const result = await api.investigate(state.roomId, pointId);
    await pullRoomData();
    setToast(result.clue ? `获得线索：${result.clue.name}` : "调查完成", render);
  } catch (error) {
    setToast(error.message || "调查失败", render);
  } finally {
    setBusy(false, render);
  }
}

async function handleReadClue(clueId) {
  setBusy(true, render);
  try {
    await api.readClue(state.roomId, clueId);
    await pullRoomData();
    state.clueId = clueId;
  } catch (error) {
    setToast(error.message || "无法阅读线索", render);
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
    state.user = result.user;
    state.view = state.roomId ? "game" : "landing";
    cleanUrl();
    if (state.roomId) await refreshHome();
    setToast(`欢迎，${result.user.displayName || result.user.email || "玩家"}`, render);
    syncPlatformStream();
  } catch (error) {
    setToast(error.message || "登录失败", render);
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

function handleLogout() {
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
});

app.addEventListener("change", (event) => {
  if (event.target.dataset.bind === "sectionId") {
    state.sectionId = event.target.value;
    render();
  }
  if (event.target.dataset.bind === "plazaKind") {
    state.plazaDraftKind = event.target.value === "recruit" ? "recruit" : "chat";
    render();
  }
});

app.addEventListener("submit", (event) => {
  const plazaForm = event.target.closest("[data-form='plaza']");
  if (plazaForm) {
    event.preventDefault();
    handlePlazaSubmit(plazaForm);
    return;
  }
  const replyForm = event.target.closest("[data-form='plaza-reply']");
  if (replyForm) {
    event.preventDefault();
    handlePlazaReplySubmit(replyForm);
    return;
  }
  const searchForm = event.target.closest("[data-form='player-search']");
  if (searchForm) {
    event.preventDefault();
    handlePlayerSearch(searchForm);
    return;
  }
  const dmForm = event.target.closest("[data-form='dm-send']");
  if (dmForm) {
    event.preventDefault();
    handleDmSend(dmForm);
    return;
  }
  const form = event.target.closest("[data-form='auth']");
  if (!form) return;
  event.preventDefault();
  handleAuthSubmit(form);
});

app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (state.busy && button.dataset.action !== "dismiss-error") return;
  const action = button.dataset.action;
  switch (action) {
    case "go-home":
      event.preventDefault();
      if (state.view !== "game") return;
      disconnectRoomEvents(roomEventCtx);
      state.view = "landing";
      syncPlatformStream();
      render();
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
      if (!window.confirm("确定删除这条帖子？")) return;
      setBusy(true, render);
      try {
        await api.deletePlazaPost(button.dataset.postId);
        state.view = "plaza";
        state.plazaPostId = "";
        await loadPlazaPosts();
        setToast("帖子已删除", render);
      } catch (error) {
        setToast(formatApiError(error, "删除失败"), render);
      } finally {
        setBusy(false, render);
      }
      break;
    case "plaza-delete-reply":
      if (!window.confirm("确定删除这条评论？")) return;
      setBusy(true, render);
      try {
        await api.deletePlazaReply(button.dataset.replyId);
        await loadPlazaThread({ silent: true });
        setToast("评论已删除", render);
      } catch (error) {
        setToast(formatApiError(error, "删除失败"), render);
      } finally {
        setBusy(false, render);
      }
      break;
    case "plaza-report":
      await handlePlazaReport(button.dataset.targetType, button.dataset.targetId);
      break;
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
      state.tab = button.dataset.tab;
      render();
      break;
    case "show-auth":
      state.view = "auth";
      render();
      break;
    case "toggle-auth-mode":
      state.authMode = state.authMode === "login" ? "register" : "login";
      render();
      break;
    case "back-landing":
      state.view = "landing";
      state.joinPreview = null;
      state.joinStep = 1;
      syncPlatformStream();
      render();
      break;
    case "join-back-code":
      state.joinPreview = null;
      state.joinStep = 1;
      render();
      break;
    case "guest-continue":
      await ensureSession();
      setToast("已就绪。输入邀请码或体验官方示例即可开始", render);
      break;
    case "oauth":
      await handleOAuth(button.dataset.provider);
      break;
    case "logout":
      handleLogout();
      break;
    case "leave-room":
      disconnectRoomEvents(roomEventCtx);
      persistRoom("", isUuid);
      state.home = null;
      state.view = "landing";
      state.tab = "home";
      syncPlatformStream();
      render();
      break;
    case "dismiss-error":
      state.error = "";
      render();
      break;
    default:
      break;
  }
});

bootstrap();
