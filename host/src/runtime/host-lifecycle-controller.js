import { ALLOWED_OAUTH_PROVIDERS, isSafeOAuthRedirectUrl, isUuid } from "../../../shared/security.js";
import { initWebVitalsReporting } from "../../../shared/web-vitals.js";
import {
  authProbeFailureStatus,
  isSessionRejection,
  normalizeAuthenticatedUser,
  revokeSessionForLogout
} from "../../../shared/auth-state.js";
import {
  api,
  clearSession,
  getAppOrigin,
  getHostOrigin,
  setSessionToken
} from "../api.js";
import { formatApiError } from "../errors.js";
import { getRoomId, getWorldId, setRoomId, setWorldId } from "../session.js";
import { state } from "../state.js";
import { bindConsoleContext } from "../views/console.js";
import {
  bindDataContext,
  loadHostData,
  loadWorldsList,
  resolveRoomDeepLink
} from "./data.js";
import { bindArchiveModalsContext } from "./invite.js";
import {
  bindRoomEventsContext,
  disconnectRoomEvents,
  syncDirectorPolling,
  syncRoomStream
} from "./room-events.js";

export function normalizeHostUser(raw) {
  raw = normalizeAuthenticatedUser(raw);
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.email,
    displayName: raw.display_name || raw.displayName,
    emailVerified: raw.emailVerified ?? Boolean(raw.email_verified_at)
  };
}

export async function loadHostSessionUser({ requestMe, stateRef, clear, isCurrent = () => true }) {
  stateRef.authStatus = "checking";
  stateRef.authError = "";
  try {
    const user = normalizeHostUser(await requestMe());
    if (!isCurrent()) return stateRef.authStatus;
    stateRef.user = user;
    stateRef.authStatus = stateRef.user ? "authenticated" : "unavailable";
  } catch (error) {
    if (!isCurrent()) return stateRef.authStatus;
    stateRef.authStatus = authProbeFailureStatus(error);
    stateRef.authError = error.message || "";
    if (isSessionRejection(error)) {
      clear();
      stateRef.user = null;
    }
  }
  return stateRef.authStatus;
}

export function createHostLifecycleController({ render, setBusy, showToast }) {
  let sessionProbePromise = null;
  let sessionProbeToken = null;
  let sessionGeneration = 0;
  function cleanOAuthUrl() {
    const url = new URL(window.location.href);
    ["oauth_code", "oauth_error", "auth"].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  function loadSessionUser() {
    const tokenAtStart = getSessionToken();
    if (sessionProbePromise) {
      if (sessionProbeToken === tokenAtStart) return sessionProbePromise;
      return sessionProbePromise.finally(() => loadSessionUser());
    }
    sessionProbeToken = tokenAtStart;
    const generationAtStart = sessionGeneration;
    sessionProbePromise = loadHostSessionUser({
      requestMe: api.me,
      stateRef: state,
      clear: clearSession,
      isCurrent: () => generationAtStart === sessionGeneration && tokenAtStart === getSessionToken()
    }).finally(() => {
      sessionProbePromise = null;
      sessionProbeToken = null;
    });
    return sessionProbePromise;
  }

  async function handleExternalSessionChange(token) {
    sessionGeneration += 1;
    if (!token) {
      disconnectRoomEvents();
      state.user = null;
      state.authStatus = "anonymous";
      state.authError = "";
      state.view = "auth";
      render();
      return;
    }
    await loadSessionUser();
    if (!state.user) return;
    if (state.view === "auth") state.view = "landing";
    if (state.view === "console") {
      syncRoomStream();
      syncDirectorPolling();
    } else {
      await loadWorldsList().catch(() => {});
    }
    render();
  }

  async function enterConsole() {
    if (!getRoomId() || !getWorldId()) {
      state.view = "landing";
      state.landingStep = "rooms";
      return;
    }
    state.view = "console";
    render();
    setBusy(true);
    try {
      await loadHostData(false, true);
      syncRoomStream();
      syncDirectorPolling();
    } catch (error) {
      state.error = formatApiError(error, "无法进入监控台");
      state.view = "landing";
    } finally {
      setBusy(false);
    }
  }

  async function selectWorld(worldId) {
    if (!worldId) return;
    setWorldId(worldId);
    setRoomId(worldId, "");
    state.room = null;
    state.landingStep = "rooms";
    setBusy(true);
    try {
      [state.rooms, state.studio] = await Promise.all([
        api.getWorldRooms(worldId),
        api.getStudio(worldId)
      ]);
      render();
    } catch (error) {
      showToast(formatApiError(error, "无法加载平行房"));
    } finally {
      setBusy(false);
    }
  }

  async function refreshRoomsList(withToast = false) {
    const worldId = getWorldId();
    if (!worldId) {
      showToast("请先选择剧本世界");
      return;
    }
    setBusy(true);
    try {
      const [rooms, studio] = await Promise.all([
        api.getWorldRooms(worldId),
        api.getStudio(worldId).catch(() => state.studio)
      ]);
      state.rooms = rooms;
      state.studio = studio;
      state.landingStep = "rooms";
      render();
      if (withToast) showToast(`运行房已刷新：${state.rooms.length} 个`);
    } catch (error) {
      if (error.status === 401) state.user = null;
      showToast(formatApiError(error, "无法加载平行房"));
    } finally {
      setBusy(false);
    }
  }

  async function createHostRoom() {
    if (!state.user) {
      state.view = "auth";
      render();
      showToast("请先登录后再操作");
      return;
    }
    const worldId = getWorldId();
    if (!worldId) {
      showToast("请先选择剧本世界");
      return;
    }
    const defaultName = `测试房 ${new Date().toLocaleDateString("zh-CN")}`;
    const name = window.prompt("运行房名称", defaultName)?.trim();
    if (!name) return;
    setBusy(true);
    try {
      const inviteCode = `ROOM-${Date.now().toString(36).toUpperCase()}`;
      const room = await api.createRoom({ name, inviteCode, publicListing: false }, worldId);
      state.rooms = await api.getWorldRooms(worldId);
      setRoomId(worldId, room.id);
      state.room = state.rooms.find((item) => item.id === room.id) || room;
      showToast(`运行房已创建：${room.invite_code || inviteCode}`);
      await enterConsole();
    } catch (error) {
      if (error.status === 401) state.user = null;
      showToast(formatApiError(error, "创建运行房失败"));
    } finally {
      setBusy(false);
    }
  }

  async function selectRoom(roomId) {
    const worldId = getWorldId();
    if (!worldId || !roomId) return;
    setRoomId(worldId, roomId);
    state.room = state.rooms.find((room) => room.id === roomId) || null;
    await enterConsole();
  }

  async function handleAuthSubmit(form) {
    const email = form.email.value.trim();
    const password = form.password.value;
    const displayName = form.displayName?.value?.trim() || "";
    setBusy(true);
    try {
      const result = state.authMode === "register"
        ? await api.register(email, displayName, password)
        : await api.login(email, password);
      setSessionToken(result.token);
      state.user = normalizeHostUser(result.user);
      cleanOAuthUrl();
      await loadWorldsList();
      state.view = "landing";
      showToast(`欢迎，${result.user.displayName || result.user.email || "主持"}`);
    } catch (error) {
      showToast(formatApiError(error, "登录失败"));
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider) {
    if (!ALLOWED_OAUTH_PROVIDERS.has(provider)) {
      showToast("不支持的登录方式");
      return;
    }
    setBusy(true);
    try {
      const { url } = await api.oauthStartUrl(provider, getHostOrigin());
      if (!isSafeOAuthRedirectUrl(url)) throw new Error("OAuth 跳转地址无效");
      window.location.assign(url);
    } catch (error) {
      showToast(error.message || "OAuth 暂不可用");
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await revokeSessionForLogout(api.logout);
    } catch (error) {
      showToast(formatApiError(error, "退出登录失败，请检查网络后重试"));
      return;
    } finally {
      setBusy(false);
    }
    disconnectRoomEvents();
    clearSession();
    setWorldId("");
    state.user = null;
    state.authStatus = "anonymous";
    state.authError = "";
    state.view = "landing";
    render();
  }

  async function handleAction(action, element) {
    switch (action) {
      case "go-home":
        disconnectRoomEvents();
        state.view = "landing";
        render();
        return true;
      case "go-pick-room":
        disconnectRoomEvents();
        state.view = "landing";
        state.landingStep = getWorldId() ? "rooms" : "worlds";
        render();
        return true;
      case "show-auth": state.view = "auth"; render(); return true;
      case "toggle-auth-mode":
        state.authMode = state.authMode === "login" ? "register" : "login";
        render();
        return true;
      case "back-landing": state.view = "landing"; render(); return true;
      case "world-select": await selectWorld(element?.dataset?.worldId); return true;
      case "room-select": await selectRoom(element?.dataset?.roomId); return true;
      case "refresh-rooms": await refreshRoomsList(true); return true;
      case "create-room": await createHostRoom(); return true;
      case "landing-back-worlds": state.landingStep = "worlds"; render(); return true;
      case "open-creator":
        window.open(getAppOrigin(), "_blank", "noopener,noreferrer");
        return true;
      case "oauth": await handleOAuth(element?.dataset?.provider); return true;
      case "logout": await handleLogout(); return true;
      case "dismiss-error": state.error = ""; render(); return true;
      default: return false;
    }
  }

  async function bootstrap() {
    initWebVitalsReporting({ app: "host", endpoint: "/api/metrics/web-vitals" });
    const params = new URLSearchParams(window.location.search);
    const deepRoom = params.get("room");
    bindConsoleContext({ render, showToast });
    bindDataContext({ render, showToast });
    bindRoomEventsContext({ render, showToast });
    bindArchiveModalsContext({ render, showToast });

    setBusy(true);
    try {
      state.authConfig = await api.authConfig().catch(() => null);
      const oauthCode = params.get("oauth_code");
      const oauthError = params.get("oauth_error");
      if (oauthError) state.error = `OAuth 登录失败：${oauthError}`;
      else if (oauthCode) {
        const result = await api.oauthComplete(oauthCode);
        setSessionToken(result.token);
        state.user = normalizeHostUser(result.user);
        showToast(`欢迎，${result.user.displayName || "主持"}`, 2800);
        cleanOAuthUrl();
      }
      await loadSessionUser();
      if (!state.user && state.view !== "auth") state.view = "landing";

      if (deepRoom && isUuid(deepRoom)) {
        const found = await resolveRoomDeepLink(deepRoom);
        if (found) {
          state.view = "console";
          await enterConsole();
          return;
        }
        state.error = "找不到该运行房，或你没有主持权限。";
      }

      if (getWorldId() && getRoomId()) {
        await enterConsole();
      } else if (state.user) {
        await loadWorldsList();
        if (getWorldId()) {
          state.rooms = await api.getWorldRooms(getWorldId()).catch(() => []);
          state.landingStep = "rooms";
        }
        state.view = "landing";
      }
    } catch (error) {
      state.error = formatApiError(error, "加载失败");
    } finally {
      setBusy(false);
    }
  }

  return { bootstrap, handleAction, handleAuthSubmit, handleExternalSessionChange };
}
