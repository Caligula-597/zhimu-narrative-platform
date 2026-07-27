import assert from "node:assert/strict";
import test from "node:test";
import {
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
