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

  const sessionValues = new Map();
  const persistentValues = new Map([["zhimuSessionToken", "persistent-old-token"]]);
  const sessionStorage = {
    getItem: (key) => sessionValues.get(key) ?? null,
    setItem: (key, value) => sessionValues.set(key, String(value)),
    removeItem: (key) => sessionValues.delete(key)
  };
  const localStorage = {
    getItem: (key) => persistentValues.get(key) ?? null,
    setItem: (key, value) => persistentValues.set(key, String(value)),
    removeItem: (key) => persistentValues.delete(key)
  };
  globalThis.localStorage = localStorage;
  globalThis.sessionStorage = sessionStorage;
  globalThis.window = {
    localStorage,
    sessionStorage,
    addEventListener() {}
  };
  await import(`../src/runtime/session-auth.js?race=${Date.now()}`);

  const auth = globalThis.window.zhimuSessionAuth;
  assert.equal(localStorage.getItem("zhimuSessionToken"), null);
  auth.markAuthenticated("old-bearer-token-1234567890");
  assert.equal(sessionStorage.getItem("zhimuSessionToken"), "old-bearer-token-1234567890");
  assert.equal(localStorage.getItem("zhimuSessionToken"), null);
  userStore.set({ currentUser: { id: "user-1" } });
  assert.equal(auth.isAuthenticated(), true);
  assert.equal(auth.discardLegacyToken(), true);
  assert.equal(auth.legacyToken(), null);
  assert.equal(auth.isAuthenticated(), true);
  assert.equal(userStore.get().currentUser?.id, "user-1");

  auth.markAuthenticated("another-stale-bearer-123456");
  assert.equal(auth.legacyToken(), "another-stale-bearer-123456");
  auth.markAuthenticated();
  assert.equal(auth.legacyToken(), null);
  assert.equal(auth.isAuthenticated(), true);

  auth.markLoggedOut();
  assert.equal(auth.isAuthenticated(), false);
  assert.equal(userStore.get().currentUser, null);
});
