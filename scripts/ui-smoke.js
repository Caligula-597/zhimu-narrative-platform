/**
 * Static UI smoke check — verifies frontend shell, assets, API wiring, and P0-1 data-honesty invariants.
 * Run with frontend (4173) and optionally backend (4180) already up.
 */
const FRONTEND = process.env.UI_BASE_URL || "http://localhost:4173";
const API = process.env.UI_API_BASE || "http://localhost:4180/api";

const requiredModuleScripts = [
  "config.js",
  "src/dom.js",
  "src/state.js",
  "src/api/client.js",
  "rule-visual.js",
  "src/utils/format.js",
  "src/components/emptyState.js",
  "src/components/toast.js",
  "src/components/modal.js",
  "src/views/overview.js",
  "src/views/writer.js",
  "src/views/studio.js",
  "src/views/assets.js",
  "src/views/rules.js",
  "src/views/director.js",
  "src/views/player.js",
  "src/views/archive.js",
  "src/views/settings.js",
  "src/runtime/wizard.js",
  "src/runtime/auth-world.js",
  "src/runtime/livekit-voice.js",
  "src/runtime/data.js",
  "src/runtime/actions.js",
  "app.js"
];
const requiredNavViews = ["overview", "writer", "studio", "assets", "rules", "director", "player", "archive", "settings"];
const requiredDomIds = ["content", "toast", "modal-backdrop", "modal", "page-title", "create-world-btn", "preview-btn", "run-btn"];
const requiredApiMethods = [
  "getWorlds", "getStudio", "getPlayerHome", "getHostProgress", "getHostPlayers", "joinRoom", "getRoomInvite",
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
  const chunks = await Promise.all(requiredModuleScripts.map((script) => fetchText(`${FRONTEND}/${script}`)));
  return Object.fromEntries(requiredModuleScripts.map((script, index) => [script, chunks[index]]));
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
  const css = await fetchText(`${FRONTEND}/styles.css`);
  if (css.length < 1000) throw new Error("styles.css suspiciously small");
  for (const sel of [".app-shell", ".sidebar", ".main-area", ".modal", ".toast"]) {
    if (!css.includes(sel)) throw new Error(`missing CSS selector ${sel}`);
  }
  return `${Math.round(css.length / 1024)}KB stylesheet`;
});

for (const script of ["app.js", "src/api/client.js", "src/state.js"]) {
  await check(`script-${script.replace(/\//g, "-")}`, async () => {
    const js = await fetchText(`${FRONTEND}/${script}`);
    if (js.length < 50) throw new Error("file too small");
    return `${Math.round(js.length / 1024)}KB`;
  });
}

await check("script-load-order", async () => {
  const html = await fetchText(`${FRONTEND}/`);
  const indices = requiredModuleScripts.map((s) => html.indexOf(`./${s}`));
  if (indices.some((i) => i < 0)) throw new Error("not all module scripts referenced in index.html");
  for (let i = 1; i < indices.length; i += 1) {
    if (indices[i] <= indices[i - 1]) throw new Error("module scripts must load in dependency order ending with app.js");
  }
  return "config → src modules → app.js";
});

await check("nav-views-match-app", async () => {
  const html = await fetchText(`${FRONTEND}/`);
  const appJs = await fetchText(`${FRONTEND}/app.js`);
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
  const js = await fetchText(`${FRONTEND}/src/api/client.js`);
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
  const js = await fetchText(`${FRONTEND}/src/state.js`);
  if (!js.includes("window.zhimuState")) throw new Error("zhimuState not defined");
  for (const key of ["cloudStudio", "cloudPlayer", "cloudHost", "cloudHostPlayers", "cloudHostStuckCount", "cloudCheckpoints", "cloudRecaps", "cloudRecapLatest", "cloudWorldLogs", "voiceRoomId", "voiceLiveStatus"]) {
    if (!js.includes(key)) throw new Error(`state missing ${key}`);
  }
  for (const removed of ["players:", "logs:", "demoStep:"]) {
    if (js.includes(removed)) throw new Error(`state still has demo runtime field ${removed}`);
  }
  const dataJs = await fetchText(`${FRONTEND}/src/runtime/data.js`);
  if (!dataJs.includes("clearRuntimeState")) throw new Error("clearRuntimeState not in runtime/data.js");
  if (!dataJs.includes("loadCloudData")) throw new Error("loadCloudData not in runtime/data.js");
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
  const overview = await fetchText(`${FRONTEND}/src/views/overview.js`);
  const dataJs = await fetchText(`${FRONTEND}/src/runtime/data.js`);
  if (!dataJs.includes("getWorldLogs")) throw new Error("loadCloudData must fetch getWorldLogs");
  if (!overview.includes("cloudWorldLogs")) throw new Error("overview must use cloudWorldLogs");
  return "world logs wired for overview";
});

await check("host-console-wired", async () => {
  const director = await fetchText(`${FRONTEND}/src/views/director.js`);
  for (const token of ["hostPlayerTableRows", "openHostPlayerDetail", "host-runtime-table", "hostClueMatrixCard"]) {
    if (!director.includes(token)) throw new Error(`director view missing host console token ${token}`);
  }
  const css = await fetchText(`${FRONTEND}/styles.css`);
  if (!css.includes(".host-runtime-table")) throw new Error("styles missing host-runtime-table");
  return "host console UI + styles present";
});

await check("studio-node-edit-wired", async () => {
  const studio = await fetchText(`${FRONTEND}/src/views/studio.js`);
  for (const token of ["studioNodeEditPanel", "studio-save-node", "saveSelectedStudioNode"]) {
    if (!studio.includes(token)) throw new Error(`studio view missing token ${token}`);
  }
  const apiJs = await fetchText(`${FRONTEND}/src/api/client.js`);
  for (const method of ["updateScene", "updateClue", "updateInvestigationPoint", "getStudioNodeReferences"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
  }
  const css = await fetchText(`${FRONTEND}/styles.css`);
  if (!css.includes(".studio-edit-panel")) throw new Error("styles missing studio-edit-panel");
  return "studio node edit panel wired";
});

await check("clue-sharing-wired", async () => {
  const player = await fetchText(`${FRONTEND}/src/views/player.js`);
  const director = await fetchText(`${FRONTEND}/src/views/director.js`);
  for (const token of ["shareCloudClue", "sharedClueSection"]) {
    if (!player.includes(token)) throw new Error(`player view missing clue-sharing token ${token}`);
  }
  if (!director.includes("hostClueMatrixCard")) throw new Error("director view missing hostClueMatrixCard");
  const apiJs = await fetchText(`${FRONTEND}/src/api/client.js`);
  for (const method of ["shareClueToRoom", "updateCluePlayerNote", "getHostClueMatrix"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
  }
  return "clue sharing wired";
});

await check("rule-visual-wired", async () => {
  const rules = await fetchText(`${FRONTEND}/src/views/rules.js`);
  const ruleJs = await fetchText(`${FRONTEND}/rule-visual.js`);
  for (const token of ["openRuleEditor", "data-rule-tab", "validateRuleBody"]) {
    if (!rules.includes(token)) throw new Error(`rules view missing rule visual token ${token}`);
  }
  if (!ruleJs.includes("visualToRuleJson")) throw new Error("rule-visual.js missing visualToRuleJson");
  const apiJs = await fetchText(`${FRONTEND}/src/api/client.js`);
  if (!apiJs.includes("validateRuleBody")) throw new Error("api-client missing validateRuleBody");
  return "rule visual editor wired";
});

await check("room-events-wired", async () => {
  const dataJs = await fetchText(`${FRONTEND}/src/runtime/data.js`);
  for (const token of ["connectRoomEventStream", "handleRoomEvent", "roomEventsConnected"]) {
    if (!dataJs.includes(token)) throw new Error(`runtime/data.js missing room-events token ${token}`);
  }
  const apiJs = await fetchText(`${FRONTEND}/src/api/client.js`);
  if (!apiJs.includes("streamRoomEvents")) throw new Error("api-client missing streamRoomEvents");
  return "SSE room events wired";
});

await check("refresh-notify-wired", async () => {
  const dataJs = await fetchText(`${FRONTEND}/src/runtime/data.js`);
  const toastJs = await fetchText(`${FRONTEND}/src/components/toast.js`);
  const director = await fetchText(`${FRONTEND}/src/views/director.js`);
  for (const token of ["refreshHostRoom", "refreshHostEvents", "syncDirectorPolling"]) {
    if (!dataJs.includes(token)) throw new Error(`runtime/data.js missing refresh token ${token}`);
  }
  for (const token of ["updateNotifyBadge", "pendingHostEventCount"]) {
    if (!toastJs.includes(token)) throw new Error(`toast.js missing ${token}`);
  }
  if (!director.includes("refresh-host-room")) throw new Error("director refresh buttons missing");
  return "refresh + notify polling wired";
});

await check("checkpoint-wired", async () => {
  const archive = await fetchText(`${FRONTEND}/src/views/archive.js`);
  for (const token of ["openCreateCheckpointModal", "openCheckpointDetail", "cloudCheckpoints", "create-checkpoint"]) {
    if (!archive.includes(token)) throw new Error(`archive view missing checkpoint token ${token}`);
  }
  const apiJs = await fetchText(`${FRONTEND}/src/api/client.js`);
  for (const method of ["getCheckpoints", "createCheckpoint", "getCheckpoint"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
  }
  return "room checkpoint UI wired";
});

await check("inventory-wired", async () => {
  const studio = await fetchText(`${FRONTEND}/src/views/studio.js`);
  const player = await fetchText(`${FRONTEND}/src/views/player.js`);
  const director = await fetchText(`${FRONTEND}/src/views/director.js`);
  const dataJs = await fetchText(`${FRONTEND}/src/runtime/data.js`);
  for (const token of ["openStudioItem", "studio-add-item", "requiredItemId"]) {
    if (!studio.includes(token)) throw new Error(`studio view missing inventory token ${token}`);
  }
  for (const token of ["inventoryRows", "hasRequiredItem", "inventory-card"]) {
    if (!player.includes(token)) throw new Error(`player view missing inventory token ${token}`);
  }
  if (!director.includes("host-manual-grant-item")) throw new Error("director missing host grant item");
  if (!dataJs.includes("room.item_granted")) throw new Error("SSE handler missing room.item_granted");
  const apiJs = await fetchText(`${FRONTEND}/src/api/client.js`);
  for (const method of ["createItem", "updateItem", "deleteItem", "hostGrantItem"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
  }
  return "items/inventory UI + API wired";
});

await check("livekit-voice-wired", async () => {
  const player = await fetchText(`${FRONTEND}/src/views/player.js`);
  const livekit = await fetchText(`${FRONTEND}/src/runtime/livekit-voice.js`);
  const stateJs = await fetchText(`${FRONTEND}/src/state.js`);
  for (const token of ["voice-live-connect", "voice-live-disconnect", "voiceMicEnabled", "getVoiceRoomToken"]) {
    const bundle = `${player}${livekit}`;
    if (!bundle.includes(token)) throw new Error(`livekit voice missing token ${token}`);
  }
  for (const key of ["voiceLiveStatus", "voiceParticipants"]) {
    if (!stateJs.includes(key)) throw new Error(`state missing ${key}`);
  }
  const apiJs = await fetchText(`${FRONTEND}/src/api/client.js`);
  if (!apiJs.includes("getVoiceRoomToken")) throw new Error("api-client missing getVoiceRoomToken");
  return "LiveKit voice client wired";
});

await check("recap-wired", async () => {
  const archive = await fetchText(`${FRONTEND}/src/views/archive.js`);
  const director = await fetchText(`${FRONTEND}/src/views/director.js`);
  const dataJs = await fetchText(`${FRONTEND}/src/runtime/data.js`);
  const stateJs = await fetchText(`${FRONTEND}/src/state.js`);
  for (const token of ["openCreateRecapModal", "openRecapDetail", "recapDetailView", "create-recap", "recap-detail"]) {
    if (!archive.includes(token)) throw new Error(`archive view missing recap token ${token}`);
  }
  if (!director.includes("create-recap")) throw new Error("director missing create-recap action");
  for (const key of ["cloudRecaps", "cloudRecapLatest", "cloudRecapDetail"]) {
    if (!stateJs.includes(key)) throw new Error(`state missing ${key}`);
  }
  if (!dataJs.includes("getRecaps")) throw new Error("loadCloudData must fetch recaps");
  const apiJs = await fetchText(`${FRONTEND}/src/api/client.js`);
  for (const method of ["getRecaps", "getRecap", "getLatestRecap", "createRecap"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
  }
  const css = await fetchText(`${FRONTEND}/styles.css`);
  if (!css.includes(".recap-section")) throw new Error("styles missing recap-section");
  return "room recap UI + API wired";
});

await check("deferred-render", async () => {
  const domJs = await fetchText(`${FRONTEND}/src/dom.js`);
  const dataJs = await fetchText(`${FRONTEND}/src/runtime/data.js`);
  const authJs = await fetchText(`${FRONTEND}/src/runtime/auth-world.js`);
  if (!domJs.includes("window.zhimuRender")) throw new Error("zhimuRender helper missing from dom.js");
  if (!domJs.includes("window.zhimuLoadCloudData")) throw new Error("zhimuLoadCloudData helper missing from dom.js");
  if (!domJs.includes("window.zhimuHandle")) throw new Error("zhimuHandle helper missing from dom.js");
  if (dataJs.includes("const render = R.render")) throw new Error("data.js still captures stale render reference");
  if (authJs.includes("const loadCloudData = R.loadCloudData")) throw new Error("auth-world.js still captures stale loadCloudData");
  if (authJs.includes("const handle = R.handle")) throw new Error("auth-world.js still captures stale handle");
  return "deferred runtime bridge wired";
});

await check("world-switch-sync", async () => {
  const appJs = await fetchText(`${FRONTEND}/app.js`);
  const dataJs = await fetchText(`${FRONTEND}/src/runtime/data.js`);
  const authJs = await fetchText(`${FRONTEND}/src/runtime/auth-world.js`);
  if (!appJs.includes("syncWorldSwitcher")) throw new Error("syncWorldSwitcher missing from app.js");
  if (!dataJs.includes("ensureActiveWorld")) throw new Error("ensureActiveWorld missing from data.js");
  if (!authJs.includes("正在读取你的剧本列表")) throw new Error("world library loading state missing");
  return "world switcher + active world validation wired";
});

await check("cloud-load-staged", async () => {
  const dataJs = await fetchText(`${FRONTEND}/src/runtime/data.js`);
  const stateJs = await fetchText(`${FRONTEND}/src/state.js`);
  if (dataJs.includes("loadCloudData();")) throw new Error("data.js must not auto-call loadCloudData on import");
  if (!dataJs.includes("loadCloudDataInternal")) throw new Error("staged loadCloudData missing");
  if (!stateJs.includes("cloudLoading")) throw new Error("cloudLoading flag missing from state");
  return "staged cloud load wired";
});

await check("content-package-p1-4-wired", async () => {
  const client = await fetchText(`${FRONTEND}/src/api/client.js`);
  const writer = await fetchText(`${FRONTEND}/src/views/writer.js`);
  for (const token of ["getContentPackageSummary", "previewContentPackageImport", "importContentPackageAsNewWorld"]) {
    if (!client.includes(token)) throw new Error(`${token} missing from api client`);
  }
  for (const token of ["contentPackageSummaryHtml", "contentPackagePreviewHtml", "openCreatorExport", "解析预览", "创建新世界并导入"]) {
    if (!writer.includes(token)) throw new Error(`${token} missing from writer view`);
  }
  return "content package summary/preview/import modes wired";
});

await check("app-bootstrap-thin", async () => {
  const appJs = await fetchText(`${FRONTEND}/app.js`);
  const lines = appJs.split("\n").filter((line) => line.trim() && !line.trim().startsWith("//")).length;
  if (lines > 120) throw new Error(`app.js still too large (${lines} non-empty lines)`);
  if (!appJs.includes("function render") || !appJs.includes("function go")) throw new Error("app.js must own render/go bootstrap");
  return `app.js bootstrap ${lines} lines`;
});

await check("backend-health-reachable", async () => {
  const response = await fetch(`${API}/health`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(`health check failed: ${response.status}`);
  return "backend /api/health ok";
});

await check("frontend-api-config", async () => {
  const config = await fetchText(`${FRONTEND}/config.js`);
  if (!config.includes("zhimuConfig")) throw new Error("zhimuConfig missing");
  if (!config.includes("apiBase")) throw new Error("apiBase missing");
  if (!config.includes("4180")) throw new Error("local dev should default to port 4180");
  return "local apiBase → :4180";
});

await check("xss-escapeHtml-used", async () => {
  const formatJs = await fetchText(`${FRONTEND}/src/utils/format.js`);
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
