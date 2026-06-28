/**
 * Modal helper robustness — escapeHtml in studioField/studioSelect.
 *
 * Migrated from vm.runInNewContext to native dynamic import() because
 * src/utils/format.js is now a real ES module (imports from shared/security.js).
 * modal.js is still IIFE + `export {};` but dynamic import handles both forms.
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ── Browser global shims ── */
const noop = () => {};
const storage = { getItem: () => null, setItem: noop, removeItem: noop, clear: noop };
const fakeElement = {
  textContent: "", innerHTML: "", className: "",
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  dataset: {}, addEventListener: noop, removeEventListener: noop,
  querySelector: () => null, querySelectorAll: () => [], appendChild: noop, setAttribute: noop,
  style: {}
};
globalThis.window = {
  zhimuConfig: { apiBase: "/api", demoMode: true, demoUsers: {}, demoWorld: {} },
  zhimuState: {},
  zhimuApi: {},
  zhimuDom: {
    content: null,
    toast: null,
    modal: { className: "", innerHTML: "", querySelector: () => null, querySelectorAll: () => [] },
    modalBackdrop: { classList: { contains: () => false, add: noop, remove: noop }, addEventListener: noop }
  },
  zhimuFormat: null,
  zhimuUi: {}, zhimuToast: {}, zhimuModal: {},
  zhimuRuntime: {}, zhimuViews: {},
  zhimuGo: noop, zhimuRender: noop, zhimuLoadCloudData: async () => {},
  zhimuSessionAuth: {}, zhimuWorldRevision: {},
  localStorage: storage, sessionStorage: storage,
  location: { pathname: "/", search: "", hash: "", hostname: "localhost", port: "4173" },
  addEventListener: noop, removeEventListener: noop,
  crypto: { randomUUID: () => "test-uuid" }
};
globalThis.document = {
  querySelectorAll: () => [],
  querySelector: () => fakeElement,
  documentElement: { classList: { add: noop, remove: noop } },
  body: { classList: { contains: () => false, add: noop, remove: noop }, style: {} },
  addEventListener: noop, removeEventListener: noop
};
globalThis.localStorage = storage;
globalThis.sessionStorage = storage;
globalThis.location = globalThis.window.location;
globalThis.MutationObserver = class MutationObserver { observe() {} disconnect() {} takeRecords() { return []; } };
const navShim = { userAgent: "node-test", clipboard: { writeText: async () => {} } };
try { globalThis.navigator = navShim; } catch { Object.defineProperty(globalThis, "navigator", { value: navShim, writable: true, configurable: true }); }

let M;
test.before(async () => {
  // format.js must load first — modal.js reads window.zhimuFormat at IIFE execution.
  await import(`file://${path.join(root, "src/utils/format.js").replace(/\\/g, "/")}?t=${Date.now()}`);
  await import(`file://${path.join(root, "src/components/modal.js").replace(/\\/g, "/")}?t=${Date.now()}`);
  M = globalThis.window.zhimuModal;
  if (!M) throw new Error("zhimuModal bridge not populated after import");
});

test("studioField escapes HTML in values and labels", () => {
  const html = M.studioField('<img onerror=alert(1)>', "name", "input", '"><script>alert(1)</script>');
  assert.ok(!html.includes("<script>"), "script tag must be escaped");
  assert.ok(html.includes("&lt;img"), "label must be escaped");
  assert.ok(html.includes("&quot;&gt;&lt;script"), "value must be escaped");
});

test("studioOptionsHtml escapes option names and restores selected value", () => {
  const html = M.studioOptionsHtml([
    { id: "", name: "不关联" },
    { id: "asset-1", name: '<b onclick=alert(1)>evil.pdf</b>' }
  ], "asset-1");
  assert.ok(html.includes(" selected"), "selected option must be marked");
  assert.ok(!html.includes("<b onclick"), "option name must be escaped");
});
