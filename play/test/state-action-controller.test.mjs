import assert from "node:assert/strict";
import test from "node:test";
import {
  canHandlePlayActionWhileBusy,
  handlePlayStateAction
} from "../src/runtime/state-action-controller.js";

function run(action, state, dataset = {}, overrides = {}) {
  let rendered = 0;
  let persisted;
  const button = { dataset };
  const handled = handlePlayStateAction({
    action,
    button,
    event: { target: button },
    state,
    render() { rendered += 1; },
    closeModalState() {},
    persistGameSidebarCollapsed(value) { persisted = value; },
    ...overrides
  });
  return { handled, rendered, persisted };
}

test("section navigation stays within available sections", () => {
  const state = { sectionId: "b", home: { sections: [{ id: "a" }, { id: "b" }] } };
  assert.equal(run("section-next", state).handled, true);
  assert.equal(state.sectionId, "b");
  run("section-prev", state);
  assert.equal(state.sectionId, "a");
});

test("auth and selection actions update state and render", () => {
  const state = { authMode: "login" };
  const result = run("toggle-auth-mode", state);
  assert.equal(state.authMode, "register");
  assert.equal(result.rendered, 1);
  run("pick-role", state, { roleId: "role-2" });
  assert.equal(state.selectedRoleId, "role-2");
});

test("login navigation remains available while background startup work is busy", () => {
  assert.equal(canHandlePlayActionWhileBusy("show-auth"), true);
  assert.equal(canHandlePlayActionWhileBusy("start-join"), false);
});

test("sidebar action persists the new collapsed state", () => {
  const state = { gameSidebarCollapsed: false };
  const result = run("toggle-sidebar", state);
  assert.equal(state.gameSidebarCollapsed, true);
  assert.equal(result.persisted, true);
});

test("unknown actions remain available to the async dispatcher", () => {
  const result = run("investigate", {});
  assert.equal(result.handled, false);
  assert.equal(result.rendered, 0);
});
