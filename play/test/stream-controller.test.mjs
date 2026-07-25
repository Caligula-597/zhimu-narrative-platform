import assert from "node:assert/strict";
import test from "node:test";
import { createPlayStreamController } from "../src/runtime/stream-controller.js";
import { handleRoomEvent } from "../src/room-events.js";

function setup(overrides = {}) {
  const calls = [];
  const state = { view: "game", roomId: "room-1", user: { id: "u1" } };
  const record = (name) => (...args) => calls.push([name, ...args]);
  const controller = createPlayStreamController({
    state, render: record("render"), getSessionToken: () => "token", clearSession: record("clear"),
    connectRoomEvents: record("connect-room"), disconnectRoomEvents: record("disconnect-room"),
    connectPlatformEvents: record("connect-platform"), disconnectPlatformEvents: record("disconnect-platform"),
    refreshVoiceMessages: async () => {}, patchGameView: () => "full", pullRoomData: async () => {},
    coalescedPartialRefresh: async () => {}, setToast: record("toast"), patchGameHostBanner: () => false,
    normalizeMiniGame: (game) => game, getGamePatchCtx: () => ({}), patchSyncChromeOrRender: record("patch"),
    bumpTabPulse() {}, loadPlazaPosts: async () => {}, loadPlazaThread: async () => {},
    loadFriends: async () => {}, loadDmConversations: async () => {}, loadDmThread: async () => {},
    pauseVoiceSession: async () => {}, persistRoom() {}, isUuid: () => true,
    ...overrides
  });
  return { controller, state, calls };
}

test("syncRoomStream connects room and platform streams for an active game", () => {
  const { controller, calls } = setup();
  controller.syncRoomStream();
  assert.deepEqual(calls.map((call) => call[0]), ["connect-room", "connect-platform"]);
});

test("stream status patches chrome only when the value changes", () => {
  const { controller, calls } = setup();
  controller.roomEventCtx.setStreamStatus("connected");
  controller.roomEventCtx.setStreamStatus("connected");
  assert.equal(calls.filter((call) => call[0] === "patch").length, 1);
});

test("auth loss clears both stream contexts and moves to auth", () => {
  const { controller, state, calls } = setup();
  controller.handleAuthLost();
  assert.equal(state.user, null);
  assert.equal(state.view, "auth");
  assert.ok(calls.some((call) => call[0] === "disconnect-room"));
  assert.ok(calls.some((call) => call[0] === "disconnect-platform"));
});

test("player applies mini-game progress and failed completion from room events", async () => {
  const games = [];
  const messages = [];
  const ctx = {
    getView: () => "game",
    getRoomId: () => "room-1",
    getRoleId: () => "role-1",
    setCurrentGame: (game) => games.push(game),
    bumpTabPulse() {},
    onToast: (message) => messages.push(message)
  };
  await handleRoomEvent("room.game_updated", {
    correct: false,
    currentGame: { id: "game-1", gameType: "zhimu_lock", status: "playing", attemptsLeft: 2 }
  }, ctx);
  assert.equal(games.at(-1).attemptsLeft, 2);
  assert.equal(messages.at(-1), "答案不正确，剩余 2 次");

  await handleRoomEvent("room.game_completed", {
    correct: false,
    currentGame: { id: "game-1", gameType: "zhimu_lock", status: "fail", attemptsLeft: 0 }
  }, ctx);
  assert.equal(games.at(-1).status, "fail");
  assert.equal(messages.at(-1), "机关尝试次数已耗尽");
});

test("player reconciles every Host live-operation event with the correct surface", async () => {
  const pulses = [];
  const messages = [];
  const nudges = [];
  let refreshes = 0;
  const ctx = {
    getView: () => "game",
    getRoomId: () => "room-1",
    getRoleId: () => "role-1",
    bumpTabPulse: (tab) => pulses.push(tab),
    onRefresh: async () => { refreshes += 1; },
    onToast: (message) => messages.push(message),
    setHostNudge: (message) => nudges.push(message)
  };

  const events = [
    ["room.clue_granted", { roleSlotId: "role-1", clueId: "clue-1", clueName: "血迹", source: "host_manual" }],
    ["room.clue_revoked", { roleSlotId: "role-1", clueId: "clue-1", clueName: "血迹", source: "host_manual" }],
    ["room.clue_resent", { roleSlotId: "role-1", clueId: "clue-1", clueName: "血迹", source: "host_manual" }],
    ["room.item_granted", { roleSlotId: "role-1", itemId: "item-1", itemName: "钥匙", source: "host_manual" }],
    ["room.section_unlocked", { roleSlotId: "role-1", scriptSectionId: "section-1", source: "host_manual" }],
    ["room.section_relocked", { roleSlotId: "role-1", sectionId: "section-1", source: "host_manual" }],
    ["room.section_skipped", { roleSlotId: "role-1", sectionId: "section-1", source: "host_manual" }],
    ["room.scene_unlocked", { sceneId: "scene-1", sceneName: "大厅", source: "host_manual" }],
    ["room.content_release_changed", { releaseId: "release-2", releaseNumber: 2, direction: "upgrade" }],
    ["room.host_nudge", { roleSlotIds: ["role-1"], message: "请查看新的线索" }]
  ];
  for (const [type, payload] of events) {
    await handleRoomEvent(type, payload, ctx);
  }

  assert.equal(refreshes, 9);
  assert.ok(pulses.includes("clues"));
  assert.ok(pulses.includes("inventory"));
  assert.ok(pulses.includes("sections"));
  assert.ok(pulses.includes("explore"));
  assert.ok(pulses.includes("home"));
  assert.equal(nudges.at(-1), "请查看新的线索");
  assert.ok(messages.some((message) => message.includes("获得线索")));
  assert.ok(messages.some((message) => message.includes("撤回线索")));
  assert.ok(messages.some((message) => message.includes("获得物品")));
  assert.ok(messages.some((message) => message.includes("新分幕")));
  assert.ok(messages.some((message) => message.includes("新场景")));
  assert.ok(messages.some((message) => message.includes("R2")));
});
