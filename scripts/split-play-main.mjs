import fs from "node:fs";
import path from "node:path";

const target = path.resolve(import.meta.dirname, "../play/src/main.js");
let source = fs.readFileSync(target, "utf8");
if (!source.includes('from "./runtime/startup.js"')) {
  source = source.replace(
    'import { setVoiceRenderCallback } from "./voice/livekit-voice.js";',
    `import { setVoiceRenderCallback } from "./voice/livekit-voice.js";
import { createSessionController } from "./runtime/session-controller.js";
import { resolveInitialRoute } from "./runtime/router.js";
import { runPlayStartup } from "./runtime/startup.js";
import { createPlayViewController } from "./runtime/view-controller.js";`
  );
  source = source.replace("let modalFocusReturn = null;\n", "");

  const renderStart = source.indexOf("function render() {");
  const renderEnd = source.indexOf("setVoiceRenderCallback(render);", renderStart);
  if (renderStart < 0 || renderEnd < 0) throw new Error("Play render markers missing");
  const renderSetup = `const { render } = createPlayViewController({
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

`;
  source = `${source.slice(0, renderStart)}${renderSetup}${source.slice(renderEnd)}`;

  const sessionStart = source.indexOf("function normalizeUser");
  const sessionEnd = source.indexOf("async function loadPlatform", sessionStart);
  if (sessionStart < 0 || sessionEnd < 0) throw new Error("Play session markers missing");
  const sessionSetup = `const {
  cleanAuthUrl,
  ensureSession,
  loadSessionUser,
  normalizeUser
} = createSessionController({ api, state, clearSession, getSessionToken, setSessionToken });

`;
  source = `${source.slice(0, sessionStart)}${sessionSetup}${source.slice(sessionEnd)}`;
  source = source.replaceAll("cleanUrl()", "cleanAuthUrl()");

  const focusStart = source.indexOf("function bindModalFocus");
  const focusEnd = source.indexOf("function handleAuthLost", focusStart);
  if (focusStart < 0 || focusEnd < 0) throw new Error("Play focus markers missing");
  source = `${source.slice(0, focusStart)}${source.slice(focusEnd)}`;

  const bootstrapStart = source.indexOf("async function bootstrap() {");
  const bootstrapEnd = source.indexOf("async function refreshJoinPreview", bootstrapStart);
  if (bootstrapStart < 0 || bootstrapEnd < 0) throw new Error("Play bootstrap markers missing");
  const bootstrap = `async function bootstrap() {
  return runPlayStartup({
    state, api, render, setBusy, setToast, formatApiError, normalizeUser,
    setSessionToken, clearSession, cleanAuthUrl, loadSessionUser, ensureSession,
    loadAuthConfig, loadPlatform, loadPublicRooms, loadDmConversations,
    loadPlazaPosts, loadFriends, loadPlazaThread, handleJoinOfficial,
    handleLookupInvite, refreshHome, loadRecapSummary, syncPlatformStream,
    handleEmailVerify, normalizeInviteCode, isUuid, persistRoom, resolveInitialRoute
  });
}

`;
  source = `${source.slice(0, bootstrapStart)}${bootstrap}${source.slice(bootstrapEnd)}`;
}

fs.writeFileSync(target, source.replace(/\r\n/g, "\n"));
console.log("Play main split complete");
