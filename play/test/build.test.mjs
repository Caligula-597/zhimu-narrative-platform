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

test("render.js escapes user content", () => {
  const renderSource = readFileSync(path.join(root, "src", "render.js"), "utf8");
  assert.match(renderSource, /escapeHtml\(/);
  assert.match(renderSource, /sanitizeImageUrl\(/);
});

test("main.js wires room SSE sync for host-player data", () => {
  const mainSource = readFileSync(path.join(root, "src", "main.js"), "utf8");
  const apiSource = readFileSync(path.join(root, "src", "api.js"), "utf8");
  const eventsSource = readFileSync(path.join(root, "src", "room-events.js"), "utf8");
  assert.match(mainSource, /connectRoomEvents/);
  assert.match(mainSource, /pullRoomData/);
  assert.match(apiSource, /events\/stream/);
  assert.match(apiSource, /Last-Event-ID/);
  assert.match(eventsSource, /room\.clue_granted/);
  assert.match(eventsSource, /room\.section_unlocked/);
});
