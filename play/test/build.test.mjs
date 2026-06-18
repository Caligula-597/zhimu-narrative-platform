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

test("api client encodes invite codes in path", async () => {
  const source = readFileSync(path.join(root, "src", "api.js"), "utf8");
  assert.match(source, /encodeURIComponent\(inviteCode\)/);
});

test("render layer escapes user content", () => {
  const renderSource = readFileSync(path.join(root, "src", "render.js"), "utf8");
  const gameSource = readFileSync(path.join(root, "src", "views", "game.js"), "utf8");
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
  assert.match(apiSource, /platform\/events\/stream/);
  assert.match(eventsSource, /room\.clue_granted/);
  assert.match(eventsSource, /room\.voice_message_created/);
  assert.match(mainSource, /voice-live-connect/);
  const voiceSource = readFileSync(path.join(root, "src", "views", "voice.js"), "utf8");
  const livekitSource = readFileSync(path.join(root, "src", "voice", "livekit-voice.js"), "utf8");
  assert.match(voiceSource, /renderVoiceTab/);
  assert.match(livekitSource, /connectVoiceRoom/);
  assert.match(platformEventsSource, /plaza\.post_created/);
  assert.match(plazaSource, /renderPlaza/);
  assert.match(socialSource, /renderFriends/);
  assert.match(socialSource, /renderDm/);
  assert.match(lobbySource, /renderLobby/);
});
