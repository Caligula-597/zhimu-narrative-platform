import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("production build artifacts exist after vite build", () => {
  const distIndex = path.join(root, "dist", "index.html");
  const html = readFileSync(distIndex, "utf8");
  assert.match(html, /织幕 · 主持端/);
  assert.match(html, /assets\/index-.*\.js/);
});

test("index.html uses module entry without inline scripts", () => {
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /src="\/src\/main\.js"/);
  assert.doesNotMatch(html, /<script(?![^>]*type="module")[^>]*>/);
});

test("host api uses bearer token and room-scoped host endpoints", () => {
  const apiSource = readFileSync(path.join(root, "src", "api.js"), "utf8");
  const sessionSource = readFileSync(path.join(root, "src", "session.js"), "utf8");
  assert.match(apiSource, /getHostPlayers/);
  assert.match(apiSource, /streamRoomEvents/);
  assert.match(apiSource, /getHostOrigin/);
  assert.match(apiSource, /authorization.*Bearer/s);
  assert.match(sessionSource, /localStorage\.setItem\(TOKEN_KEY/);
});

test("main.js wires console, SSE and director actions", () => {
  const mainSource = readFileSync(path.join(root, "src", "main.js"), "utf8");
  const consoleSource = readFileSync(path.join(root, "src", "views", "console.js"), "utf8");
  const eventsSource = readFileSync(path.join(root, "src", "runtime", "room-events.js"), "utf8");
  assert.match(mainSource, /connectRoomEvents/);
  assert.match(mainSource, /executeHostEvent/);
  assert.match(mainSource, /renderApp/);
  assert.match(consoleSource, /renderConsole/);
  assert.match(consoleSource, /host-kick-player/);
  assert.match(eventsSource, /room\.host_event_pending/);
});

test("console render escapes user content", () => {
  const consoleSource = readFileSync(path.join(root, "src", "views", "console.js"), "utf8");
  assert.match(consoleSource, /escapeHtml\(/);
});

test("standalone console keeps the full host monitoring action surface", () => {
  const consoleSource = readFileSync(path.join(root, "src", "views", "console.js"), "utf8");
  const mainSource = readFileSync(path.join(root, "src", "main.js"), "utf8");
  const actions = [
    "batch-dismiss-host-events",
    "batch-execute-host-events",
    "copy-invite-code",
    "copy-play-link",
    "create-checkpoint",
    "create-recap",
    "delay-host-event",
    "dismiss-host-event",
    "execute-host-event",
    "host-clue-note",
    "host-event-context",
    "host-event-select-all",
    "host-event-toggle",
    "host-kick-player",
    "host-manual-grant-clue",
    "host-manual-grant-item",
    "host-manual-log",
    "host-manual-unlock-scene",
    "host-manual-unlock-section",
    "host-nudge-waiting",
    "host-player-detail",
    "onboarding-go-player",
    "refresh-host-audit",
    "refresh-host-clue-matrix",
    "refresh-host-events",
    "refresh-host-players",
    "refresh-host-room",
    "room-invite-current",
    "rule-manual-trigger",
    "rules-preview"
  ];

  for (const action of actions) {
    assert.match(consoleSource, new RegExp(`data-action=["']${action}["']`), `missing console action: ${action}`);
    assert.match(mainSource, new RegExp(`["']${action}["']`), `missing action handler: ${action}`);
  }
});

test("host dev and preview share the documented port and API proxy", () => {
  const configSource = readFileSync(path.join(root, "vite.config.mjs"), "utf8");
  const packageSource = readFileSync(path.join(root, "package.json"), "utf8");
  assert.match(configSource, /VITE_HOST_DEV_PORT\s*\|\|\s*5175/);
  assert.match(configSource, /VITE_API_PROXY_TARGET\s*\|\|\s*"http:\/\/127\.0\.0\.1:4180"/);
  assert.match(configSource, /strictPort:\s*true/);
  assert.doesNotMatch(packageSource, /vite[^"\n]*--port/);
});

test("host shell exposes dedicated responsive workspace structure", () => {
  const shellSource = readFileSync(path.join(root, "src", "components", "shell.js"), "utf8");
  const headerSource = readFileSync(path.join(root, "src", "components", "header.js"), "utf8");
  const stylesSource = readFileSync(path.join(root, "src", "styles.css"), "utf8");
  assert.match(shellSource, /host-app-shell/);
  assert.match(headerSource, /host-header-inner/);
  assert.match(stylesSource, /host-console-grid/);
  assert.match(stylesSource, /@media \(max-width: 520px\)/);
});
