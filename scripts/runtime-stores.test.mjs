/**
 * Runtime store / context coordinator robustness — no browser or backend required.
 * Usage: node --test scripts/runtime-stores.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function stripEsmExport(source) {
  return source.replace(/\nexport\s*\{\s*\}\s*;?\s*$/, "");
}

function readModule(rel) {
  return stripEsmExport(fs.readFileSync(path.join(root, rel), "utf8"));
}

function createMemoryStorage() {
  const items = {};
  return {
    getItem(key) {
      return items[key] ?? null;
    },
    setItem(key, value) {
      items[key] = String(value);
    },
    removeItem(key) {
      delete items[key];
    },
    _items: items
  };
}

function createSandbox(overrides = {}) {
  const localStorage = overrides.localStorage ?? createMemoryStorage();
  const sessionStorage = overrides.sessionStorage ?? createMemoryStorage();
  const context = { worldId: null, roomId: null, hostUserId: "host-1", playerUserId: null };
  const apiCalls = [];

  const zhimuApi = {
    context,
    async getWorlds() {
      apiCalls.push("getWorlds");
      return overrides.worlds ?? [];
    },
    selectWorld(id) {
      apiCalls.push(["selectWorld", id]);
      context.worldId = id;
    },
    clearWorld() {
      apiCalls.push("clearWorld");
      context.worldId = null;
    },
    clearRoom() {
      apiCalls.push("clearRoom");
      context.roomId = null;
    },
    resetActiveWorld() {
      apiCalls.push("resetActiveWorld");
      context.worldId = null;
      context.roomId = null;
    },
    selectRoom(id) {
      apiCalls.push(["selectRoom", id]);
      context.roomId = id;
    }
  };

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
    currentUser: null,
    ...overrides.state
  };

  const runtimeDisconnects = [];
  const livekitDisconnects = [];

  const sandbox = {
    localStorage,
    sessionStorage,
    window: {
      zhimuState: state,
      zhimuApi,
      zhimuConfig: {
        demoMode: true,
        demoWorld: { worldId: "demo-world" },
        ...overrides.config
      },
      zhimuAuthSession: {
        isLoggedIn: () => Boolean(localStorage.getItem("zhimuSessionToken")),
        ...overrides.authSession
      },
      zhimuRoomEvents: {
        disconnectRoomEventStream: () => runtimeDisconnects.push("room-events")
      },
      zhimuLiveKitVoice: {
        disconnectVoiceRoom: () => livekitDisconnects.push("livekit")
      },
      zhimuRuntimeStore: null,
      zhimuContext: null,
      zhimuWorkspace: null
    },
    localStorage,
    sessionStorage
  };

  sandbox.window.localStorage = localStorage;
  sandbox.window.sessionStorage = sessionStorage;

  return { sandbox, state, context, zhimuApi, apiCalls, runtimeDisconnects, livekitDisconnects, localStorage, sessionStorage };
}

function loadRuntimeModules(sandbox, modules = [
  "src/runtime/runtime-store.js",
  "src/runtime/context-coordinator.js",
  "src/runtime/workspace-store.js"
]) {
  const ctx = { ...sandbox, window: sandbox.window };
  for (const rel of modules) {
    vm.runInNewContext(readModule(rel), ctx);
    sandbox.window.zhimuRuntimeStore = sandbox.window.zhimuRuntimeStore ?? ctx.window.zhimuRuntimeStore;
    sandbox.window.zhimuContext = sandbox.window.zhimuContext ?? ctx.window.zhimuContext;
    sandbox.window.zhimuWorkspace = sandbox.window.zhimuWorkspace ?? ctx.window.zhimuWorkspace;
  }
  return ctx.window;
}

test("runtime-store clearRuntimeFields resets in-room payload only", () => {
  const { sandbox, state, runtimeDisconnects } = createSandbox();
  const win = loadRuntimeModules(sandbox, ["src/runtime/runtime-store.js"]);

  win.zhimuRuntimeStore.clearRuntimeFields();

  assert.equal(state.cloudPlayer, null);
  assert.equal(state.cloudHostEvents.length, 0);
  assert.equal(state.cloudHostAuditLog.length, 0);
  assert.equal(state.voiceLiveStatus, "idle");
  assert.equal(state.cloudRules.length, 1, "world-scoped rules must survive runtime-only clear");
  assert.equal(runtimeDisconnects.length, 0);
});

test("runtime-store clearRuntimeState disconnects live streams", () => {
  const { sandbox, runtimeDisconnects, livekitDisconnects } = createSandbox();
  const win = loadRuntimeModules(sandbox, ["src/runtime/runtime-store.js"]);

  win.zhimuRuntimeStore.clearRuntimeState();

  assert.deepEqual(runtimeDisconnects, ["room-events"]);
  assert.deepEqual(livekitDisconnects, ["livekit"]);
});

test("runtime-store applyHostPlayersPayload maps host table rows", () => {
  const { sandbox, state } = createSandbox();
  const win = loadRuntimeModules(sandbox, ["src/runtime/runtime-store.js"]);

  win.zhimuRuntimeStore.applyHostPlayersPayload({
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

test("context-coordinator resetAccountContext clears demo workspace pointer", () => {
  const { sandbox, state, context, apiCalls, runtimeDisconnects } = createSandbox({
    state: { cloudStudio: { world: { id: "w1" } }, accountView: { me: {} } }
  });
  context.worldId = "demo-world";
  context.roomId = "room-1";
  const win = loadRuntimeModules(sandbox);

  win.zhimuContext.resetAccountContext();

  assert.deepEqual(apiCalls[0], "resetActiveWorld");
  assert.equal(state.cloudStudio, null);
  assert.equal(state.accountView, null);
  assert.equal(runtimeDisconnects.length, 1);
});

test("context-coordinator prepareWorldSwitch selects world and clears scoped cache", () => {
  const { sandbox, state, context, apiCalls } = createSandbox();
  context.worldId = "old-world";
  context.roomId = "room-old";
  const win = loadRuntimeModules(sandbox);

  win.zhimuContext.prepareWorldSwitch("new-world");

  assert.deepEqual(apiCalls.filter((c) => c === "clearRoom"), ["clearRoom"]);
  assert.deepEqual(apiCalls.find((c) => Array.isArray(c) && c[0] === "selectWorld"), ["selectWorld", "new-world"]);
  assert.equal(context.worldId, "new-world");
  assert.equal(context.roomId, null);
  assert.equal(state.cloudStudio, null);
  assert.equal(state.cloudRules.length, 0);
  assert.equal(state.cloudHostAuditLog.length, 0);
  assert.equal(state.storageUsage, null);
  assert.equal(state.apiError, "");
});

test("context-coordinator onSessionLogout removes auth prompt flag", () => {
  const { sandbox, sessionStorage } = createSandbox();
  sessionStorage.setItem("zhimuAuthPrompted", "1");
  const win = loadRuntimeModules(sandbox);

  win.zhimuContext.onSessionLogout();

  assert.equal(sessionStorage.getItem("zhimuAuthPrompted"), null);
});

test("workspace ensureActiveWorld strips stale demo world when logged in", async () => {
  const { sandbox, localStorage, context } = createSandbox({
    worlds: [{ id: "real-world", name: "Real" }],
    config: { demoMode: true, demoWorld: { worldId: "demo-world" } }
  });
  localStorage.setItem("zhimuSessionToken", "token");
  context.worldId = "demo-world";
  context.roomId = "room-demo";
  const win = loadRuntimeModules(sandbox);

  const id = await win.zhimuWorkspace.ensureActiveWorld();

  assert.equal(id, "real-world");
  assert.equal(context.worldId, "real-world");
  assert.equal(context.roomId, null);
});

test("workspace ensureActiveWorld auto-selects demo world for anonymous demo browse", async () => {
  const { sandbox, context } = createSandbox({
    worlds: [
      { id: "demo-world", name: "Demo" },
      { id: "other", name: "Other" }
    ],
    config: { demoMode: true, demoWorld: { worldId: "demo-world" } }
  });
  const win = loadRuntimeModules(sandbox);

  const id = await win.zhimuWorkspace.ensureActiveWorld();

  assert.equal(id, "demo-world");
  assert.equal(context.worldId, "demo-world");
});

test("workspace ensureActiveWorld returns null and clears pointers when no worlds", async () => {
  const { sandbox, context } = createSandbox({ worlds: [] });
  context.worldId = "ghost";
  context.roomId = "room-ghost";
  const win = loadRuntimeModules(sandbox);

  const id = await win.zhimuWorkspace.ensureActiveWorld();

  assert.equal(id, null);
  assert.equal(context.worldId, null);
  assert.equal(context.roomId, null);
});

test("workspace activeRuntimeRoom resolves from studio rooms or player payload", () => {
  const { sandbox, state, context } = createSandbox();
  context.roomId = "room-a";
  const win = loadRuntimeModules(sandbox);

  state.cloudStudio = { rooms: [{ id: "room-a", name: "Studio Room" }] };
  assert.equal(win.zhimuWorkspace.activeRuntimeRoom()?.name, "Studio Room");

  state.cloudStudio = { rooms: [] };
  state.cloudPlayer = { room: { id: "room-a", name: "Player Room" } };
  assert.equal(win.zhimuWorkspace.activeRuntimeRoom()?.name, "Player Room");

  state.cloudPlayer = null;
  assert.equal(win.zhimuWorkspace.activeRuntimeRoom(), null);
});

test("workspace roomBelongsToActiveWorld is false when room id is orphan", () => {
  const { sandbox, state, context } = createSandbox();
  context.roomId = "orphan-room";
  state.cloudStudio = { rooms: [{ id: "other-room" }] };
  const win = loadRuntimeModules(sandbox);

  assert.equal(win.zhimuWorkspace.roomBelongsToActiveWorld(), false);
});

test("workspace isWorldOwner checks membership_role and owner_user_id", () => {
  const { sandbox, state, context } = createSandbox();
  context.worldId = "w1";
  const win = loadRuntimeModules(sandbox);

  state.cloudStudio = { world: { id: "w1", membership_role: "editor" } };
  assert.equal(win.zhimuWorkspace.isWorldOwner("w1"), false);

  state.cloudStudio = { world: { id: "w1", membership_role: "owner" } };
  assert.equal(win.zhimuWorkspace.isWorldOwner("w1"), true);

  state.cloudStudio = { world: { id: "w1", owner_user_id: "user-9" } };
  state.currentUser = { id: "user-9" };
  assert.equal(win.zhimuWorkspace.isWorldOwner("w1"), true);

  state.cloudStudio = null;
  state.cloudWorlds = [{ id: "w2", membership_role: "owner" }];
  assert.equal(win.zhimuWorkspace.isWorldOwner("w2"), true);
});

test("auth-world and account views delegate session context to zhimuContext", () => {
  const authJs = readModule("src/runtime/auth-world.js");
  const accountJs = readModule("src/views/account.js");
  assert.match(authJs, /zhimuContext\?\.resetAccountContext/);
  assert.match(accountJs, /zhimuContext\?\.onSessionLogout/);
  assert.doesNotMatch(authJs, /const resetAccountContext=\(\)=>\{zhimuApi\.resetActiveWorld/);
});

test("data.js delegates ensureActiveWorld and clearRuntimeState to stores", () => {
  const dataJs = readModule("src/runtime/data.js");
  assert.match(dataJs, /zhimuWorkspace/);
  assert.match(dataJs, /zhimuRuntimeStore/);
  assert.match(dataJs, /zhimuRoomEvents/);
  assert.match(dataJs, /function ensureActiveWorld/);
  assert.match(dataJs, /function clearRuntimeState/);
});

test("actions.js delegates to domain action modules", () => {
  const actionsJs = readModule("src/runtime/actions.js");
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
  const wizardJs = readModule("src/views/pipeline-wizard.js");
  assert.match(wizardJs, /zhimuPipelineOpen/);
  assert.ok(wizardJs.split("\n").length < 25, "pipeline-wizard.js should be public entry only");
  const openJs = readModule("src/views/pipeline-wizard-open.js");
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
