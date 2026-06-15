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

const requiredModuleScripts = [
  "config.js",
  "src/dom.js",
  "src/state.js",
  "src/utils/user-messages.js",
  "src/api/client.js",
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
  "src/views/director.js",
  "src/views/player.js",
  "src/views/archive.js",
  "src/views/settings.js",
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
const requiredNavViews = ["overview", "writer", "studio", "clues", "assets", "rules", "director", "player", "archive", "settings"];
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

for (const script of ["app.js", "src/api/client.js", "src/state.js"]) {
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
  const appJs = readSource("app.js");
  const navViews = [...html.matchAll(/data-view="([^"]+)"/g)].map((m) => m[1]);
  const uniqueNav = [...new Set(navViews)];
  for (const view of requiredNavViews) {
    if (!uniqueNav.includes(view)) throw new Error(`nav missing data-view="${view}"`);
  }
  const viewsMatch = appJs.match(/const views = \{([^}]+)\}/);
  if (!viewsMatch) throw new Error("views map not found in app.js");
  for (const view of requiredNavViews) {
    if (!viewsMatch[0].includes(view)) throw new Error(`app.js views map missing ${view}`);
  }
  if (!appJs.includes("V.overview.overview") || !appJs.includes("V.studio.studioCloud")) {
    throw new Error("app.js must delegate to src/views modules");
  }
  return `${uniqueNav.length} nav views wired`;
});

await check("api-client-surface", async () => {
  const js = readSource("src/api/client.js");
  if (!js.includes("window.zhimuApi")) throw new Error("zhimuApi not exported");
  if (!js.includes("Bearer")) throw new Error("session Bearer auth not present");
  for (const method of requiredApiMethods) {
    if (!js.includes(`${method}:`) && !js.includes(`${method}(`)) {
      throw new Error(`api-client missing ${method}`);
    }
  }
  return `${requiredApiMethods.length} core API methods declared`;
});

await check("state-runtime-boundaries", async () => {
  const js = readSource("src/state.js");
  if (!js.includes("window.zhimuState")) throw new Error("zhimuState not defined");
  for (const key of ["cloudStudio", "cloudPlayer", "cloudHost", "cloudHostPlayers", "cloudHostStuckCount", "cloudHostAuditLog", "cloudCheckpoints", "cloudRecaps", "cloudRecapLatest", "cloudWorldLogs", "voiceRoomId", "voiceLiveStatus"]) {
    if (!js.includes(key)) throw new Error(`state missing ${key}`);
  }
  for (const removed of ["players:", "logs:", "demoStep:"]) {
    if (js.includes(removed)) throw new Error(`state still has demo runtime field ${removed}`);
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
  const director = readSource("src/views/director.js");
  for (const token of ["hostPlayerTableRows", "openHostPlayerDetail", "host-runtime-table", "hostClueMatrixCard"]) {
    if (!director.includes(token)) throw new Error(`director view missing host console token ${token}`);
  }
  const css = readSource("styles.css");
  if (!css.includes(".host-runtime-table")) throw new Error("styles missing host-runtime-table");
  return "host console UI + styles present";
});

await check("studio-node-edit-wired", async () => {
  const studio = readSource("src/views/studio.js");
  for (const token of ["studioNodeEditPanel", "studio-save-node", "saveSelectedStudioNode"]) {
    if (!studio.includes(token)) throw new Error(`studio view missing token ${token}`);
  }
  const apiJs = readSource("src/api/client.js");
  for (const method of ["updateScene", "updateClue", "updateInvestigationPoint", "getStudioNodeReferences"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
  }
  const css = readSource("styles.css");
  if (!css.includes(".studio-edit-panel")) throw new Error("styles missing studio-edit-panel");
  return "studio node edit panel wired";
});

await check("clue-sharing-wired", async () => {
  const player = readSource("src/views/player.js");
  const director = readSource("src/views/director.js");
  for (const token of ["shareCloudClue", "sharedClueSection"]) {
    if (!player.includes(token)) throw new Error(`player view missing clue-sharing token ${token}`);
  }
  if (!director.includes("hostClueMatrixCard")) throw new Error("director view missing hostClueMatrixCard");
  const apiJs = readSource("src/api/client.js");
  for (const method of ["shareClueToRoom", "updateCluePlayerNote", "getHostClueMatrix"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
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
  const apiJs = readSource("src/api/client.js");
  if (!apiJs.includes("validateRuleBody")) throw new Error("api-client missing validateRuleBody");
  return "rule visual editor wired";
});

await check("room-events-wired", async () => {
  const dataJs = readSource("src/runtime/data.js");
  const roomJs = readSource("src/runtime/room-events.js");
  for (const token of ["connectRoomEventStream", "handleRoomEvent", "roomEventsConnected"]) {
    const bundle = `${dataJs}${roomJs}`;
    if (!bundle.includes(token)) throw new Error(`room events modules missing token ${token}`);
  }
  const apiJs = readSource("src/api/client.js");
  if (!apiJs.includes("streamRoomEvents")) throw new Error("api-client missing streamRoomEvents");
  return "SSE room events wired";
});

await check("refresh-notify-wired", async () => {
  const dataJs = readSource("src/runtime/data.js");
  const toastJs = readSource("src/components/toast.js");
  const director = readSource("src/views/director.js");
  for (const token of ["refreshHostRoom", "refreshHostEvents", "syncDirectorPolling"]) {
    if (!dataJs.includes(token)) throw new Error(`runtime/data.js missing refresh token ${token}`);
  }
  for (const token of ["updateNotifyBadge", "pendingHostEventCount"]) {
    if (!toastJs.includes(token)) throw new Error(`toast.js missing ${token}`);
  }
  if (!director.includes("refresh-host-room")) throw new Error("director refresh buttons missing");
  return "refresh + notify polling wired";
});

await check("host-audit-wired", async () => {
  const director = readSource("src/views/director.js");
  const dataJs = readSource("src/runtime/data.js");
  const actionsJs = readSource("src/runtime/actions.js");
  const formatJs = readSource("src/utils/format.js");
  for (const token of ["hostAuditCard", "host-audit-card", "refresh-host-audit", "cloudHostAuditLog"]) {
    const bundle = `${director}${dataJs}${actionsJs}`;
    if (!bundle.includes(token)) throw new Error(`host audit wiring missing ${token}`);
  }
  for (const fn of ["hostAuditActionLabel", "hostAuditDetail"]) {
    if (!formatJs.includes(fn)) throw new Error(`format.js missing ${fn}`);
  }
  const apiJs = readSource("src/api/client.js");
  if (!apiJs.includes("getHostAuditLog")) throw new Error("api-client missing getHostAuditLog");
  return "host audit UI + refresh + format helpers wired";
});

await check("clues-view-wired", async () => {
  const clues = readSource("src/views/clues.js");
  const appJs = readSource("app.js");
  for (const token of ["cluesSearchQuery", "cluesSelectedId", "cluesBulkSelection", "clues-edit", "clues-add", "clues-delete", "clues-batch-delete", "openCluesEditor", "confirmDeleteClue"]) {
    if (!clues.includes(token)) throw new Error(`clues view missing ${token}`);
  }
  if (!appJs.includes("V.clues.clues")) throw new Error("app.js must register clues view");
  return "standalone clues management view wired";
});

await check("clue-share-roles-wired", async () => {
  const player = readSource("src/views/player.js");
  const apiJs = readSource("src/api/client.js");
  for (const token of ["share-clue-roles", "shareClueToRoles", "shared_with_roles", "私享线索"]) {
    const bundle = `${player}${apiJs}`;
    if (!bundle.includes(token)) throw new Error(`clue share-roles wiring missing ${token}`);
  }
  return "player private clue share UI wired";
});

await check("host-delay-wired", async () => {
  const director = readSource("src/views/director.js");
  const apiJs = readSource("src/api/client.js");
  for (const token of ["openDelayHostEventModal", "delayHostEvent", "host-event-delayed", "delay_until"]) {
    const bundle = `${director}${apiJs}`;
    if (!bundle.includes(token)) throw new Error(`host delay wiring missing ${token}`);
  }
  return "host event delay UI wired";
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

await check("runtime-state-clears-audit", async () => {
  const runtimeStoreJs = readSource("src/runtime/runtime-store.js");
  const contextJs = readSource("src/runtime/context-coordinator.js");
  if (!runtimeStoreJs.includes("cloudHostAuditLog")) throw new Error("clearRuntimeState must reset cloudHostAuditLog");
  if (!contextJs.includes("cloudHostAuditLog")) throw new Error("world switch must reset cloudHostAuditLog");
  return "audit log cleared on world/room reset";
});

await check("checkpoint-wired", async () => {
  const archive = readSource("src/views/archive.js");
  for (const token of ["openCreateCheckpointModal", "openCheckpointDetail", "openRestoreCheckpointModal", "cloudCheckpoints", "create-checkpoint", "restore-checkpoint", "data-restore-scope", "restore-target-room", "checkpointRestoreHistoryRows", "恢复历史"]) {
    if (!archive.includes(token)) throw new Error(`archive view missing checkpoint token ${token}`);
  }
  const apiJs = readSource("src/api/client.js");
  for (const method of ["getCheckpoints", "createCheckpoint", "getCheckpoint", "getCheckpointRestores", "restoreCheckpoint"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
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
  const apiJs = readSource("src/api/client.js");
  for (const token of ["world-audit", "openWorldAuditModal", "getWorldHostAuditLog", "世界主持审计"]) {
    const bundle = `${settings}${actionsJs}${apiJs}`;
    if (!bundle.includes(token)) throw new Error(`world audit wiring missing ${token}`);
  }
  return "world-level host audit in settings wired";
});

await check("settings-world-patch-wired", async () => {
  const settings = readSource("src/views/settings.js");
  for (const token of ["save-world-settings", "save-room-settings", "settings-host-voice-listen", "hostVoiceListen"]) {
    if (!settings.includes(token)) throw new Error(`settings view missing ${token}`);
  }
  const apiJs = readSource("src/api/client.js");
  for (const method of ["getWorld", "patchWorld", "patchRoomSettings"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
  }
  return "world + room settings PATCH wired";
});

await check("rules-preview-wired", async () => {
  const director = readSource("src/views/director.js");
  for (const token of ["directorRulesPreview", "refreshRulesPreview", "triggerManualRuleFromDirector", "rule-manual-trigger"]) {
    if (!director.includes(token)) throw new Error(`director view missing rules preview token ${token}`);
  }
  const apiJs = readSource("src/api/client.js");
  for (const method of ["previewRoomRules", "triggerManualRule"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
  }
  const userMsg = readSource("src/utils/user-messages.js");
  if (!userMsg.includes("rulePreviewStatusLabel")) throw new Error("user-messages missing rulePreviewStatusLabel");
  return "rules preview + manual trigger wired";
});

await check("assets-filter-wired", async () => {
  const assets = readSource("src/views/assets.js");
  for (const token of ["assetKindFilter", "assetSearchQuery", "assetShowRecycle", "asset-filter", "asset-recycle-toggle", "restore-asset", "toggleAssetRecycle", "restoreCloudAsset"]) {
    if (!assets.includes(token)) throw new Error(`assets view missing filter token ${token}`);
  }
  const apiJs = readSource("src/api/client.js");
  if (!apiJs.includes("getAssets:")) throw new Error("api-client missing getAssets with query params");
  if (!apiJs.includes("restoreAsset")) throw new Error("api-client missing restoreAsset");
  return "assets kind/search/recycle filter wired";
});

await check("friendly-api-errors-wired", async () => {
  const client = readSource("src/api/client.js");
  const userMsg = readSource("src/utils/user-messages.js");
  if (!client.includes("friendlyApiError")) throw new Error("api client must use friendlyApiError");
  if (!userMsg.includes("CHECKPOINT_WORLD_MISMATCH")) throw new Error("user-messages must map CHECKPOINT_WORLD_MISMATCH");
  if (!client.includes("idempotency-key")) throw new Error("idempotent writes must send idempotency-key header");
  if (!client.includes("Last-Event-ID")) throw new Error("SSE must support Last-Event-ID cursor");
  return "friendly errors + transparent idempotency/SSE cursor";
});

await check("inventory-wired", async () => {
  const studio = readSource("src/views/studio.js");
  const player = readSource("src/views/player.js");
  const director = readSource("src/views/director.js");
  const roomJs = readSource("src/runtime/room-events.js");
  for (const token of ["openStudioItem", "studio-add-item", "requiredItemId"]) {
    if (!studio.includes(token)) throw new Error(`studio view missing inventory token ${token}`);
  }
  for (const token of ["inventoryRows", "hasRequiredItem", "inventory-card"]) {
    if (!player.includes(token)) throw new Error(`player view missing inventory token ${token}`);
  }
  if (!director.includes("host-manual-grant-item")) throw new Error("director missing host grant item");
  if (!roomJs.includes("room.item_granted")) throw new Error("SSE handler missing room.item_granted");
  const apiJs = readSource("src/api/client.js");
  for (const method of ["createItem", "updateItem", "deleteItem", "hostGrantItem"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
  }
  return "items/inventory UI + API wired";
});

await check("livekit-voice-wired", async () => {
  const player = readSource("src/views/player.js");
  const livekit = readSource("src/runtime/livekit-voice.js");
  const stateJs = readSource("src/state.js");
  for (const token of ["voice-live-connect", "voice-live-disconnect", "voiceMicEnabled", "getVoiceRoomToken"]) {
    const bundle = `${player}${livekit}`;
    if (!bundle.includes(token)) throw new Error(`livekit voice missing token ${token}`);
  }
  for (const key of ["voiceLiveStatus", "voiceParticipants"]) {
    if (!stateJs.includes(key)) throw new Error(`state missing ${key}`);
  }
  const apiJs = readSource("src/api/client.js");
  if (!apiJs.includes("getVoiceRoomToken")) throw new Error("api-client missing getVoiceRoomToken");
  return "LiveKit voice client wired";
});

await check("recap-wired", async () => {
  const archive = readSource("src/views/archive.js");
  const director = readSource("src/views/director.js");
  const dataJs = readSource("src/runtime/data.js");
  const stateJs = readSource("src/state.js");
  for (const token of ["openCreateRecapModal", "openRecapDetail", "recapDetailView", "create-recap", "recap-detail"]) {
    if (!archive.includes(token)) throw new Error(`archive view missing recap token ${token}`);
  }
  if (!director.includes("create-recap")) throw new Error("director missing create-recap action");
  for (const key of ["cloudRecaps", "cloudRecapLatest", "cloudRecapDetail"]) {
    if (!stateJs.includes(key)) throw new Error(`state missing ${key}`);
  }
  if (!dataJs.includes("getRecaps")) throw new Error("loadCloudData must fetch recaps");
  const apiJs = readSource("src/api/client.js");
  for (const method of ["getRecaps", "getRecap", "getLatestRecap", "createRecap"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
  }
  const css = readSource("styles.css");
  if (!css.includes(".recap-section")) throw new Error("styles missing recap-section");
  return "room recap UI + API wired";
});

await check("deferred-render", async () => {
  const domJs = readSource("src/dom.js");
  const dataJs = readSource("src/runtime/data.js");
  const authJs = readSource("src/runtime/auth-world.js");
  if (!domJs.includes("window.zhimuRender")) throw new Error("zhimuRender helper missing from dom.js");
  if (!domJs.includes("window.zhimuLoadCloudData")) throw new Error("zhimuLoadCloudData helper missing from dom.js");
  if (!domJs.includes("window.zhimuHandle")) throw new Error("zhimuHandle helper missing from dom.js");
  if (dataJs.includes("const render = R.render")) throw new Error("data.js still captures stale render reference");
  if (authJs.includes("const loadCloudData = R.loadCloudData")) throw new Error("auth-world.js still captures stale loadCloudData");
  if (authJs.includes("const handle = R.handle")) throw new Error("auth-world.js still captures stale handle");
  return "deferred runtime bridge wired";
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
  const stateJs = readSource("src/state.js");
  if (dataJs.includes("loadCloudData();")) throw new Error("data.js must not auto-call loadCloudData on import");
  if (!dataJs.includes("loadCloudDataInternal")) throw new Error("staged loadCloudData missing");
  if (!stateJs.includes("cloudLoading")) throw new Error("cloudLoading flag missing from state");
  return "staged cloud load wired";
});

await check("content-package-p1-4-wired", async () => {
  const client = readSource("src/api/client.js");
  const writer = readSource("src/views/writer.js");
  for (const token of ["getContentPackageSummary", "previewContentPackageImport", "importContentPackageAsNewWorld"]) {
    if (!client.includes(token)) throw new Error(`${token} missing from api client`);
  }
  for (const token of ["contentPackageSummaryHtml", "contentPackagePreviewHtml", "openCreatorExport", "解析预览", "创建新世界并导入"]) {
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

await check("backend-health-reachable", async () => {
  const response = await fetch(`${API}/health`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(`health check failed: ${response.status}`);
  return "backend /api/health ok";
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
  const sources = await fetchFrontendSources();
  const bundle = Object.values(sources).join("\n");
  const innerHtmlCount = (bundle.match(/innerHTML/g) || []).length;
  const escapeCount = (bundle.match(/escapeHtml\(/g) || []).length;
  if (!formatJs.includes("function escapeHtml")) throw new Error("escapeHtml helper missing in format.js");
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
