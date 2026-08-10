/**
 * Static UI smoke check — verifies frontend shell, assets, API wiring, and P0-1 data-honesty invariants.
 * Run with frontend (4173) and optionally backend (4180) already up.
 * Source-level checks read from UI_SOURCE_ROOT (default: repo root), not HTTP — works with Vite dist.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = process.env.UI_BASE_URL || "http://localhost:4173";
const API = process.env.UI_API_BASE || "http://localhost:4180/api";
const sourceRoot = process.env.UI_SOURCE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(rel) {
  const filePath = path.join(sourceRoot, rel.replace(/^\.\//, ""));
  if (!fs.existsSync(filePath)) throw new Error(`source missing: ${rel}`);
  return fs.readFileSync(filePath, "utf8");
}

async function readSourceBundle(rels) {
  return Object.fromEntries(rels.map((rel) => [rel, readSource(rel)]));
}

/* ── API bundle helpers ──
 * After the A1 migration, the original 599-line src/api/client.js was split
 * into domain modules plus shared request/SSE transports. Smoke checks that
 * used to grep a single file now read the concatenated transport bundle.
 */
const API_DOMAIN_FILES = [
  "src/api/client.js",
  "src/api/auth.js",
  "src/api/world.js",
  "src/api/studio.js",
  "src/api/room.js",
  "src/api/host.js",
  "src/api/player.js",
  "src/api/voice.js",
  "src/api/recap.js",
  "src/api/ai.js",
  "src/api/content.js",
  "src/api/assets.js",
  "src/api/ops.js",
  "src/api/index.js",
  "shared/api-fetch.js",
  "shared/sse-client.js"
];

let apiBundleCache = null;
function readApiBundle() {
  if (apiBundleCache) return apiBundleCache;
  apiBundleCache = API_DOMAIN_FILES.map((rel) => readSource(rel)).join("\n");
  return apiBundleCache;
}

/** Matches a method declaration in any of the supported syntaxes:
 *  - `export function method(`  (new domain modules)
 *  - `method:`                  (legacy IIFE object literal, kept in client.js bridges)
 *  - `method =` / `method(`     (assignment or shorthand)
 */
function apiHasMethod(bundle, method) {
  const re = new RegExp(`\\b${method}\\s*[(:=]`);
  return re.test(bundle);
}

const requiredModuleScripts = [
  "config.js",
  "src/dom.js",
  "src/state.js",
  "src/utils/user-messages.js",
  "src/api/client.js",
  "src/api/index.js",
  "rule-visual.js",
  "src/utils/format.js",
  "src/components/emptyState.js",
  "src/components/toast.js",
  "src/components/modal.js",
  "src/views/overview.js",
  "src/views/writer.js",
  "src/views/studio.js",
  "src/views/clues.js",
  "src/views/assets.js",
  "src/views/rules.js",
  "src/views/player.js",
  "src/views/archive.js",
  "src/views/settings.js",
  "src/bootstrap/render-shell.js",
  "src/runtime/wizard.js",
  "src/runtime/auth-session.js",
  "src/runtime/workspace-store.js",
  "src/runtime/runtime-store.js",
  "src/runtime/context-coordinator.js",
  "src/runtime/account-quota.js",
  "src/runtime/room-events.js",
  "src/runtime/auth-world.js",
  "src/runtime/actions-workspace.js",
  "src/runtime/global-search.js",
  "src/runtime/search-focus.js",
  "src/runtime/livekit-voice.js",
  "src/runtime/data.js",
  "src/runtime/actions.js",
  "app.js"
];
const requiredNavViews = ["creatorCockpit", "writer", "truth", "studio", "tabletopMap", "clues", "rules", "miniGames", "archive", "settings", "account", "ops"];
const requiredDomIds = ["content", "toast", "modal-backdrop", "modal", "page-title", "create-world-btn", "preview-btn", "run-btn"];
const requiredApiMethods = [
  "getWorlds", "getStudio", "getPlayerHome", "getHostProgress", "getHostPlayers", "getHostPlayerDetail", "getHostAuditLog",
  "joinRoom", "getRoomInvite", "searchWorld", "getAssetDownloadUrl", "shareClueToRoles", "delayHostEvent",
  "completeSection", "getExploration", "createWorld", "getRules", "hostGrantClue", "hostUnlockSection", "dismissHostEvent"
];

const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS  ${name}: ${detail}`);
    return true;
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
    console.error(`FAIL  ${name}: ${error.message}`);
    return false;
  }
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function fetchFrontendSources() {
  return readSourceBundle(requiredModuleScripts);
}

await check("frontend-index", async () => {
  const html = await fetchText(`${FRONTEND}/`);
  if (!html.includes("织幕")) throw new Error("missing app title");
  if (!html.includes('id="content"')) throw new Error("missing #content");
  for (const id of requiredDomIds) {
    if (!html.includes(`id="${id}"`)) throw new Error(`missing #${id}`);
  }
  return `${requiredDomIds.length} critical DOM ids present`;
});

await check("frontend-styles", async () => {
  let css;
  try {
    css = await fetchText(`${FRONTEND}/styles.css`);
  } catch {
    const html = await fetchText(`${FRONTEND}/`);
    const match = html.match(/href="(\/assets\/[^"]+\.css)"/);
    if (!match) throw new Error("no stylesheet link in served index.html");
    css = await fetchText(`${FRONTEND}${match[1]}`);
  }
  if (css.length < 1000) throw new Error("stylesheet suspiciously small");
  for (const sel of [".app-shell", ".sidebar", ".main-area", ".modal", ".toast"]) {
    if (!css.includes(sel)) throw new Error(`missing CSS selector ${sel}`);
  }
  return `${Math.round(css.length / 1024)}KB stylesheet`;
});

await check("frontend-served-bundle", async () => {
  const html = await fetchText(`${FRONTEND}/`);
  if (html.includes("/frontend/main.js")) return "Vite dev entry (unbundled)";
  const match = html.match(/src="(\/assets\/[^"]+\.js)"/);
  if (!match) throw new Error("served index missing /assets/*.js");
  const js = await fetchText(`${FRONTEND}${match[1]}`);
  if (js.length < 10_000) throw new Error("main bundle suspiciously small");
  return `production bundle ${Math.round(js.length / 1024)}KB`;
});

for (const script of ["app.js", "src/api/client.js", "src/api/index.js", "src/state.js"]) {
  await check(`script-${script.replace(/\//g, "-")}`, async () => {
    const js = readSource(script);
    if (js.length < 50) throw new Error("file too small");
    return `${Math.round(js.length / 1024)}KB`;
  });
}

await check("vite-entry-wired", async () => {
  const html = readSource("index.html");
  if (!html.includes('type="module"') || !html.includes("/frontend/main.js")) {
    throw new Error("index.html must load /frontend/main.js as ES module");
  }
  if (!fs.existsSync(path.join(sourceRoot, "frontend/main.js"))) {
    throw new Error("frontend/main.js entry missing");
  }
  return "Vite module entry configured";
});

await check("nav-views-match-app", async () => {
  const html = readSource("index.html");
  const resolverJs = readSource("src/bootstrap/view-resolver.js");
  const navViews = [...html.matchAll(/data-view="([^"]+)"/g)].map((m) => m[1]);
  const uniqueNav = [...new Set(navViews)];
  for (const view of requiredNavViews) {
    if (!uniqueNav.includes(view)) throw new Error(`nav missing data-view="${view}"`);
  }
  for (const view of requiredNavViews) {
    if (!resolverJs.includes(`${view}: [`)) throw new Error(`view-resolver.js metadata missing ${view}`);
    if (!resolverJs.includes(`case "${view}"`)) throw new Error(`view-resolver.js resolver missing ${view}`);
  }
  if (!/getView\("overview"\)\.overview/.test(resolverJs) || !/getView\("studio"\)\.studioCloud/.test(resolverJs)) {
    throw new Error("view-resolver.js must delegate through view registry");
  }
  return `${uniqueNav.length} nav views wired`;
});

await check("api-client-surface", async () => {
  const bundle = readApiBundle();
  const indexJs = readSource("src/api/index.js");
  // index.js must be a real ES module aggregator re-exporting from every domain module.
  const expectedDomains = ["client", "auth", "world", "studio", "room", "host", "player", "voice", "recap", "ai", "content", "assets", "ops"];
  for (const domain of expectedDomains) {
    if (!indexJs.includes(`from "./${domain}.js"`)) {
      throw new Error(`index.js missing re-export from ${domain}.js`);
    }
  }
  // `context` alias is consumed by `import * as zhimuApi from "../api/index.js"` in views/runtime.
  if (!indexJs.includes("export { demoContext as context }")) {
    throw new Error("index.js missing context alias export");
  }
  // Bearer auth header is built in session-auth.js; client.js delegates via sessionAuth().authHeaders().
  const sessionAuthJs = readSource("src/runtime/session-auth.js");
  if (!sessionAuthJs.includes("Bearer")) throw new Error("session Bearer auth not present in session-auth.js");
  for (const method of requiredApiMethods) {
    if (!apiHasMethod(bundle, method)) {
      throw new Error(`api bundle missing ${method}`);
    }
  }
  return `${requiredApiMethods.length} core API methods declared across ${API_DOMAIN_FILES.length} domain modules`;
});

await check("state-runtime-boundaries", async () => {
  const stateJs = readSource("src/state.js");
  if (!stateJs.includes("activateShardBridge")) throw new Error("shard bridge not activated in state.js");
  for (const removed of ["players:", "logs:", "demoStep:"]) {
    if (stateJs.includes(removed)) throw new Error(`state still has demo runtime field ${removed}`);
  }
  // 关键字段已迁至 shard 文件，检查 Creator 自身消费的运行态字段。
  const shardFieldChecks = [
    { shard: "src/state/voice-store.js", fields: ["voiceRoomId", "voiceLiveStatus"] },
    { shard: "src/state/world-store.js", fields: ["cloudWorldLogs"] },
    { shard: "src/state/studio-store.js", fields: ["cloudStudio"] },
    { shard: "src/state/room-store.js", fields: ["cloudPlayer", "cloudHost", "cloudHostPlayers", "cloudHostStuckCount", "cloudHostEvents", "cloudCheckpoints", "cloudRecaps", "cloudRecapLatest"] }
  ];
  for (const { shard, fields } of shardFieldChecks) {
    const js = readSource(shard);
    for (const f of fields) {
      if (!js.includes(f)) throw new Error(`${shard} missing ${f}`);
    }
  }
  const dataJs = readSource("src/runtime/data.js");
  const runtimeStoreJs = readSource("src/runtime/runtime-store.js");
  const workspaceJs = readSource("src/runtime/workspace-store.js");
  const contextJs = readSource("src/runtime/context-coordinator.js");
  if (!dataJs.includes("clearRuntimeState")) throw new Error("clearRuntimeState not in runtime/data.js");
  if (!dataJs.includes("loadCloudData")) throw new Error("loadCloudData not in runtime/data.js");
  if (!runtimeStoreJs.includes("clearRuntimeFields")) throw new Error("runtime-store missing clearRuntimeFields");
  if (!workspaceJs.includes("ensureActiveWorld")) throw new Error("workspace-store missing ensureActiveWorld");
  if (!contextJs.includes("prepareWorldSwitch")) throw new Error("context-coordinator missing prepareWorldSwitch");
  return "state + runtime cleanup present";
});

await check("no-hardcoded-assetsData", async () => {
  const sources = await fetchFrontendSources();
  const bundle = Object.values(sources).join("\n");
  if (/\bassetsData\b/.test(bundle)) throw new Error("assetsData still present in frontend bundle");
  if (bundle.includes("被撕去一页的航运录")) throw new Error("hardcoded demo asset copy still in frontend");
  return "no assetsData demo grid";
});

await check("overview-uses-world-logs", async () => {
  const overview = readSource("src/views/overview.js");
  const dataJs = readSource("src/runtime/data.js");
  if (!dataJs.includes("getWorldLogs")) throw new Error("loadCloudData must fetch getWorldLogs");
  if (!overview.includes("cloudWorldLogs")) throw new Error("overview must use cloudWorldLogs");
  return "world logs wired for overview";
});

await check("host-console-wired", async () => {
  const hostConsole = [
    readSource("host/src/views/console.js"),
    readSource("host/src/views/host-layout.js"),
    readSource("host/src/runtime/host-operation-controller.js")
  ].join("\n");
  for (const token of ["playersTableRows", "host-player-detail", "host-runtime-table", "hostClueMatrixCard"]) {
    if (!hostConsole.includes(token)) throw new Error(`canonical Host console missing token ${token}`);
  }
  const css = readSource("host/src/styles.css");
  if (!css.includes(".host-runtime-table")) throw new Error("Host styles missing host-runtime-table");
  return "canonical Host console UI + styles present";
});

await check("studio-node-edit-wired", async () => {
  const studio = readSource("src/views/studio.js");
  for (const token of ["studioNodeEditPanel", "studio-save-node", "saveSelectedStudioNode"]) {
    if (!studio.includes(token)) throw new Error(`studio view missing token ${token}`);
  }
  const apiBundle = readApiBundle();
  for (const method of ["updateScene", "updateClue", "updateInvestigationPoint", "getStudioNodeReferences"]) {
    if (!apiHasMethod(apiBundle, method)) throw new Error(`api bundle missing ${method}`);
  }
  const css = readSource("styles.css");
  if (!css.includes(".studio-edit-panel")) throw new Error("styles missing studio-edit-panel");
  return "studio node edit panel wired";
});

await check("clue-sharing-wired", async () => {
  const player = readSource("src/views/player.js");
  for (const token of ["shareCloudClue", "sharedClueSection"]) {
    if (!player.includes(token)) throw new Error(`player view missing clue-sharing token ${token}`);
  }
  if (!readSource("host/src/views/console.js").includes("hostClueMatrixCard")) {
    throw new Error("canonical Host console missing hostClueMatrixCard");
  }
  const apiBundle = readApiBundle();
  for (const method of ["shareClueToRoom", "updateCluePlayerNote", "getHostClueMatrix"]) {
    if (!apiHasMethod(apiBundle, method)) throw new Error(`api bundle missing ${method}`);
  }
  return "clue sharing wired";
});

await check("rule-visual-wired", async () => {
  const rules = readSource("src/views/rules.js");
  const ruleJs = readSource("rule-visual.js");
  for (const token of ["openRuleEditor", "data-rule-tab", "validateRuleBody"]) {
    if (!rules.includes(token)) throw new Error(`rules view missing rule visual token ${token}`);
  }
  if (!ruleJs.includes("visualToRuleJson")) throw new Error("rule-visual.js missing visualToRuleJson");
  const apiBundle = readApiBundle();
  if (!apiHasMethod(apiBundle, "validateRuleBody")) throw new Error("api bundle missing validateRuleBody");
  return "rule visual editor wired";
});

await check("room-events-wired", async () => {
  const dataJs = readSource("src/runtime/data.js");
  const roomJs = readSource("src/runtime/room-events.js");
  for (const token of ["connectRoomEventStream", "handleRoomEvent", "roomEventsConnected"]) {
    const bundle = `${dataJs}${roomJs}`;
    if (!bundle.includes(token)) throw new Error(`room events modules missing token ${token}`);
  }
  const apiBundle = readApiBundle();
  if (!apiHasMethod(apiBundle, "streamRoomEvents")) throw new Error("api bundle missing streamRoomEvents");
  return "SSE room events wired";
});

await check("refresh-notify-wired", async () => {
  const dataJs = readSource("src/runtime/data.js");
  const roomEventsJs = readSource("src/runtime/room-events.js");
  const toastJs = readSource("src/components/toast.js");
  const runtimeBundle = `${dataJs}${roomEventsJs}`;
  for (const token of ["refreshHostRoom", "refreshHostEvents", "refreshHostRuntimeSnapshot"]) {
    if (!runtimeBundle.includes(token)) throw new Error(`Creator overview runtime missing refresh token ${token}`);
  }
  for (const token of ["updateNotifyBadge", "pendingHostEventCount"]) {
    if (!toastJs.includes(token)) throw new Error(`toast.js missing ${token}`);
  }
  if (!roomEventsJs.includes('view === "overview"')) throw new Error("overview SSE fallback missing");
  return "Creator overview refresh + notify reconciliation wired";
});

await check("host-audit-wired", async () => {
  const hostBundle = [
    readSource("host/src/views/console.js"),
    readSource("host/src/runtime/data.js"),
    readSource("host/src/runtime/director-actions.js"),
    readSource("host/src/utils/format.js"),
    readSource("host/src/api.js")
  ].join("\n");
  for (const token of ["hostAuditCard", "host-audit-card", "refresh-host-audit", "cloudHostAuditLog", "getHostAuditLog"]) {
    if (!hostBundle.includes(token)) throw new Error(`canonical Host audit wiring missing ${token}`);
  }
  return "canonical Host audit UI + refresh wired";
});

await check("clues-view-wired", async () => {
  const clues = readSource("src/views/clues.js");
  const resolverJs = readSource("src/bootstrap/view-resolver.js");
  for (const token of ["cluesSearchQuery", "cluesSelectedId", "cluesBulkSelection", "clues-edit", "clues-add", "clues-delete", "clues-batch-delete", "openCluesEditor", "confirmDeleteClue"]) {
    if (!clues.includes(token)) throw new Error(`clues view missing ${token}`);
  }
  if (!/case "clues": return getView\("clues"\)\.clues/.test(resolverJs)) throw new Error("view-resolver.js must resolve clues view through registry");
  return "standalone clues management view wired";
});

await check("clue-share-roles-wired", async () => {
  const player = readSource("src/views/player.js");
  const apiBundle = readApiBundle();
  for (const token of ["share-clue-roles", "shareClueToRoles", "shared_with_roles", "私享线索"]) {
    const bundle = `${player}${apiBundle}`;
    if (!bundle.includes(token)) throw new Error(`clue share-roles wiring missing ${token}`);
  }
  return "player private clue share UI wired";
});

await check("host-delay-wired", async () => {
  const hostBundle = [
    readSource("host/src/runtime/host-event-workspace-service.js"),
    readSource("host/src/runtime/host-event-workspace-controller.js"),
    readSource("host/src/runtime/host-event-queue.js"),
    readSource("host/src/api.js")
  ].join("\n");
  for (const token of ["delayHostEvent", "host-event-delayed", "delay_until"]) {
    if (!hostBundle.includes(token)) throw new Error(`canonical Host delay wiring missing ${token}`);
  }
  return "canonical Host event delay workflow wired";
});

await check("global-search-focus-wired", async () => {
  const searchJs = readSource("src/runtime/global-search.js");
  const focusJs = readSource("src/runtime/search-focus.js");
  for (const token of ["searchFocus", "applyAfterRender", "search-highlight", "zhimuSearchFocus"]) {
    const bundle = `${searchJs}${focusJs}`;
    if (!bundle.includes(token)) throw new Error(`search focus wiring missing ${token}`);
  }
  return "global search highlight/focus wired";
});

await check("creator-host-state-boundary", async () => {
  const runtimeStoreJs = readSource("src/runtime/runtime-store.js");
  const contextJs = readSource("src/runtime/context-coordinator.js");
  if (runtimeStoreJs.includes("cloudHostAuditLog") || contextJs.includes("cloudHostAuditLog")) {
    throw new Error("Creator runtime must not retain canonical Host audit state");
  }
  if (!readSource("host/src/runtime/data.js").includes("cloudHostAuditLog")) {
    throw new Error("canonical Host runtime must own audit state");
  }
  return "Creator and canonical Host runtime state are separated";
});

await check("checkpoint-wired", async () => {
  const archive = readSource("src/views/archive.js");
  for (const token of ["openCreateCheckpointModal", "openCheckpointDetail", "openRestoreCheckpointModal", "cloudCheckpoints", "create-checkpoint", "restore-checkpoint", "data-restore-scope", "restore-target-room", "checkpointRestoreHistoryRows", "恢复历史"]) {
    if (!archive.includes(token)) throw new Error(`archive view missing checkpoint token ${token}`);
  }
  const apiBundle = readApiBundle();
  for (const method of ["getCheckpoints", "createCheckpoint", "getCheckpoint", "getCheckpointRestores", "restoreCheckpoint"]) {
    if (!apiHasMethod(apiBundle, method)) throw new Error(`api bundle missing ${method}`);
  }
  const userMsg = readSource("src/utils/user-messages.js");
  if (!userMsg.includes("RESTORE_SCOPE_OPTIONS")) throw new Error("user-messages missing RESTORE_SCOPE_OPTIONS");
  if (archive.includes("readingProgress")) throw new Error("archive must not expose raw scope keys in UI");
  const css = readSource("styles.css");
  if (!css.includes(".restore-scope-list")) throw new Error("styles missing restore-scope-list");
  const roomJs = readSource("src/runtime/room-events.js");
  if (!roomJs.includes("room.checkpoint_restored")) throw new Error("SSE handler missing room.checkpoint_restored");
  return "checkpoint create/detail/restore UI + API wired";
});

await check("world-audit-wired", async () => {
  const settings = readSource("src/views/settings.js");
  const actionsJs = readSource("src/runtime/actions.js");
  const apiBundle = readApiBundle();
  for (const token of ["world-audit", "openWorldAuditModal", "getWorldHostAuditLog", "世界主持审计"]) {
    const bundle = `${settings}${actionsJs}${apiBundle}`;
    if (!bundle.includes(token)) throw new Error(`world audit wiring missing ${token}`);
  }
  return "world-level host audit in settings wired";
});

await check("settings-world-patch-wired", async () => {
  const settings = readSource("src/views/settings.js");
  for (const token of ["save-world-settings", "save-room-settings", "settings-host-voice-listen", "hostVoiceListen"]) {
    if (!settings.includes(token)) throw new Error(`settings view missing ${token}`);
  }
  const apiBundle = readApiBundle();
  for (const method of ["getWorld", "patchWorld", "patchRoomSettings"]) {
    if (!apiHasMethod(apiBundle, method)) throw new Error(`api bundle missing ${method}`);
  }
  return "world + room settings PATCH wired";
});

await check("rules-preview-wired", async () => {
  const hostRules = readSource("host/src/runtime/host-rules-controller.js");
  for (const token of ["directorRulesPreview", "refreshRulesPreview", "triggerManualRuleFromDirector", "rule-manual-trigger"]) {
    const hostBundle = `${hostRules}${readSource("host/src/runtime/director-actions.js")}`;
    if (!hostBundle.includes(token)) throw new Error(`canonical Host rules preview missing token ${token}`);
  }
  const apiBundle = readSource("host/src/api.js");
  for (const method of ["previewRoomRules", "triggerManualRule"]) {
    if (!apiHasMethod(apiBundle, method)) throw new Error(`Host API missing ${method}`);
  }
  const userMsg = readSource("host/src/utils/format.js");
  if (!userMsg.includes("rulePreviewStatusLabel")) throw new Error("user-messages missing rulePreviewStatusLabel");
  return "canonical Host rules preview + manual trigger wired";
});

await check("assets-filter-wired", async () => {
  const assets = readSource("src/views/assets.js");
  for (const token of ["assetKindFilter", "assetSearchQuery", "assetShowRecycle", "asset-filter", "asset-recycle-toggle", "restore-asset", "toggleAssetRecycle", "restoreCloudAsset"]) {
    if (!assets.includes(token)) throw new Error(`assets view missing filter token ${token}`);
  }
  const apiBundle = readApiBundle();
  if (!apiHasMethod(apiBundle, "getAssets")) throw new Error("api bundle missing getAssets");
  if (!apiHasMethod(apiBundle, "restoreAsset")) throw new Error("api bundle missing restoreAsset");
  return "assets kind/search/recycle filter wired";
});

await check("friendly-api-errors-wired", async () => {
  const apiBundle = readApiBundle();
  const userMsg = readSource("src/utils/user-messages.js");
  // friendlyApiError is imported into client.js from user-messages.js and used in request() error paths.
  if (!apiBundle.includes("friendlyApiError")) throw new Error("api bundle must use friendlyApiError");
  if (!userMsg.includes("CHECKPOINT_WORLD_MISMATCH")) throw new Error("user-messages must map CHECKPOINT_WORLD_MISMATCH");
  if (!apiBundle.includes("idempotency-key")) throw new Error("idempotent writes must send idempotency-key header");
  // Last-Event-ID SSE cursor now lives in src/api/room.js (streamRoomEvents).
  if (!apiBundle.includes("Last-Event-ID")) throw new Error("api bundle must support Last-Event-ID SSE cursor");
  return "friendly errors + transparent idempotency/SSE cursor";
});

await check("inventory-wired", async () => {
  const studio = readSource("src/views/studio.js");
  const player = readSource("src/views/player.js");
  const roomJs = readSource("src/runtime/room-events.js");
  for (const token of ["openStudioItem", "studio-add-item", "requiredItemId"]) {
    if (!studio.includes(token)) throw new Error(`studio view missing inventory token ${token}`);
  }
  for (const token of ["inventoryRows", "hasRequiredItem", "inventory-card"]) {
    if (!player.includes(token)) throw new Error(`player view missing inventory token ${token}`);
  }
  if (!readSource("host/src/views/host-layout.js").includes("host-manual-grant-item")) {
    throw new Error("canonical Host console missing host grant item");
  }
  if (!roomJs.includes("room.item_granted")) throw new Error("SSE handler missing room.item_granted");
  const apiBundle = readApiBundle();
  for (const method of ["createItem", "updateItem", "deleteItem", "hostGrantItem"]) {
    if (!apiHasMethod(apiBundle, method)) throw new Error(`api bundle missing ${method}`);
  }
  return "items/inventory UI + API wired";
});

await check("livekit-voice-wired", async () => {
  const player = readSource("src/views/player.js");
  const livekit = readSource("src/runtime/livekit-voice.js");
  for (const token of ["voice-live-connect", "voice-live-disconnect", "voiceMicEnabled", "getVoiceRoomToken"]) {
    const bundle = `${player}${livekit}`;
    if (!bundle.includes(token)) throw new Error(`livekit voice missing token ${token}`);
  }
  for (const key of ["voiceLiveStatus", "voiceParticipants"]) {
    if (!readSource("src/state/voice-store.js").includes(key)) throw new Error(`voice-store missing ${key}`);
  }
  const apiBundle = readApiBundle();
  if (!apiHasMethod(apiBundle, "getVoiceRoomToken")) throw new Error("api bundle missing getVoiceRoomToken");
  return "LiveKit voice client wired";
});

await check("recap-wired", async () => {
  const archive = readSource("src/views/archive.js");
  const dataJs = readSource("src/runtime/data.js");
  for (const token of ["openCreateRecapModal", "openRecapDetail", "recapDetailView", "create-recap", "recap-detail"]) {
    if (!archive.includes(token)) throw new Error(`archive view missing recap token ${token}`);
  }
  if (!readSource("host/src/runtime/host-archive-controller.js").includes("create-recap")) {
    throw new Error("canonical Host console missing create-recap action");
  }
  for (const key of ["cloudRecaps", "cloudRecapLatest", "cloudRecapDetail"]) {
    if (!readSource("src/state/room-store.js").includes(key)) throw new Error(`room-store missing ${key}`);
  }
  if (!dataJs.includes("getRecaps")) throw new Error("loadCloudData must fetch recaps");
  const apiBundle = readApiBundle();
  for (const method of ["getRecaps", "getRecap", "getLatestRecap", "createRecap"]) {
    if (!apiHasMethod(apiBundle, method)) throw new Error(`api bundle missing ${method}`);
  }
  const css = readSource("styles.css");
  if (!css.includes(".recap-section")) throw new Error("styles missing recap-section");
  return "room recap UI + API wired";
});

await check("runtime-bridge-direct", async () => {
  const appJs = readSource("app.js");
  const domJs = readSource("src/dom.js");
  const dataJs = readSource("src/runtime/data.js");
  const authJs = readSource("src/runtime/auth-world.js");
  const facadeJs = readSource("src/runtime/runtime-facade.js");
  if (domJs.includes("window.zhimuRender")) throw new Error("dom.js still defines zhimuRender hack");
  if (domJs.includes("window.zhimuLoadCloudData")) throw new Error("dom.js still defines zhimuLoadCloudData hack");
  if (domJs.includes("window.zhimuHandle")) throw new Error("dom.js still defines zhimuHandle hack");
  if (domJs.includes("window.zhimuDom")) throw new Error("dom.js still exposes zhimuDom bridge");
  if (appJs.includes("window.zhimuRuntime")) throw new Error("app.js still reads or registers zhimuRuntime bridge");
  if (!facadeJs.includes("registerRuntime")) throw new Error("runtime facade missing registerRuntime");
  for (const [label, source] of [["data.js", dataJs], ["auth-world.js", authJs]]) {
    if (source.includes("window.zhimuRuntime = Object.assign")) throw new Error(`${label} still registers zhimuRuntime bridge`);
  }
  if (!dataJs.includes("runtime-facade.js")) throw new Error("data.js must consume runtime facade");
  if (!dataJs.includes("runtimeRender()")) throw new Error("data.js must notify render through runtime facade");
  if (!authJs.includes("runtime-facade.js")) throw new Error("auth-world.js must consume runtime facade");
  if (!authJs.includes('callRuntime("handle"')) throw new Error("auth-world.js must dispatch handle through runtime facade");
  if (!authJs.includes('callRuntime("drainPendingInviteAfterAuth"')) throw new Error("auth-world.js must drain pending invites through runtime facade");
  return "runtime bridge consumers use facade";
});

await check("world-switch-sync", async () => {
  const appJs = readSource("app.js");
  const dataJs = readSource("src/runtime/data.js");
  const authJs = readSource("src/runtime/auth-world.js");
  const workspaceJs = readSource("src/runtime/workspace-store.js");
  const contextJs = readSource("src/runtime/context-coordinator.js");
  if (!appJs.includes("syncWorldSwitcher")) throw new Error("syncWorldSwitcher missing from app.js");
  if (!dataJs.includes("ensureActiveWorld")) throw new Error("ensureActiveWorld missing from data.js");
  if (!workspaceJs.includes("ensureActiveWorld")) throw new Error("ensureActiveWorld missing from workspace-store.js");
  if (!contextJs.includes("resetAccountContext")) throw new Error("resetAccountContext missing from context-coordinator.js");
  if (!authJs.includes("zhimuContext")) throw new Error("auth-world.js must use zhimuContext coordinator");
  if (!authJs.includes("正在加载…")) throw new Error("world library loading state missing");
  return "world switcher + active world validation wired";
});

await check("cloud-load-staged", async () => {
  const dataJs = readSource("src/runtime/data.js");
  if (dataJs.includes("loadCloudData();")) throw new Error("data.js must not auto-call loadCloudData on import");
  if (!dataJs.includes("loadCloudDataInternal")) throw new Error("staged loadCloudData missing");
  if (!readSource("src/state/studio-store.js").includes("cloudLoading")) throw new Error("cloudLoading flag missing from studio-store");
  return "staged cloud load wired";
});

await check("content-package-p1-4-wired", async () => {
  const apiBundle = readApiBundle();
    const writer = [
      readSource("src/views/writer.js"),
      readSource("src/views/writer-package-workspace.js"),
      readSource("src/views/writer-transfer-files.js")
    ].join("\n");
  for (const token of ["getContentPackageSummary", "previewContentPackageImport", "importContentPackageAsNewWorld"]) {
    if (!apiBundle.includes(token)) throw new Error(`${token} missing from api bundle`);
  }
  for (const token of ["contentPackageSummaryHtml", "contentPackagePreviewHtml", "openCreatorExport", "生成导入预览", "创建新世界并导入"]) {
    if (!writer.includes(token)) throw new Error(`${token} missing from writer view`);
  }
  return "content package summary/preview/import modes wired";
});

await check("app-bootstrap-thin", async () => {
  const appJs = readSource("app.js");
  const lines = appJs.split("\n").filter((line) => line.trim() && !line.trim().startsWith("//")).length;
  if (lines > 140) throw new Error(`app.js still too large (${lines} non-empty lines)`);
  if (!appJs.includes("function render") || !appJs.includes("function go")) throw new Error("app.js must own render/go bootstrap");
  return `app.js bootstrap ${lines} lines`;
});

await check("pm-onboarding-session-mode", async () => {
  const sessionMode = readSource("src/runtime/session-mode.js");
  const onboarding = readSource("src/components/onboarding-strip.js");
  const authSession = readSource("src/runtime/auth-session.js");
  const indexHtml = readSource("index.html");
  const rules = readSource("src/views/rules.js");
  if (!sessionMode.includes("demo_browse") || !sessionMode.includes("sessionStripHtml")) {
    throw new Error("session-mode missing demo_browse labels");
  }
  if (!authSession.includes("zhimuSessionMode")) throw new Error("auth-session must use zhimuSessionMode");
  if (!onboarding.includes("renderOnboardingStrip") || !onboarding.includes("dismiss")) {
    throw new Error("onboarding strip incomplete");
  }
  if (!indexHtml.includes("nav-advanced") || !indexHtml.includes("data-session-pill")) {
    throw new Error("index.html missing nav-advanced or session banner markup");
  }
  if (!rules.includes("rule-seed-examples") || !rules.includes("seedExampleRules")) {
    throw new Error("rules view missing example seed action");
  }
  const guide = readSource("docs/CREATOR_GUIDE.md");
  if (!guide.includes("首次 3 分钟体验")) throw new Error("CREATOR_GUIDE missing 3-min path");
  return "PM P0: session mode + onboarding + empty templates wired";
});

await check("beta-free-no-payment-copy", async () => {
  const messages = readSource("src/utils/user-messages.js");
  const quota = readSource("src/runtime/account-quota.js");
  if (messages.includes("升级套餐")) throw new Error("user-messages still mentions paid upgrade");
  if (!messages.includes("support@getzhimu.com")) throw new Error("quota messages missing beta support contact");
  if (!quota.includes("暂无订阅或充值入口")) throw new Error("account-quota missing beta free note");
  const betaScope = readSource("docs/BETA_SCOPE_ZH.md");
  if (!betaScope.includes("无付费入口")) throw new Error("BETA_SCOPE_ZH missing");
  return "beta free copy + scope doc present";
});

await check("ops-hardening-wired", async () => {
  const uploadScan = readSource("backend/src/upload-scan.js");
  const builtin = readSource("backend/src/upload-scan-builtin.js");
  const alerts = readSource("backend/src/ops-alert-bridge.js");
  const outage = readSource("src/components/service-outage.js");
  if (!uploadScan.includes("builtin") || !uploadScan.includes("getUploadScanStatus")) {
    throw new Error("upload-scan modes incomplete");
  }
  if (!builtin.includes("UPLOAD_SCAN_SPOOFED")) throw new Error("builtin scan missing spoof detection");
  if (!alerts.includes("ALERT_WEBHOOK_URL")) throw new Error("ops alert bridge missing");
  if (!outage.includes("renderServiceOutage")) throw new Error("service outage UI missing");
  if (!fs.existsSync(path.join(sourceRoot, "error-pages", "503.html"))) {
    throw new Error("error-pages/503.html missing");
  }
  return "upload scan + error pages + alert bridge wired";
});

await check("backend-health-reachable", async () => {
  const response = await fetch(`${API}/health`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(`health check failed: ${response.status}`);
  return "backend /api/health ok";
});

await check("frontend-api-proxy", async () => {
  const response = await fetch(`${FRONTEND}/api/health`);
  const contentType = response.headers.get("content-type") || "";
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok || !/json/i.test(contentType)) {
    throw new Error(`same-origin /api proxy failed: ${response.status} ${contentType || "no content type"}`);
  }
  return "frontend same-origin /api returns backend JSON";
});

await check("frontend-api-config", async () => {
  const config = readSource("config.js");
  if (!config.includes("zhimuConfig")) throw new Error("zhimuConfig missing");
  if (!config.includes("apiBase")) throw new Error("apiBase missing");
  if (!config.includes("4180") && !config.includes("VITE_API_BASE")) {
    throw new Error("config must default local api or read VITE_API_BASE");
  }
  return "zhimuConfig apiBase wired";
});

await check("xss-escapeHtml-used", async () => {
  const formatJs = readSource("src/utils/format.js");
  const securityJs = readSource("shared/security.js");
  const sources = await fetchFrontendSources();
  const bundle = Object.values(sources).join("\n");
  const innerHtmlCount = (bundle.match(/innerHTML/g) || []).length;
  const escapeCount = (bundle.match(/escapeHtml\(/g) || []).length;
  // escapeHtml canonical home moved to shared/security.js; format.js re-exports it.
  if (!securityJs.includes("function escapeHtml")) throw new Error("escapeHtml helper missing in shared/security.js");
  if (!formatJs.includes("escapeHtml")) throw new Error("format.js must re-export escapeHtml");
  if (escapeCount < 10) throw new Error(`only ${escapeCount} escapeHtml calls — XSS risk`);
  return `innerHTML×${innerHtmlCount}, escapeHtml×${escapeCount}`;
});

const failed = results.filter((r) => !r.ok);
console.log("");
console.log(`UI smoke: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error("Failed checks:", failed.map((f) => f.name).join(", "));
  process.exitCode = 1;
}
