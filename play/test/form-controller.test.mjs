import assert from "node:assert/strict";
import test from "node:test";
import { bindPlayFormEvents } from "../src/runtime/form-controller.js";

function createApp() {
  let submit;
  return {
    addEventListener(type, listener) {
      if (type === "submit") submit = listener;
    },
    submit(event) {
      return submit(event);
    }
  };
}

function formEvent(name, form = {}) {
  let prevented = false;
  return {
    event: {
      target: {
        closest(selector) {
          return selector === `[data-form='${name}']` ? form : null;
        }
      },
      preventDefault() { prevented = true; }
    },
    prevented: () => prevented
  };
}

function bind(overrides = {}) {
  const app = createApp();
  const calls = [];
  const handler = (name) => async (form) => calls.push([name, form]);
  const state = { busy: false };
  bindPlayFormEvents({
    app,
    state,
    render() {},
    setToast() {},
    setBusy() {},
    sendVoiceChatMessage: handler("voice"),
    handlePlazaSubmit: handler("plaza"),
    handlePlazaReplySubmit: handler("reply"),
    handlePlayerSearch: handler("search"),
    handleDmSend: handler("dm"),
    handleAuthSubmit: handler("auth"),
    handleForgotSubmit: handler("forgot"),
    handleResetSubmit: handler("reset"),
    handleGuestSubmit: handler("guest"),
    ...overrides
  });
  return { app, state, calls };
}

test("bindPlayFormEvents routes forms and prevents browser submission", async () => {
  const { app, calls } = bind();
  const form = { marker: "auth" };
  const submission = formEvent("auth", form);
  await app.submit(submission.event);
  assert.equal(submission.prevented(), true);
  assert.deepEqual(calls, [["auth", form]]);
});

test("bindPlayFormEvents blocks regular forms while busy", async () => {
  const { app, state, calls } = bind();
  state.busy = true;
  const submission = formEvent("plaza", { marker: "post" });
  await app.submit(submission.event);
  assert.equal(submission.prevented(), true);
  assert.deepEqual(calls, []);
});

test("voice form copies current body and delegates with UI callbacks", async () => {
  const app = createApp();
  const state = { busy: true };
  let delegated = false;
  bindPlayFormEvents({
    app,
    state,
    render() {},
    setToast() {},
    setBusy() {},
    sendVoiceChatMessage: async () => { delegated = true; },
    handlePlazaSubmit() {},
    handlePlazaReplySubmit() {},
    handlePlayerSearch() {},
    handleDmSend() {},
    handleAuthSubmit() {},
    handleForgotSubmit() {},
    handleResetSubmit() {},
    handleGuestSubmit() {}
  });
  const submission = formEvent("voice-send", { body: { value: "现场信息" } });
  await app.submit(submission.event);
  assert.equal(state.voiceChatDraft, "现场信息");
  assert.equal(delegated, true);
});
