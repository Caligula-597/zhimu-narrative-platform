import assert from "node:assert/strict";
import test from "node:test";
import { handlePlaySessionAction } from "../src/runtime/session-action-controller.js";
import { handlePlayContentAction } from "../src/runtime/content-action-controller.js";
import { handlePlayTabAction } from "../src/runtime/tab-action-controller.js";

const noop = () => {};
const asyncNoop = async () => {};

test("session leave clears room state and returns to landing", async () => {
  const state = { home: {}, recapLatest: {}, recapDetail: {}, view: "game", tab: "story" };
  let disconnected = 0;
  const handled = await handlePlaySessionAction({
    action: "leave-room", button: { dataset: {} }, event: { preventDefault() {} }, state,
    render: noop, normalizeInviteCode: (value) => value, handleLookupInvite: asyncNoop,
    handleJoinRoom: asyncNoop, handleJoinOfficial: asyncNoop, handleResendVerification: asyncNoop,
    goToLanding: asyncNoop, handleGuestSubmit: asyncNoop, handleOAuth: asyncNoop,
    handleLogout: asyncNoop, resetVoiceOnLeave: asyncNoop,
    disconnectRoomEvents() { disconnected += 1; }, roomEventCtx: {}, persistRoom: noop,
    isUuid: () => true, syncPlatformStream: noop, refreshHome: asyncNoop, setToast: noop
  });
  assert.equal(handled, true);
  assert.equal(disconnected, 1);
  assert.equal(state.home, null);
  assert.equal(state.view, "landing");
  assert.equal(state.tab, "home");
});

test("content retry stores exploration failures and releases busy state", async () => {
  const busy = [];
  const state = { roomId: "room-1" };
  const handled = await handlePlayContentAction({
    action: "retry-exploration", button: { dataset: {} }, state,
    api: { exploration: async () => { throw new Error("offline"); } }, render: noop,
    setBusy(value) { busy.push(value); }, setToast: noop,
    formatApiError: (_error, fallback) => fallback, loadRecapDetail: asyncNoop,
    loadRecapSummary: asyncNoop, patchGameHostBanner: () => false,
    handleAddNotebookEntry: asyncNoop, handleDeleteNotebookEntry: asyncNoop
  });
  assert.equal(handled, true);
  assert.equal(state.explorationError, "探索数据加载失败");
  assert.deepEqual(busy, [true, false]);
});

test("tab action updates tab, clears pulse and renders fallback body", async () => {
  const state = { view: "game", tab: "home" };
  const cleared = [];
  let rendered = 0;
  const handled = await handlePlayTabAction({
    action: "switch-tab", button: { dataset: { primaryTab: "story" } }, state,
    render() { rendered += 1; }, gamePatchCtx: {}, flushPendingRoomRefresh: asyncNoop,
    defaultGameTabFor: () => "sections", tabGroupFor: () => ["sections"],
    clearTabPulse: (id) => cleared.push(id), primaryTabFor: () => "story",
    patchGameTabSwitch: () => false, syncPlayUrl: noop, ensureDefaultVoiceRoom: noop,
    refreshVoiceMessages: asyncNoop, loadRecapSummary: asyncNoop, loadMyTimeline: asyncNoop,
    bindPlayReader: noop, pullRoomData: asyncNoop, setToast: noop
  });
  assert.equal(handled, true);
  assert.equal(state.tab, "sections");
  assert.deepEqual(cleared, ["sections"]);
  assert.equal(rendered, 1);
});

test("opening voice reconciles the latest host session policy before drawing controls", async () => {
  const state = {
    view: "game",
    tab: "home",
    roomId: "room-1",
    home: { voicePolicy: { privateRoomsEnabled: false } }
  };
  const calls = [];
  const handled = await handlePlayTabAction({
    action: "switch-tab",
    button: { dataset: { tab: "voice" } },
    state,
    render: noop,
    gamePatchCtx: {},
    flushPendingRoomRefresh: asyncNoop,
    defaultGameTabFor: () => "voice",
    tabGroupFor: () => ["voice"],
    clearTabPulse: noop,
    primaryTabFor: () => "voice",
    patchGameTabSwitch: () => true,
    syncPlayUrl: noop,
    ensureDefaultVoiceRoom: () => { state.voiceRoomId = "voice-main"; },
    refreshVoiceMessages: async () => { calls.push("messages"); },
    loadRecapSummary: asyncNoop,
    loadMyTimeline: asyncNoop,
    bindPlayReader: noop,
    pullRoomData: async () => {
      calls.push("room");
      state.home.voicePolicy = { privateRoomsEnabled: true, roomStatus: "active" };
    },
    setToast: noop
  });

  assert.equal(handled, true);
  assert.deepEqual(calls, ["room", "messages"]);
  assert.equal(state.home.voicePolicy.privateRoomsEnabled, true);
});

test("remaining controllers leave unknown actions unhandled", async () => {
  assert.equal(await handlePlayContentAction({ action: "unknown" }), false);
  assert.equal(await handlePlaySessionAction({ action: "unknown" }), false);
  assert.equal(await handlePlayTabAction({ action: "unknown" }), false);
});
