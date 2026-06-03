/**
 * Static UI smoke check — verifies frontend shell, assets, API wiring, and P0-1 data-honesty invariants.
 * Run with frontend (4173) and optionally backend (4180) already up.
 */
const FRONTEND = process.env.UI_BASE_URL || "http://localhost:4173";
const API = process.env.UI_API_BASE || "http://localhost:4180/api";

const requiredScripts = ["config.js", "state.js", "api-client.js", "app.js"];
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

for (const script of requiredScripts) {
  await check(`script-${script}`, async () => {
    const js = await fetchText(`${FRONTEND}/${script}`);
    if (js.length < 50) throw new Error("file too small");
    return `${Math.round(js.length / 1024)}KB`;
  });
}

await check("script-load-order", async () => {
  const html = await fetchText(`${FRONTEND}/`);
  const indices = requiredScripts.map((s) => html.indexOf(`./${s}`));
  if (indices.some((i) => i < 0)) throw new Error("not all scripts referenced in index.html");
  for (let i = 1; i < indices.length; i += 1) {
    if (indices[i] <= indices[i - 1]) throw new Error("scripts must load config → state → api-client → app");
  }
  return "config → state → api-client → app";
});

await check("nav-views-match-app", async () => {
  const html = await fetchText(`${FRONTEND}/`);
  const appJs = await fetchText(`${FRONTEND}/app.js`);
  const navViews = [...html.matchAll(/data-view="([^"]+)"/g)].map((m) => m[1]);
  const uniqueNav = [...new Set(navViews)];
  for (const view of requiredNavViews) {
    if (!uniqueNav.includes(view)) throw new Error(`nav missing data-view="${view}"`);
    if (!appJs.includes(`views[state.view]`) && !appJs.includes(`${view}`)) {
      // views object references functions by name
    }
  }
  const viewsMatch = appJs.match(/const views = \{([^}]+)\}/);
  if (!viewsMatch) throw new Error("views map not found in app.js");
  for (const view of requiredNavViews) {
    if (!viewsMatch[0].includes(view)) throw new Error(`app.js views map missing ${view}`);
  }
  return `${uniqueNav.length} nav views wired`;
});

await check("api-client-surface", async () => {
  const js = await fetchText(`${FRONTEND}/api-client.js`);
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
  const js = await fetchText(`${FRONTEND}/state.js`);
  if (!js.includes("window.zhimuState")) throw new Error("zhimuState not defined");
  for (const key of ["cloudStudio", "cloudPlayer", "cloudHost", "cloudHostPlayers", "cloudHostStuckCount", "cloudCheckpoints", "cloudWorldLogs", "voiceRoomId"]) {
    if (!js.includes(key)) throw new Error(`state missing ${key}`);
  }
  for (const removed of ["players:", "logs:", "demoStep:"]) {
    if (js.includes(removed)) throw new Error(`state still has demo runtime field ${removed}`);
  }
  const appJs = await fetchText(`${FRONTEND}/app.js`);
  if (!appJs.includes("clearRuntimeState")) throw new Error("clearRuntimeState not in app.js");
  if (!appJs.includes("loadCloudData")) throw new Error("loadCloudData not in app.js");
  return "state + runtime cleanup present";
});

await check("no-hardcoded-assetsData", async () => {
  const appJs = await fetchText(`${FRONTEND}/app.js`);
  if (/\bassetsData\b/.test(appJs)) throw new Error("assetsData still present in app.js");
  if (appJs.includes("被撕去一页的航运录")) throw new Error("hardcoded demo asset copy still in app.js");
  return "no assetsData demo grid";
});

await check("overview-uses-world-logs", async () => {
  const appJs = await fetchText(`${FRONTEND}/app.js`);
  if (!appJs.includes("getWorldLogs")) throw new Error("loadCloudData must fetch getWorldLogs");
  if (!appJs.includes("cloudWorldLogs")) throw new Error("overview must use cloudWorldLogs");
  return "world logs wired for overview";
});

await check("host-console-wired", async () => {
  const appJs = await fetchText(`${FRONTEND}/app.js`);
  for (const token of ["getHostPlayers", "hostPlayerTableRows", "openHostPlayerDetail", "host-runtime-table", "cloudHostStuckCount"]) {
    if (!appJs.includes(token)) throw new Error(`app.js missing host console token ${token}`);
  }
  const css = await fetchText(`${FRONTEND}/styles.css`);
  if (!css.includes(".host-runtime-table")) throw new Error("styles missing host-runtime-table");
  return "host console UI + styles present";
});

await check("studio-node-edit-wired", async () => {
  const appJs = await fetchText(`${FRONTEND}/app.js`);
  for (const token of ["studioNodeEditPanel", "studio-save-node", "saveSelectedStudioNode", "getStudioNodeReferences"]) {
    if (!appJs.includes(token)) throw new Error(`app.js missing studio edit token ${token}`);
  }
  const apiJs = await fetchText(`${FRONTEND}/api-client.js`);
  for (const method of ["updateScene", "updateClue", "updateInvestigationPoint", "getStudioNodeReferences"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
  }
  const css = await fetchText(`${FRONTEND}/styles.css`);
  if (!css.includes(".studio-edit-panel")) throw new Error("styles missing studio-edit-panel");
  return "studio node edit panel wired";
});

await check("room-events-wired", async () => {
  const appJs = await fetchText(`${FRONTEND}/app.js`);
  for (const token of ["connectRoomEventStream", "handleRoomEvent", "roomEventsConnected", "streamRoomEvents"]) {
    if (!appJs.includes(token) && token !== "streamRoomEvents") throw new Error(`app.js missing room-events token ${token}`);
  }
  const apiJs = await fetchText(`${FRONTEND}/api-client.js`);
  if (!apiJs.includes("streamRoomEvents")) throw new Error("api-client missing streamRoomEvents");
  return "SSE room events wired";
});

await check("refresh-notify-wired", async () => {
  const appJs = await fetchText(`${FRONTEND}/app.js`);
  for (const token of ["refreshHostRoom", "refreshHostEvents", "updateNotifyBadge", "syncDirectorPolling", "pendingHostEventCount"]) {
    if (!appJs.includes(token)) throw new Error(`app.js missing refresh/notify token ${token}`);
  }
  if (!appJs.includes("refresh-host-room")) throw new Error("director refresh buttons missing");
  return "refresh + notify polling wired";
});

await check("checkpoint-wired", async () => {
  const appJs = await fetchText(`${FRONTEND}/app.js`);
  for (const token of ["openCreateCheckpointModal", "openCheckpointDetail", "cloudCheckpoints", "create-checkpoint"]) {
    if (!appJs.includes(token)) throw new Error(`app.js missing checkpoint token ${token}`);
  }
  const apiJs = await fetchText(`${FRONTEND}/api-client.js`);
  for (const method of ["getCheckpoints", "createCheckpoint", "getCheckpoint"]) {
    if (!apiJs.includes(`${method}:`)) throw new Error(`api-client missing ${method}`);
  }
  return "room checkpoint UI wired";
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
  const appJs = await fetchText(`${FRONTEND}/app.js`);
  const innerHtmlCount = (appJs.match(/innerHTML/g) || []).length;
  const escapeCount = (appJs.match(/escapeHtml\(/g) || []).length;
  if (!appJs.includes("function escapeHtml")) throw new Error("escapeHtml helper missing");
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
