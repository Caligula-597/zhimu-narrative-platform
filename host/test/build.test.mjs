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

test("host api uses cookie credentials, bearer fallback and room-scoped host endpoints", () => {
  const apiSource = readFileSync(path.join(root, "src", "api.js"), "utf8");
  const sessionSource = readFileSync(path.join(root, "src", "session.js"), "utf8");
  const sharedFetchSource = readFileSync(path.join(root, "..", "shared", "api-fetch.js"), "utf8");
  const sharedSseSource = readFileSync(path.join(root, "..", "shared", "sse-client.js"), "utf8");
  const sharedTokenSource = readFileSync(path.join(root, "..", "shared", "session-token.js"), "utf8");
  assert.match(apiSource, /getHostPlayers/);
  assert.match(apiSource, /streamRoomEvents/);
  assert.match(apiSource, /getWorldSegments/);
  assert.match(apiSource, /getHostOrigin/);
  assert.match(apiSource, /createApiFetch/);
  assert.match(apiSource, /bearerHeaders\(\)/);
  assert.match(apiSource, /defaultSessionTokenStore/);
  assert.match(apiSource, /createRoom/);
  assert.match(apiSource, /openSseStream/);
  assert.match(sharedSseSource, /message\?\.type === "connected"/);
  assert.match(sharedSseSource, /message\?\.type === "heartbeat"/);
  assert.match(sharedSseSource, /Last-Event-ID/);
  assert.match(sharedFetchSource, /credentials = "include"/);
  assert.match(sharedTokenSource, /setItem\(key, token\)/);
  assert.match(sessionSource, /defaultSessionTokenStore/);
});

test("main.js wires console, SSE and director actions", () => {
  const mainSource = readFileSync(path.join(root, "src", "main.js"), "utf8");
  const consoleSource = readFileSync(path.join(root, "src", "views", "console.js"), "utf8");
  const dataSource = readFileSync(path.join(root, "src", "runtime", "data.js"), "utf8");
  const eventsSource = readFileSync(path.join(root, "src", "runtime", "room-events.js"), "utf8");
  assert.match(mainSource, /connectRoomEvents/);
  assert.match(mainSource, /executeHostEvent/);
  assert.match(mainSource, /case "host-select-act"/);
  assert.match(mainSource, /el\?\.dataset\?\.actKey/);
  assert.match(mainSource, /clueId:\s*el\?\.dataset\?\.clueId/);
  assert.match(mainSource, /roleKey:\s*el\?\.dataset\?\.roleKey/);
  assert.match(mainSource, /openHostUnlockSectionModal\(\{\s*actKey:\s*el\?\.dataset\?\.actKey\s*\}\)/);
  assert.doesNotMatch(mainSource, /button\.dataset\.(?:testimony|flag|remedy|voteId|status|actionId|actKey)/);
  assert.match(mainSource, /renderApp/);
  assert.match(mainSource, /api\.me\(\)/);
  assert.doesNotMatch(mainSource, /if \(!getSessionToken\(\)\) return/);
  assert.match(consoleSource, /renderConsole/);
  assert.match(consoleSource, /host-kick-player/);
  assert.match(dataSource, /api\.getWorldSegments\(worldId\)/);
  assert.match(eventsSource, /room\.host_event_pending/);
});

test("host command center uses segment runbooks and five critical queue actions", () => {
  const layoutSource = readFileSync(path.join(root, "src", "views", "host-layout.js"), "utf8");
  const stylesSource = readFileSync(path.join(root, "src", "styles.css"), "utf8");
  assert.match(layoutSource, /state\.cloudWorldSegments/);
  assert.match(layoutSource, /export function hostRunbooks/);
  assert.match(layoutSource, /resolveChapterSegmentKey/);
  assert.match(layoutSource, /segmentRunbookFromOperations/);
  assert.match(layoutSource, /runbook\?\.fallbacks/);
  assert.match(layoutSource, /state\.cloudHostClueMatrix/);
  assert.match(layoutSource, /function grantStatus/);
  assert.match(layoutSource, /renderPlayerTasks/);
  assert.match(layoutSource, /runbook\?\.playerTasks/);
  assert.match(layoutSource, /data-clue-id/);
  assert.match(layoutSource, /data-role-key/);
  assert.match(layoutSource, /解锁本幕分幕/);
  assert.match(layoutSource, /renderHostCommandCenter/);
  assert.match(layoutSource, /data-action="host-select-act"/);
  for (const action of ["host-apply-remedy", "host-vote-status", "host-review-private-action", "host-review-testimony"]) {
    assert.match(layoutSource, new RegExp(`data-action=["']${action}["']`), `missing command center action: ${action}`);
  }
  assert.match(stylesSource, /host-command-center/);
  assert.match(stylesSource, /host-clue-grant-item/);
  assert.match(stylesSource, /host-task-item/);
  assert.match(stylesSource, /@media \(max-width: 1180px\)/);
});

test("landing view exposes room management for authenticated hosts", () => {
  const landingSource = readFileSync(path.join(root, "src", "views", "landing.js"), "utf8");
  const mainSource = readFileSync(path.join(root, "src", "main.js"), "utf8");
  assert.match(landingSource, /data-action="create-room"/);
  assert.match(landingSource, /data-action="refresh-rooms"/);
  assert.match(mainSource, /case "create-room"/);
  assert.match(mainSource, /case "refresh-rooms"/);
});

test("console render escapes user content", () => {
  const consoleSource = readFileSync(path.join(root, "src", "views", "console.js"), "utf8");
  assert.match(consoleSource, /escapeHtml\(/);
  assert.match(consoleSource, /hostActClueIds/);
  assert.match(consoleSource, /resolveSectionSegmentKey/);
  assert.match(consoleSource, /sectionOptionsForRole/);
  assert.match(consoleSource, /selectedClueId/);
  assert.match(consoleSource, /checkedRoleIds/);
});

test("standalone console keeps the full host monitoring action surface", () => {
  const consoleSource = readFileSync(path.join(root, "src", "views", "console.js"), "utf8");
  const layoutSource = readFileSync(path.join(root, "src", "views", "host-layout.js"), "utf8");
  const mainSource = readFileSync(path.join(root, "src", "main.js"), "utf8");
  const hostSurface = `${consoleSource}\n${layoutSource}`;
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
    assert.match(hostSurface, new RegExp(`data-action=["']${action}["']`), `missing host action: ${action}`);
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
  assert.doesNotMatch(stylesSource, /\.host-console > \.director-head/);
  assert.match(stylesSource, /host-support-grid/);
  assert.match(stylesSource, /@media \(max-width: 520px\)/);
});
