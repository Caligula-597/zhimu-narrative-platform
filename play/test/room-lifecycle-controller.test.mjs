import assert from "node:assert/strict";
import test from "node:test";
import { createRoomLifecycleController } from "../src/runtime/room-lifecycle-controller.js";

const ROOM_ID = "11111111-2222-4333-8444-555555550002";

function setup(api, overrides = {}) {
  const state = { inviteCode: " ABC123 ", selectedRoleId: "", view: "join" };
  const toasts = [];
  const calls = { refreshHome: 0, persistedRoom: "" };
  const controller = createRoomLifecycleController({
    api,
    state,
    render() {},
    setBusy() {},
    setToast(message) { toasts.push(message); },
    formatApiError: (_error, fallback) => fallback,
    normalizeInviteCode: (value) => value.trim(),
    ensureSession: async () => {},
    persistRoom(roomId) { calls.persistedRoom = roomId; state.roomId = roomId; },
    persistGameSession() {},
    isUuid: (value) => value === ROOM_ID,
    cleanAuthUrl() {},
    pullRoomData: async () => { state.home = { sections: [] }; },
    syncRoomStream() {},
    syncPlatformStream() {},
    disconnectRoomEvents() {},
    roomEventCtx: {},
    pauseVoiceSession: async () => {},
    loadRecapSummary: async () => {},
    loadDmConversations: async () => {},
    ...overrides
  });
  return { controller, state, toasts, calls };
}

test("bound role invite returns to the room without throwing after success", async () => {
  const { controller, state, toasts, calls } = setup({
    lookupInvite: async () => ({
      room: { id: ROOM_ID },
      current_role_slot_id: "role-1",
      roles: [{ id: "role-1", occupied: true, occupied_by_current: true }]
    })
  });

  await controller.handleLookupInvite();

  assert.equal(calls.persistedRoom, ROOM_ID);
  assert.equal(state.view, "game");
  assert.equal(state.selectedRoleId, "role-1");
  assert.ok(toasts.some((message) => message.includes("绑定")));
});

test("join rechecks occupancy before issuing the write", async () => {
  let joins = 0;
  const { controller, state, toasts } = setup({
    lookupInvite: async () => ({
      room: { id: ROOM_ID },
      roles: [{ id: "role-1", occupied: true, occupied_by_current: false }]
    }),
    joinRoom: async () => { joins += 1; return { roomId: ROOM_ID }; }
  });
  state.selectedRoleId = "role-1";

  await controller.handleJoinRoom();

  assert.equal(joins, 0);
  assert.equal(state.joinStep, 2);
  assert.ok(toasts.length > 0);
});
