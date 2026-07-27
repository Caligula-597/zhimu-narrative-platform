import "./styles.css";
import {
  api,
  clearSession,
  getPlayOrigin,
  getSessionToken,
  setSessionToken,
  subscribeSessionToken
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
import { createPlayerHomeController } from "./runtime/player-home-controller.js";
import { createPlayStreamController } from "./runtime/stream-controller.js";
import { createRoomLifecycleController } from "./runtime/room-lifecycle-controller.js";
import { createRecapNotebookController } from "./runtime/recap-notebook-controller.js";

const app = document.getElementById("app");

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

const {
  pullRoomData,
  flushPendingRoomRefresh,
  coalescedPartialRefresh
} = createPlayerHomeController({
  api, state, render, isUuid, normalizeMiniGame, formatApiError,
  ensureDefaultVoiceRoom, refreshVoiceMessages, patchGameView,
  patchSyncChrome, setToast
});

const {
  loadRecapSummary,
  loadRecapDetail,
  loadMyTimeline,
  handleAddNotebookEntry,
  handleDeleteNotebookEntry
} = createRecapNotebookController({
  api, state, render, setBusy, setToast, formatApiError, pullRoomData
});

const {
  roomEventCtx,
  platformEventCtx,
  syncPlatformStream,
  syncRoomStream,
  handleAuthLost
} = createPlayStreamController({
  state, render, getSessionToken, clearSession, connectRoomEvents,
  disconnectRoomEvents, connectPlatformEvents, disconnectPlatformEvents,
  refreshVoiceMessages, patchGameView, pullRoomData, coalescedPartialRefresh,
  setToast, patchGameHostBanner, normalizeMiniGame,
  getGamePatchCtx: () => gamePatchCtx, patchSyncChromeOrRender, bumpTabPulse,
  loadPlazaPosts, loadPlazaThread, loadFriends, loadDmConversations,
  loadDmThread, pauseVoiceSession, persistRoom, isUuid
});

const {
  goToLanding,
  refreshHome,
  loadPublicRooms,
  handleLookupInvite,
  handleJoinRoom,
  handleJoinOfficial
} = createRoomLifecycleController({
  api, state, render, setBusy, setToast, formatApiError, normalizeInviteCode,
  ensureSession, persistRoom, persistGameSession, isUuid, cleanAuthUrl,
  pullRoomData, syncRoomStream, syncPlatformStream, disconnectRoomEvents,
  roomEventCtx, pauseVoiceSession,
  loadRecapSummary: (options) => loadRecapSummary(options),
  loadDmConversations
});

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

const {
  handleEmailVerify,
  handleForgotSubmit,
  handleResetSubmit,
  handleResendVerification,
  handleGuestSubmit,
  handleAuthSubmit,
  handleVerificationSubmit,
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
  handleVerificationSubmit,
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

let externalSessionGeneration = 0;
subscribeSessionToken(async (change) => {
  if (change.source !== "storage" && change.source !== "rejected") return;
  const generation = ++externalSessionGeneration;
  if (!change.token) {
    handleAuthLost();
    return;
  }
  await loadSessionUser();
  if (generation !== externalSessionGeneration || !state.user) return;
  syncPlatformStream();
  syncRoomStream();
  render();
});

bootstrap();
