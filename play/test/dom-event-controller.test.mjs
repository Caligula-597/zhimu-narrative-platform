import assert from "node:assert/strict";
import test from "node:test";
import { bindPlayDomEvents } from "../src/runtime/dom-event-controller.js";

function listenerTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    emit(type, target) {
      return listeners.get(type)?.({ target, key: target?.key });
    }
  };
}

test("bindPlayDomEvents synchronizes simple fields and grouped checkboxes", () => {
  const app = listenerTarget();
  const documentRef = listenerTarget();
  documentRef.querySelectorAll = (selector) => selector.includes("voice")
    ? [{ value: "u1" }, { value: "" }]
    : [{ value: "r1" }, { value: "r2" }];
  const state = {};
  bindPlayDomEvents({
    app,
    state,
    render() {},
    closeModalState() {},
    flushPendingRoomRefresh() {},
    isGameInputFocused: () => false,
    documentRef,
    windowRef: { setTimeout() {} }
  });

  app.emit("input", { dataset: { bind: "notesTitle" }, value: "推理笔记" });
  assert.equal(state.notesDraftTitle, "推理笔记");

  app.emit("change", { matches: (selector) => selector === "[data-voice-invite]", dataset: {} });
  assert.deepEqual(state.voiceInviteUserIds, ["u1"]);
  app.emit("change", { matches: (selector) => selector === "[data-share-role]", dataset: {} });
  assert.deepEqual(state.clueShareRoles, ["r1", "r2"]);
});

test("bindPlayDomEvents handles deferred refresh and Escape modal close", () => {
  const app = listenerTarget();
  const documentRef = listenerTarget();
  const state = { pendingRoomRefresh: true, modal: { kind: "test" } };
  let refreshed = 0;
  let closed = 0;
  let rendered = 0;
  bindPlayDomEvents({
    app,
    state,
    render() { rendered += 1; },
    closeModalState() { closed += 1; },
    flushPendingRoomRefresh() { refreshed += 1; },
    isGameInputFocused: () => false,
    documentRef,
    windowRef: { setTimeout(callback) { callback(); } }
  });

  app.emit("focusout", {});
  documentRef.emit("keydown", { key: "Escape" });
  assert.equal(refreshed, 1);
  assert.equal(closed, 1);
  assert.equal(rendered, 1);
});
