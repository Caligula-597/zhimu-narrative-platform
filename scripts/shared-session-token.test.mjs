/**
 * Shared session-token store tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createSessionTokenStore } from "../shared/session-token.js";

test("session token store set/get/clear", () => {
  const map = new Map();
  const storage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k)
  };
  const store = createSessionTokenStore("test-token", storage);
  assert.equal(store.get(), "");
  store.set("tok-1");
  assert.equal(store.get(), "tok-1");
  assert.deepEqual(store.bearerHeaders(), { authorization: "Bearer tok-1" });
  store.clear();
  assert.equal(store.get(), "");
});

test("session token store falls back to memory when browser storage throws", () => {
  const storage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); }
  };
  const store = createSessionTokenStore("test-token", storage);
  store.set("memory-token");
  assert.equal(store.get(), "memory-token");
  assert.deepEqual(store.bearerHeaders(), { authorization: "Bearer memory-token" });
  store.clear();
  assert.equal(store.get(), "");
});

test("session token store propagates cross-tab storage changes once", () => {
  const handlers = new Map();
  const eventTarget = {
    addEventListener(type, handler) { handlers.set(type, handler); }
  };
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };
  const store = createSessionTokenStore("test-token", storage, eventTarget);
  const changes = [];
  const unsubscribe = store.subscribe((change) => changes.push(change));
  handlers.get("storage")({ key: "other", oldValue: null, newValue: "ignored" });
  handlers.get("storage")({ key: "test-token", oldValue: null, newValue: "tab-token" });
  handlers.get("storage")({ key: "test-token", oldValue: "tab-token", newValue: null });
  unsubscribe();
  handlers.get("storage")({ key: "test-token", oldValue: null, newValue: "late" });

  assert.deepEqual(changes, [
    { token: "tab-token", previousToken: "", source: "storage" },
    { token: "", previousToken: "tab-token", source: "storage" }
  ]);
});

test("session token store suppresses duplicate local notifications", () => {
  const map = new Map();
  const storage = {
    getItem: (key) => map.get(key) || null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key)
  };
  const store = createSessionTokenStore("test-token", storage, null);
  const changes = [];
  store.subscribe((change) => changes.push(change));
  store.set("one");
  store.set("one");
  store.clear();
  store.clear();
  assert.equal(changes.length, 2);
});

test("session token store preserves the invalidation source", () => {
  const map = new Map([["test-token", "expired"]]);
  const storage = {
    getItem: (key) => map.get(key) || null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key)
  };
  const store = createSessionTokenStore("test-token", storage, null);
  const changes = [];
  store.subscribe((change) => changes.push(change));
  store.clear("rejected");
  assert.deepEqual(changes, [{ token: "", previousToken: "expired", source: "rejected" }]);
});

test("session token store removes the persistent localStorage predecessor", () => {
  const sessionValues = new Map();
  const legacyValues = new Map([["test-token", "persistent-old-token"]]);
  const session = {
    getItem: (key) => sessionValues.get(key) ?? null,
    setItem: (key, value) => sessionValues.set(key, String(value)),
    removeItem: (key) => sessionValues.delete(key)
  };
  const legacy = {
    getItem: (key) => legacyValues.get(key) ?? null,
    setItem: (key, value) => legacyValues.set(key, String(value)),
    removeItem: (key) => legacyValues.delete(key)
  };

  const store = createSessionTokenStore("test-token", session, null, legacy);
  assert.equal(legacy.getItem("test-token"), null);
  assert.equal(store.get(), "");

  legacy.setItem("test-token", "written-by-an-old-client");
  store.set("tab-token");
  assert.equal(legacy.getItem("test-token"), null);
  assert.equal(store.get(), "tab-token");
});
