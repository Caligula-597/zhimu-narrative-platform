/**
 * Runtime store / context coordinator robustness — no browser or backend required.
 * Usage: node --test scripts/runtime-stores.test.mjs
 *
 * Migrated to direct shard assertions: runtime-store.js / workspace-store.js /
 * context-coordinator.js now import shards directly instead of capturing
 * window.zhimuState. Tests reset and assert via shard.get() / shard.set().
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ── Browser global shims ── */
const noop = () => {};

function createMemoryStorage() {
  const items = {};
  return {
    getItem(key) { return items[key] ?? null; },
    setItem(key, value) { items[key] = String(value); },
    removeItem(key) { delete items[key]; },
    clear() { for (const k of Object.keys(items)) delete items[k]; },
    _items: items
  };
}

const localStorage = createMemoryStorage();
const sessionStorage = createMemoryStorage();

const runtimeDisconnects = [];
const livekitDisconnects = [];

globalThis.window = {
  zhimuConfig: {
    apiBase: "/api",
    demoMode: true,
    demoUsers: { hostUserId: "host-1", playerUserId: "" },
    demoWorld: { worldId: "demo-world" }
  },
  zhimuAuthSession: {
    isLoggedIn: () => Boolean(localStorage.getItem("zhimuSessionToken"))
  },
  zhimuSessionAuth: {},
  zhimuWorldRevision: {},
  zhimuUserMessages: { friendlyApiError: (p, fb) => p?.error || fb },
  zhimuRoomEvents: {
    disconnectRoomEventStream: () => runtimeDisconnects.push("room-events")
  },
  zhimuLiveKitVoice: {
    disconnectVoiceRoom: () => livekitDisconnects.push("livekit")
  },
  zhimuRuntimeStore: null,
  zhimuContext: null,
  zhimuWorkspace: null,
  localStorage,
  sessionStorage,
  addEventListener: noop,
  removeEventListener: noop
};

globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: noop,
  removeEventListener: noop
};
globalThis.localStorage = localStorage;
globalThis.sessionStorage = sessionStorage;
const navShim = { userAgent: "node-test" };
try { globalThis.navigator = navShim; } catch { Object.defineProperty(globalThis, "navigator", { value: navShim, writable: true, configurable: true }); }

/* ── Fetch mock: tests set `nextWorlds` to control getWorlds() response ── */
let nextWorlds = [];
globalThis.fetch = async (url, opts) => {
  const urlStr = String(url);
  if (urlStr === "/api/auth/me") {
    throw new TypeError("no backend in test");
  }
  if (urlStr === "/api/worlds" || urlStr.startsWith("/api/worlds?")) {
    return { ok: true, status: 200, json: async () => nextWorlds };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};

/* ── Module handles (populated in test.before) ── */
let zhimuApi;
let demoContext;
let zhimuRuntimeStore;
let zhimuContext;
let zhimuWorkspace;
let userStore, worldStore, roomStore, studioStore, assetStore, voiceStore, uiStore;

test.before(async () => {
  const fileUrl = (rel) => `file://${path.join(root, rel).replace(/\\/g, "/")}?t=${Date.now()}`;

  zhimuApi = await import(fileUrl("src/api/index.js"));
  demoContext = zhimuApi.context;
  if (!demoContext) throw new Error("zhimuApi.context (demoContext) live binding missing");

  const stateIndex = await import(fileUrl("src/state/index.js"));
  userStore = stateIndex.userStore;
  worldStore = stateIndex.worldStore;
  roomStore = stateIndex.roomStore;
  studioStore = stateIndex.studioStore;
  assetStore = stateIndex.assetStore;
  voiceStore = stateIndex.voiceStore;
  uiStore = stateIndex.uiStore;

  await import(fileUrl("src/runtime/runtime-store.js"));
  await import(fileUrl("src/runtime/context-coordinator.js"));
  await import(fileUrl("src/runtime/workspace-store.js"));

  zhimuRuntimeStore = globalThis.window.zhimuRuntimeStore;
  zhimuContext = globalThis.window.zhimuContext;
  zhimuWorkspace = globalThis.window.zhimuWorkspace;
  if (!zhimuRuntimeStore) throw new Error("zhimuRuntimeStore bridge not populated");
  if (!zhimuContext) throw new Error("zhimuContext bridge not populated");
  if (!zhimuWorkspace) throw new Error("zhimuWorkspace bridge not populated");
});

function resetState(overrides = {}) {
  worldStore.set({
    cloudWorlds: [],
    cloudRules: [{ id: "r1" }],
    cloudCreatorChecks: [{ id: "c1" }],
    cloudWorldLogs: [{ id: "log1" }]
  });
  studioStore.set({ cloudStudio: null });
  roomStore.set({
    cloudPlayer: null,
    cloudHost: [{ name: "h" }],
    cloudHostPlayers: [{ joined: true }],
    cloudHostPlayersError: "",
    cloudHostStuckCount: 2,
    cloudHostEvents: [{ id: "e1" }],
    cloudHostAuditLog: [{ id: "a1" }],
    cloudCheckpoints: [{ id: "cp1" }],
    cloudRecaps: [{ id: "rc1" }],
    cloudRecapLatest: { id: "latest" },
    cloudRecapDetail: { id: "detail" },
    activeRecapId: "recap-1",
    cloudExploration: { scenes: [] }
  });
  assetStore.set({ cloudAssets: [{ id: "asset1" }], storageUsage: { usedBytes: 1 } });
  uiStore.set({ accountView: { me: {} } });
  userStore.set({ apiError: "old error", currentUser: null });
  voiceStore.set({
    voiceRoomId: "voice-1",
    voiceRoom: "测试房",
    voiceMessages: [{ id: "m1" }],
    voiceLiveStatus: "connected",
    voiceMicEnabled: true,
    voiceParticipants: [{ id: "p1" }],
    voiceLiveError: "err"
  });
  // apply overrides per shard by field name
  const allShards = [
    [userStore, ["currentUser", "apiError", "roomEventsConnected"]],
    [worldStore, ["cloudWorlds", "cloudCatalog", "cloudCatalogError", "cloudCreatorChecks", "cloudRules", "cloudRulesPreview", "cloudWorldLogs"]],
    [roomStore, ["cloudPlayer", "cloudHost", "cloudHostPlayers", "cloudHostPlayersError", "cloudHostStuckCount", "cloudExploration", "cloudHostEvents", "cloudHostClueMatrix", "cloudHostAuditLog", "cloudCheckpoints", "cloudRecaps", "cloudRecapLatest", "cloudRecapDetail", "activeRecapId", "cloudRoomSettings", "hostEventSelection"]],
    [studioStore, ["cloudStudio", "studioSelectedNode", "studioAnchorEditing", "studioFilter", "studioZoom", "studioLayoutMode", "studioCollapsedScenes", "studioCanvasHeight", "cloudLoading"]],
    [assetStore, ["cloudAssets", "assetKindFilter", "assetSearchQuery", "assetShowRecycle", "assetTotal", "storageUsage"]],
    [voiceStore, ["voiceRoom", "voiceRoomId", "voiceMessages", "voiceLiveStatus", "voiceMicEnabled", "voiceParticipants", "voiceLiveError", "voicePlaybackBlocked"]],
    [uiStore, ["view", "searchFocus", "cluesSearchQuery", "cluesSelectedId", "cluesBulkSelection", "panelCollapse", "accountHubTab", "accountView", "accountViewLoading", "accountHubLoadId"]]
  ];
  for (const [store, keys] of allShards) {
    const patch = {};
    for (const k of keys) {
      if (k in overrides) patch[k] = overrides[k];
    }
    if (Object.keys(patch).length) store.set(patch);
  }
}

test.beforeEach(() => {
  resetState();
  demoContext.worldId = "";
  demoContext.roomId = "";
  localStorage.clear();
  sessionStorage.clear();
  runtimeDisconnects.length = 0;
  livekitDisconnects.length = 0;
  nextWorlds = [];
});

/* ── runtime-store tests ── */

test("runtime-store clearRuntimeFields resets in-room payload only", () => {
  zhimuRuntimeStore.clearRuntimeFields();

  assert.equal(roomStore.get().cloudPlayer, null);
  assert.equal(roomStore.get().cloudHostEvents.length, 0);
  assert.equal(roomStore.get().cloudHostAuditLog.length, 0);
  assert.equal(voiceStore.get().voiceLiveStatus, "idle");
  assert.equal(worldStore.get().cloudRules.length, 1, "world-scoped rules must survive runtime-only clear");
  assert.equal(runtimeDisconnects.length, 0);
});

test("runtime-store clearRuntimeState disconnects live streams", () => {
  zhimuRuntimeStore.clearRuntimeState();

  assert.deepEqual(runtimeDisconnects, ["room-events"]);
  assert.deepEqual(livekitDisconnects, ["livekit"]);
});

test("runtime-store applyHostPlayersPayload maps host table rows", () => {
  zhimuRuntimeStore.applyHostPlayersPayload({
    stuckCount: 3,
    players: [{
      role_slot_id: "role-1",
      role_name: "记者",
      total_sections: 5,
      completed_sections: 2,
      current_scene_id: "scene-1",
      last_activity_at: "2026-01-01T00:00:00Z"
    }]
  });

  const room = roomStore.get();
  assert.equal(room.cloudHostStuckCount, 3);
  assert.equal(room.cloudHostPlayers.length, 1);
  assert.equal(room.cloudHost[0].name, "记者");
  assert.equal(room.cloudHost[0].completed_sections, 2);
});

/* ── context-coordinator tests ── */

test("context-coordinator resetAccountContext clears demo workspace pointer", () => {
  resetState({ cloudStudio: { world: { id: "w1" } }, accountView: { me: {} } });
  demoContext.worldId = "demo-world";
  demoContext.roomId = "room-1";

  zhimuContext.resetAccountContext();

  assert.equal(demoContext.worldId, "");
  assert.equal(demoContext.roomId, "");
  assert.equal(studioStore.get().cloudStudio, null);
  assert.equal(uiStore.get().accountView, null);
  assert.equal(runtimeDisconnects.length, 1);
});

test("context-coordinator prepareWorldSwitch selects world and clears scoped cache", () => {
  demoContext.worldId = "old-world";
  demoContext.roomId = "room-old";

  zhimuContext.prepareWorldSwitch("new-world");

  assert.equal(demoContext.worldId, "new-world");
  assert.equal(demoContext.roomId, "");
  assert.equal(studioStore.get().cloudStudio, null);
  assert.equal(worldStore.get().cloudRules.length, 0);
  assert.equal(roomStore.get().cloudHostAuditLog.length, 0);
  assert.equal(assetStore.get().storageUsage, null);
  assert.equal(userStore.get().apiError, "");
});

test("context-coordinator onSessionLogout removes auth prompt flag", () => {
  sessionStorage.setItem("zhimuAuthPrompted", "1");

  zhimuContext.onSessionLogout();

  assert.equal(sessionStorage.getItem("zhimuAuthPrompted"), null);
});

/* ── workspace tests ── */

test("workspace ensureActiveWorld strips stale demo world when logged in", async () => {
  localStorage.setItem("zhimuSessionToken", "token");
  nextWorlds = [{ id: "real-world", name: "Real" }];
  demoContext.worldId = "demo-world";
  demoContext.roomId = "room-demo";

  const id = await zhimuWorkspace.ensureActiveWorld();

  assert.equal(id, "real-world");
  assert.equal(demoContext.worldId, "real-world");
  assert.equal(demoContext.roomId, "");
});

test("workspace ensureActiveWorld auto-selects demo world for anonymous demo browse", async () => {
  nextWorlds = [
    { id: "demo-world", name: "Demo" },
    { id: "other", name: "Other" }
  ];

  const id = await zhimuWorkspace.ensureActiveWorld();

  assert.equal(id, "demo-world");
  assert.equal(demoContext.worldId, "demo-world");
});

test("workspace ensureActiveWorld returns null and clears pointers when no worlds", async () => {
  nextWorlds = [];
  demoContext.worldId = "ghost";
  demoContext.roomId = "room-ghost";

  const id = await zhimuWorkspace.ensureActiveWorld();

  assert.equal(id, null);
  assert.equal(demoContext.worldId, "");
  assert.equal(demoContext.roomId, "");
});

test("workspace activeRuntimeRoom resolves from studio rooms or player payload", () => {
  demoContext.roomId = "room-a";

  studioStore.set({ cloudStudio: { rooms: [{ id: "room-a", name: "Studio Room" }] } });
  assert.equal(zhimuWorkspace.activeRuntimeRoom()?.name, "Studio Room");

  studioStore.set({ cloudStudio: { rooms: [] } });
  roomStore.set({ cloudPlayer: { room: { id: "room-a", name: "Player Room" } } });
  assert.equal(zhimuWorkspace.activeRuntimeRoom()?.name, "Player Room");

  roomStore.set({ cloudPlayer: null });
  assert.equal(zhimuWorkspace.activeRuntimeRoom(), null);
});

test("workspace roomBelongsToActiveWorld is false when room id is orphan", () => {
  demoContext.roomId = "orphan-room";
  studioStore.set({ cloudStudio: { rooms: [{ id: "other-room" }] } });

  assert.equal(zhimuWorkspace.roomBelongsToActiveWorld(), false);
});

test("workspace isWorldOwner checks membership_role and owner_user_id", () => {
  demoContext.worldId = "w1";

  studioStore.set({ cloudStudio: { world: { id: "w1", membership_role: "editor" } } });
  assert.equal(zhimuWorkspace.isWorldOwner("w1"), false);

  studioStore.set({ cloudStudio: { world: { id: "w1", membership_role: "owner" } } });
  assert.equal(zhimuWorkspace.isWorldOwner("w1"), true);

  studioStore.set({ cloudStudio: { world: { id: "w1", owner_user_id: "user-9" } } });
  userStore.set({ currentUser: { id: "user-9" } });
  assert.equal(zhimuWorkspace.isWorldOwner("w1"), true);

  studioStore.set({ cloudStudio: null });
  worldStore.set({ cloudWorlds: [{ id: "w2", membership_role: "owner" }] });
  assert.equal(zhimuWorkspace.isWorldOwner("w2"), true);
});

/* ── Source inspection tests (no execution) ── */

test("auth-world and account views delegate session context to zhimuContext", () => {
  const authJs = fs.readFileSync(path.join(root, "src/runtime/auth-world.js"), "utf8");
  const accountJs = fs.readFileSync(path.join(root, "src/views/account.js"), "utf8");
  assert.match(authJs, /zhimuContext\?\.resetAccountContext/);
  assert.match(accountJs, /zhimuContext\?\.onSessionLogout/);
  assert.doesNotMatch(authJs, /const resetAccountContext=\(\)=>\{zhimuApi\.resetActiveWorld/);
});

test("data.js delegates ensureActiveWorld and clearRuntimeState to stores", () => {
  const dataJs = fs.readFileSync(path.join(root, "src/runtime/data.js"), "utf8");
  assert.match(dataJs, /zhimuWorkspace/);
  assert.match(dataJs, /zhimuRuntimeStore/);
  assert.match(dataJs, /zhimuRoomEvents/);
  assert.match(dataJs, /function ensureActiveWorld/);
  assert.match(dataJs, /function clearRuntimeState/);
});

test("actions.js delegates to domain action modules", () => {
  const actionsJs = fs.readFileSync(path.join(root, "src/runtime/actions.js"), "utf8");
  const modules = [
    "zhimuActionsWorkspace",
    "zhimuActionsArchive",
    "zhimuActionsPlayer",
    "zhimuActionsDirector",
    "zhimuActionsStudio",
    "zhimuActionsWriter",
    "zhimuActionsRules",
    "zhimuActionsAssets",
    "zhimuActionsClues"
  ];
  for (const name of modules) {
    assert.match(actionsJs, new RegExp(name));
  }
  assert.ok(actionsJs.split("\n").length < 80, "actions.js should stay a thin dispatcher");
});

test("pipeline modules split into session, brief, html, dom, open", () => {
  for (const rel of [
    "src/views/pipeline-wizard-session.js",
    "src/views/pipeline-wizard-brief.js",
    "src/views/pipeline-wizard-html.js",
    "src/views/pipeline-wizard-dom.js",
    "src/views/pipeline-wizard-open.js"
  ]) {
    assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  }
  const wizardJs = fs.readFileSync(path.join(root, "src/views/pipeline-wizard.js"), "utf8");
  assert.match(wizardJs, /zhimuPipelineOpen/);
  assert.ok(wizardJs.split("\n").length < 25, "pipeline-wizard.js should be public entry only");
  const openJs = fs.readFileSync(path.join(root, "src/views/pipeline-wizard-open.js"), "utf8");
  assert.match(openJs, /openDeepseekPipeline/);
  assert.match(openJs, /zhimuPipelineHtml/);
  assert.match(openJs, /zhimuPipelineDom/);
});

test("main.js loads store modules before auth-world and data.js", () => {
  const mainJs = fs.readFileSync(path.join(root, "frontend/main.js"), "utf8");
  const workspaceIdx = mainJs.indexOf("workspace-store.js");
  const authWorldIdx = mainJs.indexOf("auth-world.js");
  const dataIdx = mainJs.indexOf("runtime/data.js");
  assert.ok(workspaceIdx > -1 && authWorldIdx > workspaceIdx && dataIdx > authWorldIdx);
});

test("view registry is introduced without disabling lazy view loading", () => {
  const registryJs = fs.readFileSync(path.join(root, "src/runtime/view-registry.js"), "utf8");
  const resolverJs = fs.readFileSync(path.join(root, "src/bootstrap/view-resolver.js"), "utf8");
  const loaderJs = fs.readFileSync(path.join(root, "src/runtime/view-loader.js"), "utf8");
  const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const actionsJs = fs.readFileSync(path.join(root, "src/runtime/actions.js"), "utf8");

  assert.match(registryJs, /export function registerView/);
  assert.match(registryJs, /export function getView/);
  assert.doesNotMatch(registryJs, /window\.zhimuViews/);
  assert.match(resolverJs, /import \{ getView \} from "\.\.\/runtime\/view-registry\.js"/);
  assert.match(resolverJs, /case "overview": return getView\("overview"\)\.overview/);
  assert.doesNotMatch(resolverJs, /const views = \{/);
  assert.doesNotMatch(appJs, /const V = window\.zhimuViews/);
  assert.doesNotMatch(actionsJs, /const V = window\.zhimuViews/);
  assert.match(actionsJs, /callView\("studio", "bindStudioDragging"\)/);
  assert.match(loaderJs, /\(\) => import\("\.\.\/views\/clues\.js"\)/);
});

test("phase V4 view APIs register without writing the old zhimuViews bridge", () => {
  for (const [rel, namespace] of [
    ["src/views/overview.js", "overview"],
    ["src/views/clues.js", "clues"],
    ["src/views/settings.js", "settings"],
    ["src/views/assets.js", "assets"],
    ["src/views/archive.js", "archive"],
    ["src/views/player.js", "player"],
    ["src/views/director.js", "director"],
    ["src/views/studio.js", "studio"],
    ["src/views/writer.js", "writer"],
    ["src/views/mini-games.js", "miniGames"],
    ["src/views/ops.js", "ops"],
    ["src/views/account-hub.js", "accountHub"],
    ["src/views/account.js", "account"],
    ["src/views/rules.js", "rules"]
  ]) {
    const source = fs.readFileSync(path.join(root, rel), "utf8");
    assert.match(source, /import \{[^}]*registerView[^}]*\} from "\.\.\/runtime\/view-registry\.js"/);
    assert.match(source, new RegExp(`registerView\\("${namespace}", ${namespace}ViewApi\\)`));
    assert.doesNotMatch(source, /window\.zhimuViews/);
  }
});

test("phase V2 action pilots consume view registry instead of zhimuViews", () => {
  for (const rel of [
    "src/runtime/actions-clues.js",
    "src/runtime/actions-rules.js",
    "src/runtime/actions-assets.js",
    "src/runtime/actions-archive.js",
    "src/runtime/actions-player.js",
    "src/runtime/actions-director.js",
    "src/runtime/actions-studio.js",
    "src/runtime/actions-writer.js",
    "src/runtime/actions-mini-games.js",
    "src/runtime/actions-ops.js"
  ]) {
    const source = fs.readFileSync(path.join(root, rel), "utf8");
    assert.match(source, /import \{ callView \} from "\.\/view-registry\.js"/);
    assert.match(source, /callView\("/);
    assert.doesNotMatch(source, /function views\(\) \{ return window\.zhimuViews \|\| \{\}; \}/);
  }
});

test("phase V3 account hub consumes registry for cross-view calls", () => {
  const source = fs.readFileSync(path.join(root, "src/views/account-hub.js"), "utf8");
  assert.match(source, /import \{[^}]*callView[^}]*registerView[^}]*\} from "\.\.\/runtime\/view-registry\.js"/);
  assert.match(source, /callView\("account", "refreshAccountView"\)/);
  assert.match(source, /callView\("assets", "reloadAssets"\)/);
  assert.match(source, /callView\("account", "accountBodyHtml", accountView\)/);
  assert.doesNotMatch(source, /window\.zhimuViews\?\.account/);
  assert.doesNotMatch(source, /window\.zhimuViews\?\.assets/);
});

test("phase V3 component shells no longer capture unused zhimuViews handles", () => {
  for (const rel of ["src/components/modal.js", "src/components/emptyState.js"]) {
    const source = fs.readFileSync(path.join(root, rel), "utf8");
    assert.doesNotMatch(source, /const V = window\.zhimuViews \|\| \{\};/);
  }
});

test("phase V3 runtime cross-view calls go through loader and registry", () => {
  const roomEvents = fs.readFileSync(path.join(root, "src/runtime/room-events.js"), "utf8");
  const searchFocus = fs.readFileSync(path.join(root, "src/runtime/search-focus.js"), "utf8");
  assert.match(roomEvents, /import \{ callView \} from "\.\/view-registry\.js"/);
  assert.match(roomEvents, /ensureViewModules\?\.\("player"\)/);
  assert.match(roomEvents, /callView\("player", "refreshVoiceMessages"\)/);
  assert.match(searchFocus, /import \{ callView \} from "\.\/view-registry\.js"/);
  assert.match(searchFocus, /ensureViewModules\?\.\("writer"\)/);
  assert.match(searchFocus, /callView\("writer", "openCreatorSection"/);
});

test("phase V3 removes stale zhimuViews read handles", () => {
  for (const rel of [
    "src/views/archive.js",
    "src/views/director.js",
    "src/views/overview.js",
    "src/views/player.js",
    "src/views/rules.js",
    "src/views/studio.js",
    "src/views/writer.js",
    "src/runtime/auth-world.js",
    "src/runtime/room-events.js",
    "src/runtime/search-focus.js",
    "src/runtime/wizard.js"
  ]) {
    const source = fs.readFileSync(path.join(root, rel), "utf8");
    assert.doesNotMatch(source, /const V = window\.zhimuViews \|\| \{\};/);
    assert.doesNotMatch(source, /\bV\.[a-zA-Z_$]/);
  }
});

test("phase V4 removes zhimuViews from startup requirements and src", () => {
  const dependencyGuard = fs.readFileSync(path.join(root, "src/runtime/dependency-guard.js"), "utf8");
  assert.doesNotMatch(dependencyGuard, /"zhimuViews"/);

  const sourceFiles = [
    ...fs.readdirSync(path.join(root, "src/views")).filter((name) => name.endsWith(".js")).map((name) => `src/views/${name}`),
    ...fs.readdirSync(path.join(root, "src/runtime")).filter((name) => name.endsWith(".js")).map((name) => `src/runtime/${name}`),
    ...fs.readdirSync(path.join(root, "src/components")).filter((name) => name.endsWith(".js")).map((name) => `src/components/${name}`),
    "app.js"
  ];
  for (const rel of sourceFiles) {
    const source = fs.readFileSync(path.join(root, rel), "utf8");
    assert.doesNotMatch(source, /window\.zhimuViews/);
    assert.doesNotMatch(source, /\bzhimuViews\b/);
  }
});

test("phase V4 does not expose a new zhimuViewRegistry window bridge", () => {
  const registryJs = fs.readFileSync(path.join(root, "src/runtime/view-registry.js"), "utf8");
  const verifyScript = fs.readFileSync(path.join(root, "scripts/verify-script-load.mjs"), "utf8");
  assert.match(registryJs, /export function viewRegistrySnapshot/);
  assert.doesNotMatch(registryJs, /window\.zhimuViewRegistry/);
  assert.match(verifyScript, /viewRegistryModule\.viewRegistrySnapshot\(\)/);
});

test("A1 runtime facade centralizes low-risk runtime consumers", () => {
  const facade = fs.readFileSync(path.join(root, "src/runtime/runtime-facade.js"), "utf8");
  assert.match(facade, /export function callRuntime/);
  assert.match(facade, /window\.zhimuRuntime \|\| \{\}/);

  for (const rel of [
    "src/components/emptyState.js",
    "src/components/modal.js",
    "src/runtime/actions-ops.js",
    "src/runtime/actions-studio.js",
    "src/runtime/actions-workspace.js",
    "src/runtime/global-search.js"
  ]) {
    const source = fs.readFileSync(path.join(root, rel), "utf8");
    assert.match(source, /runtime-facade\.js/);
    assert.doesNotMatch(source, /const R = window\.zhimuRuntime/);
    assert.doesNotMatch(source, /window\.zhimuRuntime\?\./);
  }
});
