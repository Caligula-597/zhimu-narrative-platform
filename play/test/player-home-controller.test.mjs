import assert from "node:assert/strict";
import test from "node:test";
import { createPlayerHomeController } from "../src/runtime/player-home-controller.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function setup(api, overrides = {}) {
  const state = { roomId: "11111111-2222-4333-8444-555555550002", tab: "home" };
  let renders = 0;
  const controller = createPlayerHomeController({
    api, state, render() { renders += 1; }, isUuid: () => true,
    normalizeMiniGame: (game) => game, formatApiError: (_error, fallback) => fallback,
    ensureDefaultVoiceRoom() {}, refreshVoiceMessages: async () => {},
    patchGameView: () => "full", patchSyncChrome() {}, setToast() {},
    ...overrides
  });
  return { controller, state, renders: () => renders };
}

test("core and exploration render without waiting for supplemental slices", async () => {
  const social = deferred();
  const api = {
    playerHomeCore: async () => ({ sections: [{ id: "s1", completed: false }], currentActKey: "a1" }),
    exploration: async () => ({ scenes: [] }),
    playerHomeSocial: () => social.promise
  };
  const { controller, state, renders } = setup(api);
  await controller.pullRoomData();
  assert.equal(state.sectionId, "s1");
  assert.equal(renders(), 1);
  social.resolve({ notes: [{ id: "n1" }] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.home.notes[0].id, "n1");
  assert.equal(renders(), 2);
});

test("partial supplemental requests social and recap concurrently", async () => {
  const starts = [];
  const api = {
    playerHomeCore: async () => ({ sections: [], currentActKey: "a1" }),
    exploration: async () => ({ scenes: [] }),
    playerHomeSocial: async () => { starts.push("social"); return {}; },
    latestRecap: async () => { starts.push("recap"); return { id: "r1" }; }
  };
  const { controller, state } = setup(api);
  await controller.pullRoomData({ partial: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(starts.sort(), ["recap", "social"]);
  assert.equal(state.recapLatest.id, "r1");
});

test("core compatibility falls back only for a missing split endpoint", async () => {
  const api = {
    playerHomeCore: async () => { const error = new Error("missing"); error.status = 404; throw error; },
    playerHome: async () => ({ legacy: true }),
    exploration: async () => ({ scenes: [] }),
    playerHomeSocial: async () => ({})
  };
  const { controller, state } = setup(api);
  await controller.pullRoomData();
  assert.equal(state.home.legacy, true);
});
