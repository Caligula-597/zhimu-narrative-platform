import "./styles.css";
import {
  api,
  clearSession,
  getPlayOrigin,
  getSessionToken,
  setSessionToken
} from "./api.js";
import { ALLOWED_OAUTH_PROVIDERS, isSafeOAuthRedirectUrl, isUuid, normalizeInviteCode } from "./security.js";
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

async function refreshHome() {
  if (!state.roomId) {
    state.home = null;
    state.view = "landing";
    return;
  }
  if (!isUuid(state.roomId)) {
    persistRoom("", isUuid);
    state.home = null;
    state.view = "landing";
    return;
  }
  try {
    state.home = await api.playerHome(state.roomId);
    state.exploration = await api.exploration(state.roomId).catch(() => ({ scenes: [] }));
    const sections = state.home.sections || [];
    if (!state.sectionId && sections.length) {
      state.sectionId = sections.find((s) => !s.completed)?.id || sections[0].id;
    }
    state.view = "game";
    state.tab = state.tab || "home";
  } catch (error) {
    if (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 409) {
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

async function bootstrap() {
  setBusy(true, render);
  try {
    await Promise.all([loadAuthConfig(), loadPlatform()]);
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
    await refreshHome();
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
    await refreshHome();
    state.exploration = await api.exploration(state.roomId);
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
    await refreshHome();
    state.clueId = clueId;
    render();
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
});

app.addEventListener("change", (event) => {
  if (event.target.dataset.bind === "sectionId") {
    state.sectionId = event.target.value;
    render();
  }
});

app.addEventListener("submit", (event) => {
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
      state.view = "landing";
      render();
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
      persistRoom("", isUuid);
      state.home = null;
      state.view = "landing";
      state.tab = "home";
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
