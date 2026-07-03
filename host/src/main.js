import "./styles.css";
import {
  api,
  clearSession,
  getAppOrigin,
  getHostOrigin,
  getPlayOrigin,
  getSessionToken,
  setSessionToken
} from "./api.js";
import { togglePanelInDom } from "./components/collapse.js";
import { renderApp } from "./components/shell.js";
import { ALLOWED_OAUTH_PROVIDERS, isSafeOAuthRedirectUrl, isUuid } from "../../shared/security.js";
import { formatApiError } from "./errors.js";
import {
  bindDataContext,
  loadHostData,
  loadWorldsList,
  refreshHostAuditLog,
  refreshHostClueMatrix,
  refreshHostEvents,
  refreshHostPlayers,
  refreshHostRoom,
  resolveRoomDeepLink
} from "./runtime/data.js";
import {
  bindArchiveModalsContext,
  copyInviteCode,
  copyPlayLink,
  openCreateCheckpointModal,
  openCreateRecapModal,
  openRoomInviteModal
} from "./runtime/invite.js";
import {
  bindRoomEventsContext,
  connectRoomEvents,
  disconnectRoomEvents,
  syncDirectorPolling,
  syncRoomStream
} from "./runtime/room-events.js";
import {
  getRoomId,
  getWorldId,
  setRoomId,
  setWorldId
} from "./session.js";
import { state } from "./state.js";
import {
  batchHostEventsAction,
  bindConsoleContext,
  dismissHostEvent,
  executeHostEvent,
  openDelayHostEventModal,
  openHostClueNote,
  openHostEventContext,
  openHostGrantClueModal,
  openHostGrantItemModal,
  openHostLogModal,
  openHostNudgeWaitingModal,
  openHostPlayerDetail,
  openHostRuleEditor,
  openHostUnlockSceneModal,
  openHostUnlockSectionModal,
  refreshRulesPreview,
  syncHostEventSelectAll,
  toggleHostEventSelection,
  toggleHostRule,
  triggerManualRuleFromDirector,
  deleteHostRule,
  validateHostRules,
  kickHostPlayer
} from "./views/console.js";

import { createToastTimer } from "../../shared/toast.js";

const app = document.getElementById("app");
const hostToastTimer = createToastTimer(3200);

function setBusy(busy) {
  state.busy = busy;
  render();
}

function setToast(message, ms = 3200) {
  state.toast = message;
  render();
  if (message) {
    hostToastTimer.schedule(() => {
      state.toast = "";
      render();
    }, ms);
  } else {
    hostToastTimer.clear();
  }
}

function render() {
  app.innerHTML = renderApp();
  syncHostUrl();
}

function syncHostUrl() {
  const url = new URL(window.location.href);
  const roomId = getRoomId();
  if (state.view === "console" && roomId) url.searchParams.set("room", roomId);
  else url.searchParams.delete("room");
  window.history.replaceState({}, "", url.pathname + url.search);
}

function normalizeUser(raw) {
  if (raw?.user?.id) raw = raw.user;
  if (!raw) return null;
  return {
    id: raw.id,
    email: raw.email,
    displayName: raw.display_name || raw.displayName,
    emailVerified: raw.emailVerified ?? Boolean(raw.email_verified_at)
  };
}

async function loadSessionUser() {
  try {
    state.user = normalizeUser(await api.me());
  } catch (error) {
    if (error.status === 401) clearSession();
    state.user = null;
  }
}

function cleanOAuthUrl() {
  const url = new URL(window.location.href);
  ["oauth_code", "oauth_error", "auth"].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
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
    state.rooms = await api.getWorldRooms(worldId);
    state.studio = await api.getStudio(worldId);
    render();
  } catch (error) {
    setToast(formatApiError(error, "无法加载平行房"));
  } finally {
    setBusy(false);
  }
}

async function refreshRoomsList(withToast = false) {
  const worldId = getWorldId();
  if (!worldId) return setToast("请先选择剧本世界");
  setBusy(true);
  try {
    state.rooms = await api.getWorldRooms(worldId);
    state.studio = await api.getStudio(worldId).catch(() => state.studio);
    state.landingStep = "rooms";
    render();
    if (withToast) setToast(`运行房已刷新：${state.rooms.length} 个`);
  } catch (error) {
    if (error.status === 401) state.user = null;
    setToast(formatApiError(error, "无法加载平行房"));
  } finally {
    setBusy(false);
  }
}

async function createHostRoom() {
  if (!state.user) {
    state.view = "auth";
    render();
    return setToast("请先登录后再操作");
  }
  const worldId = getWorldId();
  if (!worldId) return setToast("请先选择剧本世界");
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
    setToast(`运行房已创建：${room.invite_code || inviteCode}`);
    await enterConsole();
  } catch (error) {
    if (error.status === 401) state.user = null;
    setToast(formatApiError(error, "创建运行房失败"));
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

async function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  const deepRoom = params.get("room");
  bindConsoleContext({ render, showToast: setToast });
  bindDataContext({ render, showToast: setToast });
  bindRoomEventsContext({ render, showToast: setToast });
  bindArchiveModalsContext({ render, showToast: setToast });

  setBusy(true);
  try {
    state.authConfig = await api.authConfig().catch(() => null);
    const oauthCode = params.get("oauth_code");
    const oauthError = params.get("oauth_error");
    if (oauthError) state.error = `OAuth 登录失败：${oauthError}`;
    else if (oauthCode) {
      const result = await api.oauthComplete(oauthCode);
      setSessionToken(result.token);
      state.user = normalizeUser(result.user);
      setToast(`欢迎，${result.user.displayName || "主持"}`, 2800);
      cleanOAuthUrl();
    }
    await loadSessionUser();
    if (!state.user && state.view !== "auth") state.view = "landing";

    if (deepRoom && isUuid(deepRoom)) {
      const ok = await resolveRoomDeepLink(deepRoom);
      if (ok) {
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

async function handleAuthSubmit(form) {
  const email = form.email.value.trim();
  const password = form.password.value;
  const displayName = form.displayName?.value?.trim() || "";
  setBusy(true);
  try {
    const result =
      state.authMode === "register"
        ? await api.register(email, displayName, password)
        : await api.login(email, password);
    setSessionToken(result.token);
    state.user = normalizeUser(result.user);
    cleanOAuthUrl();
    await loadWorldsList();
    state.view = "landing";
    setToast(`欢迎，${result.user.displayName || result.user.email || "主持"}`);
  } catch (error) {
    setToast(formatApiError(error, "登录失败"));
  } finally {
    setBusy(false);
  }
}

async function handleOAuth(provider) {
  if (!ALLOWED_OAUTH_PROVIDERS.has(provider)) return setToast("不支持的登录方式");
  setBusy(true);
  try {
    const { url } = await api.oauthStartUrl(provider, getHostOrigin());
    if (!isSafeOAuthRedirectUrl(url)) throw new Error("OAuth 跳转地址无效");
    window.location.assign(url);
  } catch (error) {
    setToast(error.message || "OAuth 暂不可用");
    setBusy(false);
  }
}

async function handleLogout() {
  disconnectRoomEvents();
  clearSession();
  setWorldId("");
  state.user = null;
  state.view = "landing";
  render();
}

function handleDirectorAction(action, el) {
  switch (action) {
    case "rules-preview":
      refreshRulesPreview();
      return true;
    case "host-rule-new":
      openHostRuleEditor();
      return true;
    case "host-rule-edit":
      openHostRuleEditor(el?.dataset?.rule);
      return true;
    case "host-rule-toggle":
      toggleHostRule(el?.dataset?.rule);
      return true;
    case "host-rule-delete":
      deleteHostRule(el?.dataset?.rule);
      return true;
    case "host-rule-validate":
      validateHostRules();
      return true;
    case "rule-manual-trigger":
      triggerManualRuleFromDirector(el?.dataset?.rule);
      return true;
    case "delay-host-event":
      openDelayHostEventModal(el?.dataset?.event);
      return true;
    case "host-event-context":
      openHostEventContext(el?.dataset?.event);
      return true;
    case "host-player-detail":
      openHostPlayerDetail(el?.dataset?.role);
      return true;
    case "host-kick-player":
      kickHostPlayer(el?.dataset?.role);
      return true;
    case "host-manual-grant-clue":
      openHostGrantClueModal();
      return true;
    case "host-manual-grant-item":
      openHostGrantItemModal();
      return true;
    case "host-manual-unlock-section":
      openHostUnlockSectionModal();
      return true;
    case "host-manual-unlock-scene":
      openHostUnlockSceneModal();
      return true;
    case "host-manual-log":
      openHostLogModal();
      return true;
    case "host-clue-note":
      openHostClueNote(el?.dataset?.clue, el?.dataset?.role);
      return true;
    case "host-event-toggle":
      toggleHostEventSelection(el?.dataset?.event, el?.checked);
      return true;
    case "host-event-select-all":
      syncHostEventSelectAll(el?.checked);
      return true;
    case "batch-execute-host-events":
      batchHostEventsAction("execute");
      return true;
    case "batch-dismiss-host-events":
      batchHostEventsAction("dismiss");
      return true;
    case "execute-host-event":
      executeHostEvent(el?.dataset?.event);
      return true;
    case "dismiss-host-event":
      dismissHostEvent(el?.dataset?.event);
      return true;
    case "host-nudge-waiting":
      openHostNudgeWaitingModal();
      return true;
    case "create-checkpoint":
      openCreateCheckpointModal();
      return true;
    case "create-recap":
      openCreateRecapModal();
      return true;
    case "room-invite-current":
      openRoomInviteModal();
      return true;
    case "copy-invite-code":
      copyInviteCode(el?.dataset?.inviteCode);
      return true;
    case "copy-play-link":
      copyPlayLink(el?.dataset?.inviteCode);
      return true;
    case "refresh-host-room":
      refreshHostRoom(true);
      return true;
    case "refresh-host-events":
      refreshHostEvents(true);
      return true;
    case "refresh-host-players":
      refreshHostPlayers(true);
      return true;
    case "refresh-host-clue-matrix":
      refreshHostClueMatrix(true);
      return true;
    case "refresh-host-audit":
      refreshHostAuditLog(true);
      return true;
    case "refresh-host-data":
      loadHostData(true, true);
      return true;
    case "onboarding-go-player": {
      const code = state.room?.invite_code || "";
      const url = code ? `${getPlayOrigin()}/?join=${encodeURIComponent(code)}` : getPlayOrigin();
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    }
    default:
      return false;
  }
}

app.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-form='auth']");
  if (!form) return;
  event.preventDefault();
  if (state.busy) return;
  await handleAuthSubmit(form);
});

app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || state.busy) return;
  const action = button.dataset.action;

  if (handleDirectorAction(action, button)) return;

  switch (action) {
    case "go-home":
      disconnectRoomEvents();
      state.view = "landing";
      render();
      break;
    case "go-pick-room":
      disconnectRoomEvents();
      state.view = "landing";
      state.landingStep = getWorldId() ? "rooms" : "worlds";
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
      render();
      break;
    case "world-select":
      await selectWorld(button.dataset.worldId);
      break;
    case "room-select":
      await selectRoom(button.dataset.roomId);
      break;
    case "refresh-rooms":
      await refreshRoomsList(true);
      break;
    case "create-room":
      await createHostRoom();
      break;
    case "landing-back-worlds":
      state.landingStep = "worlds";
      render();
      break;
    case "open-creator":
      window.open(getAppOrigin(), "_blank", "noopener,noreferrer");
      break;
    case "oauth":
      await handleOAuth(button.dataset.provider);
      break;
    case "logout":
      await handleLogout();
      break;
    case "dismiss-error":
      state.error = "";
      render();
      break;
    case "toggle-collapse-panel":
      togglePanelInDom(
        button.dataset.panelId,
        button.dataset.defaultOpen === "1",
        button
      );
      break;
    default:
      break;
  }
});

bootstrap();
