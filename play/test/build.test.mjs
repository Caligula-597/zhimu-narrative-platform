import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("production build artifacts exist after vite build", () => {
  const distIndex = path.join(root, "dist", "index.html");
  const html = readFileSync(distIndex, "utf8");
  assert.match(html, /织幕 · 玩家端/);
  assert.match(html, /assets\/index-.*\.js/);
});

test("index.html uses module entry without inline scripts", () => {
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /src="\/src\/main\.js"/);
  assert.doesNotMatch(html, /<script(?![^>]*type="module")[^>]*>/);
});

test("play api persists bearer token for cross-origin session", () => {
  const source = readFileSync(path.join(root, "src", "api.js"), "utf8");
  const sharedToken = readFileSync(path.join(root, "..", "shared", "session-token.js"), "utf8");
  const portalClient = readFileSync(path.join(root, "..", "shared", "api-client.js"), "utf8");
  assert.match(source, /createPortalApiClient/);
  assert.match(source, /createSessionTokenStore/);
  assert.match(source, /sessionToken\.set/);
  assert.match(portalClient, /buildBearerAuthHeaders/);
  assert.match(sharedToken, /setItem\(key, token\)/);
  assert.doesNotMatch(source, /cookieSessionActive/);
  assert.match(source, /encodeURIComponent\(inviteCode\)/);
});

test("render layer escapes user content", () => {
  const renderSource = readFileSync(path.join(root, "src", "render.js"), "utf8");
  const gameSource = [
    "game-home-views.js", "game-section-view.js", "game-investigation-views.js",
    "game-play-views.js", "game-recap-views.js", "game-shell-view.js"
  ].map((file) => readFileSync(path.join(root, "src", "views", file), "utf8")).join("\n");
  assert.match(renderSource, /views\/game/);
  assert.match(gameSource, /escapeHtml\(/);
  assert.match(gameSource, /sanitizeImageUrl\(/);
});

test("main.js wires room SSE sync, lobby, plaza and social", () => {
  const mainSource = readFileSync(path.join(root, "src", "main.js"), "utf8");
  const apiSource = readFileSync(path.join(root, "src", "api.js"), "utf8");
  const eventsSource = readFileSync(path.join(root, "src", "room-events.js"), "utf8");
  const platformEventsSource = readFileSync(path.join(root, "src", "platform-events.js"), "utf8");
  const plazaSource = readFileSync(path.join(root, "src", "views", "plaza.js"), "utf8");
  const socialSource = readFileSync(path.join(root, "src", "views", "social.js"), "utf8");
  const lobbySource = readFileSync(path.join(root, "src", "views", "lobby.js"), "utf8");
  const startupSource = readFileSync(path.join(root, "src", "runtime", "startup.js"), "utf8");
  const voiceActionSource = readFileSync(path.join(root, "src", "runtime", "voice-action-controller.js"), "utf8");
  assert.match(mainSource, /connectRoomEvents/);
  assert.match(mainSource, /connectPlatformEvents/);
  assert.match(mainSource, /loadPlazaPosts/);
  assert.match(mainSource, /loadFriends/);
  assert.match(mainSource, /loadSessionUser/);
  assert.match(apiSource, /plaza\/posts/);
  assert.match(apiSource, /social\/friends/);
  assert.match(apiSource, /\/auth\/me/);
  assert.match(apiSource, /share-room/);
  assert.match(apiSource, /voice-rooms/);
  assert.match(apiSource, /streamPlatformEvents/);
  assert.match(eventsSource, /room\.clue_granted/);
  assert.match(eventsSource, /room\.voice_message_created/);
  assert.match(eventsSource, /room\.host_event_pending/);
  assert.match(mainSource, /handlePlayVoiceAction/);
  assert.match(voiceActionSource, /voice-live-connect/);
  const voiceSource = readFileSync(path.join(root, "src", "views", "voice.js"), "utf8");
  const livekitSource = readFileSync(path.join(root, "src", "voice", "livekit-voice.js"), "utf8");
  const gameSource = readFileSync(path.join(root, "src", "views", "game.js"), "utf8");
  assert.match(voiceSource, /renderVoiceTab/);
  assert.match(livekitSource, /connectVoiceRoom/);
  assert.match(livekitSource, /TrackSubscribed/);
  assert.match(livekitSource, /startVoicePlayback/);
  assert.match(mainSource, /patchGameView/);
  const patchSource = readFileSync(path.join(root, "src", "runtime", "patch-game.js"), "utf8");
  assert.match(patchSource, /data-game-tab-body/);
  assert.match(patchSource, /activeInputIn/);
  assert.match(patchSource, /renderGameSidebar/);
  assert.match(gameSource, /renderGameSidebar/);
  assert.match(gameSource, /renderGameTabBody/);
  const highlightsSource = readFileSync(path.join(root, "src", "utils", "highlights.js"), "utf8");
  const readerSource = readFileSync(path.join(root, "src", "runtime", "reader.js"), "utf8");
  const playerGameSource = readFileSync(path.join(root, "src", "runtime", "player-game-controller.js"), "utf8");
  assert.match(highlightsSource, /applyStoryHighlights/);
  assert.match(readerSource, /addNotebookEntry/);
  assert.match(readerSource, /onPatch/);
  assert.doesNotMatch(readerSource, /onRefresh/);
  assert.match(mainSource, /createPlayerGameController/);
  assert.match(playerGameSource, /executedRules\?\.\length/);
  assert.match(playerGameSource, /setToast\("已标记阅读完成", render, \{ patch: true \}/);
  const headerSource = readFileSync(path.join(root, "src", "components", "header.js"), "utf8");
  assert.match(headerSource, /data-room-pill="1"/);
  assert.match(headerSource, /data-role-pill="1"/);
  const stateSource = readFileSync(path.join(root, "src", "state.js"), "utf8");
  assert.match(stateSource, /GAME_TAB_KEY/);
  assert.match(stateSource, /GAME_SIDEBAR_KEY/);
  assert.match(stateSource, /readStoredSidebarCollapsed/);
  const gameViewSource = readFileSync(path.join(root, "src", "views", "game-shell-view.js"), "utf8");
  assert.match(gameViewSource, /game-main[\s\S]*game-sidebar/s);
  const shellSource = readFileSync(path.join(root, "src", "components", "shell.js"), "utf8");
  assert.match(shellSource, /renderGameResume/);
  const landingSource = readFileSync(path.join(root, "src", "views", "landing.js"), "utf8");
  const errorsSource = readFileSync(path.join(root, "src", "errors.js"), "utf8");
  assert.match(landingSource, /renderLandingAuthActions/);
  assert.match(errorsSource, /ROLE_ALREADY_BOUND/);
  assert.match(landingSource, /landing-actions-signed-in/);
  assert.match(mainSource, /runPlayStartup/);
  assert.match(startupSource, /state\.view === "landing"/);
  const gameHomeSource = readFileSync(path.join(root, "src", "views", "game-home-views.js"), "utf8");
  assert.match(gameHomeSource, /hostConfirmBanner/);
  assert.match(apiSource, /notebook/);
  assert.match(apiSource, /sections\/\$\{sectionId\}\/start/);
  assert.match(readerSource, /api\.startSection/);
  assert.match(apiSource, /recap\/latest/);
  assert.match(apiSource, /forgot-password/);
  const urlSource = readFileSync(path.join(root, "src", "runtime", "url.js"), "utf8");
  const recapSource = readFileSync(path.join(root, "src", "views", "recap.js"), "utf8");
  assert.match(urlSource, /syncPlayUrl/);
  assert.match(recapSource, /renderRecapTab/);
  assert.match(platformEventsSource, /plaza\.post_created/);
  assert.match(plazaSource, /renderPlaza/);
  assert.match(socialSource, /renderFriends/);
  assert.match(socialSource, /renderDm/);
  assert.match(lobbySource, /renderLobby/);
});

test("web vitals are reported to the shared app backend", () => {
  const mainSource = readFileSync(path.join(root, "src", "main.js"), "utf8");
  assert.match(mainSource, /getAppOrigin/);
  assert.match(mainSource, /endpoint:\s*`\$\{getAppOrigin\(\)\}\/api\/metrics\/web-vitals`/);
  assert.doesNotMatch(mainSource, /endpoint:\s*["']\/api\/metrics\/web-vitals["']/);
});
