import assert from "node:assert/strict";
import test from "node:test";
import { userStore } from "../src/state/index.js";

test("Creator can discard a rejected legacy bearer without hiding a valid cookie session", async (context) => {
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  const previousSessionStorage = globalThis.sessionStorage;
  context.after(() => {
    globalThis.window = previousWindow;
    globalThis.localStorage = previousStorage;
    globalThis.sessionStorage = previousSessionStorage;
    userStore.set({ currentUser: null });
  });

  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
  globalThis.localStorage = storage;
  globalThis.sessionStorage = storage;
  globalThis.window = {
    localStorage: storage,
    sessionStorage: storage,
    addEventListener() {}
  };
  await import(`../src/runtime/session-auth.js?race=${Date.now()}`);

  const auth = globalThis.window.zhimuSessionAuth;
  auth.markAuthenticated("old-bearer-token-1234567890");
  userStore.set({ currentUser: { id: "user-1" } });
  assert.equal(auth.isAuthenticated(), true);
  assert.equal(auth.discardLegacyToken(), true);
  assert.equal(auth.legacyToken(), null);
  assert.equal(auth.isAuthenticated(), true);
  assert.equal(userStore.get().currentUser?.id, "user-1");

  auth.markLoggedOut();
  assert.equal(auth.isAuthenticated(), false);
  assert.equal(userStore.get().currentUser, null);
});
