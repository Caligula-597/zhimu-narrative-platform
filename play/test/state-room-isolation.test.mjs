import assert from "node:assert/strict";
import test from "node:test";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

globalThis.localStorage = createStorage();

const { GAME_SECTION_KEY, GAME_TAB_KEY, persistRoom, state } = await import(
  `../src/state.js?room-isolation=${Date.now()}`
);

const OLD_ROOM = "11111111-2222-4333-8444-555555550001";
const NEW_ROOM = "11111111-2222-4333-8444-555555550002";
const isUuid = (value) => value === OLD_ROOM || value === NEW_ROOM;

function seedPrivateRoomState() {
  Object.assign(state, {
    roomId: OLD_ROOM,
    home: { room: { id: OLD_ROOM }, privateMarker: "old-room-home" },
    playableRuntime: { view: { role: { secret: "old-room-secret" } } },
    exploration: { scenes: [{ privateText: "old-room-scene" }] },
    discoverySessions: [{ key: "old-room-discovery" }],
    paceClock: { remainingSeconds: 30 },
    sessionConclusion: { status: "ready" },
    itemActions: [{ id: "old-room-item-action" }],
    relationships: [{ id: "old-room-relationship" }],
    tab: "clues",
    sectionId: "old-room-section",
    clueId: "old-room-clue",
    bookletId: "old-room-booklet",
    selectedRoleId: "old-room-role",
    recapLatest: { id: "old-room-recap" },
    recapDetail: { privateText: "old-room-recap-detail" },
    myTimeline: { events: [{ id: "old-room-event" }] },
    notesDraft: "old-room-note",
    modal: { kind: "clue", privateText: "old-room-modal" },
    voiceRoomId: "old-room-voice",
    voiceMessages: [{ body: "old-room-message" }],
    hostNudge: { message: "old-room-nudge" },
    currentGame: { id: "old-room-game" },
    roomEventsConnected: true,
    roomEventsStatus: "connected",
    roomSyncDiagnostics: { lastEventId: "old-room-event" },
    pendingRoomRefresh: true,
    tabPulse: { ...state.tabPulse, clues: true },
    tabPulseCount: { ...state.tabPulseCount, clues: 2 }
  });
  localStorage.setItem(GAME_TAB_KEY, "clues");
  localStorage.setItem(GAME_SECTION_KEY, "old-room-section");
}

test("switching rooms clears every private runtime projection before the next room loads", () => {
  seedPrivateRoomState();

  persistRoom(NEW_ROOM, isUuid);

  assert.equal(state.roomId, NEW_ROOM);
  assert.equal(state.home, null);
  assert.equal(state.playableRuntime, null);
  assert.equal(state.exploration, null);
  assert.deepEqual(state.discoverySessions, []);
  assert.equal(state.paceClock, null);
  assert.equal(state.sessionConclusion, null);
  assert.deepEqual(state.itemActions, []);
  assert.deepEqual(state.relationships, []);
  assert.equal(state.tab, "home");
  assert.equal(state.sectionId, "");
  assert.equal(state.clueId, "");
  assert.equal(state.bookletId, "");
  assert.equal(state.selectedRoleId, "");
  assert.equal(state.recapLatest, null);
  assert.equal(state.recapDetail, null);
  assert.equal(state.myTimeline, null);
  assert.equal(state.notesDraft, "");
  assert.equal(state.modal, null);
  assert.equal(state.voiceRoomId, "");
  assert.deepEqual(state.voiceMessages, []);
  assert.equal(state.hostNudge, null);
  assert.equal(state.currentGame, null);
  assert.equal(state.roomEventsConnected, false);
  assert.equal(state.roomEventsStatus, "idle");
  assert.notEqual(state.roomSyncDiagnostics.lastEventId, "old-room-event");
  assert.equal(state.pendingRoomRefresh, false);
  assert.equal(state.tabPulse.clues, false);
  assert.equal(state.tabPulseCount.clues, 0);
  assert.equal(localStorage.getItem(GAME_TAB_KEY), null);
  assert.equal(localStorage.getItem(GAME_SECTION_KEY), null);
});

test("persisting the same room does not discard the active projection", () => {
  seedPrivateRoomState();

  persistRoom(OLD_ROOM, isUuid);

  assert.equal(state.home.privateMarker, "old-room-home");
  assert.equal(state.playableRuntime.view.role.secret, "old-room-secret");
  assert.equal(state.currentGame.id, "old-room-game");
});
