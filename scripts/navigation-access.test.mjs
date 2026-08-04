import assert from "node:assert/strict";
import test from "node:test";
import {
  claimDynamicModuleReload,
  isDynamicModuleLoadError,
  navigationAccess,
  viewModuleErrorMessage
} from "../src/runtime/navigation-access.js";

test("guest navigation stays on the public cockpit and guards protected sidebar views", () => {
  assert.equal(navigationAccess("creatorCockpit"), "allowed");
  for (const view of [
    "constitution",
    "diagnostics",
    "writer",
    "studio",
    "clues",
    "settings",
    "account"
  ]) {
    assert.equal(navigationAccess(view), "authentication-required", view);
  }
});

test("navigation waits for the initial auth probe and allows authenticated users", () => {
  assert.equal(navigationAccess("writer", { authStatus: "checking" }), "checking");
  assert.equal(navigationAccess("writer", { authenticated: true }), "allowed");
});

test("dynamic module fetch failures receive a refresh-specific recovery message", () => {
  const error = new TypeError(
    "Failed to fetch dynamically imported module: https://app.getzhimu.com/assets/writer-example.js"
  );
  assert.equal(isDynamicModuleLoadError(error), true);
  assert.match(viewModuleErrorMessage(error), /页面刚刚完成更新/);
  assert.equal(isDynamicModuleLoadError(new Error("ordinary failure")), false);
});

test("a stale dynamic module automatically reloads only once per failure signature", () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) || null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
  const firstError = new TypeError(
    "Failed to fetch dynamically imported module: https://app.getzhimu.com/assets/writer-old.js"
  );
  const nextReleaseError = new TypeError(
    "Failed to fetch dynamically imported module: https://app.getzhimu.com/assets/writer-new.js"
  );

  assert.equal(claimDynamicModuleReload(firstError, { storage, now: 1000 }), true);
  assert.equal(claimDynamicModuleReload(firstError, { storage, now: 2000 }), false);
  assert.equal(claimDynamicModuleReload(nextReleaseError, { storage, now: 3000 }), true);
  assert.equal(claimDynamicModuleReload(new Error("ordinary failure"), { storage, now: 4000 }), false);
});
