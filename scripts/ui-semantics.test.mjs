import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const noop = () => {};

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
  zhimuDom: { toast: fakeToast },
  zhimuUi: {},
  zhimuWorkspace: {},
  zhimuFormat: {
    escapeHtml: (value = "") => String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[ch])
  },
  zhimuStatus: {
    normalizeError: (error, fallback) => error?.message || fallback
  }
};

globalThis.document = {
  querySelector: () => null,
  createElement: () => ({ className: "", textContent: "", style: {}, classList: { add: noop, remove: noop } })
};

async function loadSemantics() {
  toasts = [];
  await import(`file://${path.join(root, "src/components/ui-semantics.js").replace(/\\/g, "/")}?t=${Date.now()}-${Math.random()}`);
  return { S: globalThis.window.zhimuUiSemantics, toasts };
}

test("ui semantics exposes unified surface tokens and status chips", async () => {
  const { S } = await loadSemantics();
  assert.equal(S.surface("creator").className, "surface-creator");
  assert.equal(S.surface("host").className, "surface-host");
  assert.equal(S.status("room", "connected").tone, "published");
  assert.match(S.chip("clue", "public"), /status-chip published/);
  assert.match(S.chip("player", "stuck"), /status-chip testing/);
});

test("showError normalizes errors through toast", async () => {
  const { S, toasts } = await loadSemantics();
  const message = S.showError(new Error("boom"), "fallback");
  assert.equal(message, "boom");
  assert.deepEqual(toasts, ["boom"]);
});

test("apiCall handles success, errors, and finally hook", async () => {
  const { S, toasts } = await loadSemantics();
  let cleaned = 0;
  const result = await S.apiCall(async () => 7, { success: (value) => `done ${value}`, finally: () => cleaned++ });
  assert.equal(result, 7);
  assert.equal(cleaned, 1);
  assert.deepEqual(toasts, ["done 7"]);

  await assert.rejects(
    S.apiCall(async () => { throw new Error("bad request"); }, { error: "fallback", finally: () => cleaned++ }),
    /bad request/
  );
  assert.equal(cleaned, 2);
  assert.deepEqual(toasts, ["done 7", "bad request"]);
});
