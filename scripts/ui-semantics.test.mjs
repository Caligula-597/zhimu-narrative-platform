import assert from "node:assert/strict";
import test from "node:test";

const noop = () => {};
const storage = {
  getItem: () => null,
  setItem: noop,
  removeItem: noop,
  clear: noop
};

let toasts = [];
const fakeToast = {
  _text: "",
  get textContent() {
    return this._text;
  },
  set textContent(value) {
    this._text = String(value);
    toasts.push(this._text);
  },
  classList: { add: noop, remove: noop }
};

globalThis.window = {
  zhimuState: { cloudHostEvents: [] },
  zhimuWorkspace: {},
  zhimuStatus: {
    normalizeError: (error, fallback) => error?.message || fallback
  },
  localStorage: storage,
  sessionStorage: storage,
  location: { hostname: "localhost", port: "4173" }
};
globalThis.localStorage = storage;
globalThis.sessionStorage = storage;

globalThis.document = {
  querySelector: (selector) => selector === "#toast" ? fakeToast : null,
  createElement: () => ({ className: "", textContent: "", style: {}, classList: { add: noop, remove: noop } })
};

const { surface, status, chip, showError, showSuccess, apiCall } = await import("../src/components/ui-semantics.js");

test("ui semantics exposes unified surface tokens and status chips", () => {
  assert.equal(surface("creator").className, "surface-creator");
  assert.equal(surface("host").className, "surface-host");
  assert.equal(status("room", "connected").tone, "published");
  assert.match(chip("clue", "public"), /status-chip published/);
  assert.match(chip("player", "stuck"), /status-chip testing/);
});

test("showError normalizes errors through toast", () => {
  toasts = [];
  const message = showError(new Error("boom"), "fallback");
  assert.equal(message, "boom");
  assert.deepEqual(toasts, ["boom"]);
});

test("apiCall handles success, errors, and finally hook", async () => {
  toasts = [];
  let cleaned = 0;
  const result = await apiCall(async () => 7, { success: (value) => `done ${value}`, finally: () => cleaned++ });
  assert.equal(result, 7);
  assert.equal(cleaned, 1);
  assert.deepEqual(toasts, ["done 7"]);

  toasts = [];
  await assert.rejects(
    apiCall(async () => { throw new Error("bad request"); }, { error: "fallback", finally: () => cleaned++ }),
    /bad request/
  );
  assert.equal(cleaned, 2);
  assert.deepEqual(toasts, ["bad request"]);
});
