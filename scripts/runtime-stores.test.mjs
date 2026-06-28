/**
 * Runtime store / context coordinator robustness — no browser or backend required.
 * Usage: node --test scripts/runtime-stores.test.mjs
 *
 * Migrated from vm.runInNewContext to native dynamic import() because
 * context-coordinator.js and workspace-store.js are now real ES modules
 * (import * as zhimuApi from "../api/index.js"). vm.runInNewContext cannot
 * handle `import` statements, so we use dynamic import() + globalThis shims.
 *
 * Assertion strategy: instead of tracking apiCalls on a mock zhimuApi, we
 * verify effects on the real demoContext live binding (zhimuApi.context) and
 * the shared state object captured by the runtime IIFEs.
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

const state = {
  cloudWorlds: [],
  cloudStudio: null,
  cloudPlayer: null,
  cloudRules: [{ id: "r1" }],
  cloudCreatorChecks: [{ id: "c1" }],
  cloudHost: [{ name: "h" }],
  cloudHostPlayers: [{ joined: true }],
  cloudHostStuckCount: 2,
  cloudHostEvents: [{ id: "e1" }],
  cloudHostAuditLog: [{ id: "a1" }],
  cloudCheckpoints: [{ id: "cp1" }],
  cloudRecaps: [{ id: "rc1" }],
  cloudRecapLatest: { id: "latest" },
  cloudRecapDetail: { id: "detail" },
  activeRecapId: "recap-1",
  cloudWorldLogs: [{ id: "log1" }],
  cloudExploration: { scenes: [] },
  cloudAssets: [{ id: "asset1" }],
  storageUsage: { usedBytes: 1 },
  accountView: { me: {} },
  apiError: "old error",
  voiceRoomId: "voice-1",
  voiceRoom: "测试房",
  voiceMessages: [{ id: "m1" }],
  voiceLiveStatus: "connected",
  voiceMicEnabled: true,
  voiceParticipants: [{ id: "p1" }],
  voiceLiveError: "err",
  currentUser: null
};

globalThis.window = {
  zhimuState: state,
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
  // /auth/me fires on module load (zhimuSessionReady IIFE) — fail gracefully.
  if (urlStr === "/api/auth/me") {
    throw new TypeError("no backend in test");
  }
  // getWorlds() -> request("/worlds") -> fetch("/api/worlds")
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

test.before(async () => {
  const fileUrl = (rel) => `file://${path.join(root, rel).replace(/\\/g, "/")}?t=${Date.now()}`;

  // Load API bundle first — we need the demoContext live binding for assertions.
  // context-coordinator.js and workspace-store.js will resolve their own imports.
  zhimuApi = await import(fileUrl("src/api/index.js"));
  demoContext = zhimuApi.context;
  if (!demoContext) throw new Error("zhimuApi.context (demoContext) live binding missing");

  // Load runtime modules — they assign window.zhimuRuntimeStore/zhimuContext/zhimuWorkspace.
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

const defaultState = {
  cloudWorlds: [],
  cloudStudio: null,
  cloudPlayer: null,
  cloudRules: [{ id: "r1" }],
  cloudCreatorChecks: [{ id: "c1" }],
  cloudHost: [{ name: "h" }],
  cloudHostPlayers: [{ joined: true }],
  cloudHostStuckCount: 2,
  cloudHostEvents: [{ id: "e1" }],
  cloudHostAuditLog: [{ id: "a1" }],
  cloudCheckpoints: [{ id: "cp1" }],
  cloudRecaps: [{ id: "rc1" }],
  cloudRecapLatest: { id: "latest" },
  cloudRecapDetail: { id: "detail" },
  activeRecapId: "recap-1",
  cloudWorldLogs: [{ id: "log1" }],
  cloudExploration: { scenes: [] },
  cloudAssets: [{ id: "asset1" }],
  storageUsage: { usedBytes: 1 },
  accountView: { me: {} },
  apiError: "old error",
  voiceRoomId: "voice-1",
  voiceRoom: "测试房",
  voiceMessages: [{ id: "m1" }],
  voiceLiveStatus: "connected",
  voiceMicEnabled: true,
  voiceParticipants: [{ id: "p1" }],
  voiceLiveError: "err",
  currentUser: null
};

function resetState(overrides = {}) {
  // Mutate state in place — runtime IIFEs captured `state` by reference at import.
  for (const key of Object.keys(state)) {
    if (!(key in defaultState) && !(key in overrides)) delete state[key];
  }
  for (const [key, value] of Object.entries({ ...defaultState, ...overrides })) {
    state[key] = value;
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

  assert.equal(state.cloudPlayer, null);
  assert.equal(state.cloudHostEvents.length, 0);
  assert.equal(state.cloudHostAuditLog.length, 0);
  assert.equal(state.voiceLiveStatus, "idle");
  assert.equal(state.cloudRules.length, 1, "world-scoped rules must survive runtime-only clear");
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

  assert.equal(state.cloudHostStuckCount, 3);
  assert.equal(state.cloudHostPlayers.length, 1);
  assert.equal(state.cloudHost[0].name, "记者");
  assert.equal(state.cloudHost[0].completed_sections, 2);
});

/* ── context-coordinator tests ── */

test("context-coordinator resetAccountContext clears demo workspace pointer", () => {
  resetState({ cloudStudio: { world: { id: "w1" } }, accountView: { me: {} } });
  demoContext.worldId = "demo-world";
  demoContext.roomId = "room-1";

  zhimuContext.resetAccountContext();

  // Effect of resetActiveWorld(): both worldId and roomId cleared on demoContext.
  assert.equal(demoContext.worldId, "");
  assert.equal(demoContext.roomId, "");
  assert.equal(state.cloudStudio, null);
  assert.equal(state.accountView, null);
  assert.equal(runtimeDisconnects.length, 1);
});

test("context-coordinator prepareWorldSwitch selects world and clears scoped cache", () => {
  demoContext.worldId = "old-world";
  demoContext.roomId = "room-old";

  zhimuContext.prepareWorldSwitch("new-world");

  // Effect: selectWorld("new-world") then clearRoom() — worldId set, roomId cleared.
  assert.equal(demoContext.worldId, "new-world");
  assert.equal(demoContext.roomId, "");
  assert.equal(state.cloudStudio, null);
  assert.equal(state.cloudRules.length, 0);
  assert.equal(state.cloudHostAuditLog.length, 0);
  assert.equal(state.storageUsage, null);
  assert.equal(state.apiError, "");
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

  state.cloudStudio = { rooms: [{ id: "room-a", name: "Studio Room" }] };
  assert.equal(zhimuWorkspace.activeRuntimeRoom()?.name, "Studio Room");

  state.cloudStudio = { rooms: [] };
  state.cloudPlayer = { room: { id: "room-a", name: "Player Room" } };
  assert.equal(zhimuWorkspace.activeRuntimeRoom()?.name, "Player Room");

  state.cloudPlayer = null;
  assert.equal(zhimuWorkspace.activeRuntimeRoom(), null);
});

test("workspace roomBelongsToActiveWorld is false when room id is orphan", () => {
  demoContext.roomId = "orphan-room";
  state.cloudStudio = { rooms: [{ id: "other-room" }] };

  assert.equal(zhimuWorkspace.roomBelongsToActiveWorld(), false);
});

test("workspace isWorldOwner checks membership_role and owner_user_id", () => {
  demoContext.worldId = "w1";

  state.cloudStudio = { world: { id: "w1", membership_role: "editor" } };
  assert.equal(zhimuWorkspace.isWorldOwner("w1"), false);

  state.cloudStudio = { world: { id: "w1", membership_role: "owner" } };
  assert.equal(zhimuWorkspace.isWorldOwner("w1"), true);

  state.cloudStudio = { world: { id: "w1", owner_user_id: "user-9" } };
  state.currentUser = { id: "user-9" };
  assert.equal(zhimuWorkspace.isWorldOwner("w1"), true);

  state.cloudStudio = null;
  state.cloudWorlds = [{ id: "w2", membership_role: "owner" }];
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
