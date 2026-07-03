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
