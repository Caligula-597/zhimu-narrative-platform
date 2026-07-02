/**
 * Pure helper robustness tests — run without browser or backend.
 * Usage: node --test scripts/format-helpers.test.mjs
 *
 * Tests import src/utils/format.js directly; no window bridge is expected.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ── Browser global shims for transitive browser-only assumptions ── */
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
  zhimuState: null, zhimuApi: null,
  zhimuDom: { content: fakeElement, toast: fakeElement, modal: fakeElement, modalBackdrop: fakeElement },
  location: { pathname: "/", search: "", hash: "", hostname: "localhost", port: "4173" },
  zhimuToast: {},
  zhimuViews: {}, zhimuRuntime: {}, zhimuRuleVisual: {},
  zhimuUserMessages: { friendlyApiError: (p, fb) => p?.error || fb },
  zhimuSessionAuth: {}, zhimuWorldRevision: {},
  localStorage: storage, sessionStorage: storage,
  addEventListener: noop, removeEventListener: noop,
  crypto: { randomUUID: () => "test-uuid" }
};
globalThis.document = {
  getElementById: () => null, querySelector: () => fakeElement, querySelectorAll: () => [],
  addEventListener: noop, removeEventListener: noop, createElement: () => fakeElement,
  body: fakeElement, head: fakeElement
};
globalThis.localStorage = storage;
globalThis.sessionStorage = storage;
globalThis.location = globalThis.window.location;
const navShim = { userAgent: "node-test", clipboard: { writeText: async () => {} } };
try { globalThis.navigator = navShim; } catch { Object.defineProperty(globalThis, "navigator", { value: navShim, writable: true, configurable: true }); }

let F;
test.before(async () => {
  F = await import(`file://${path.join(root, "src/utils/format.js").replace(/\\/g, "/")}?t=${Date.now()}`);
  if (typeof F.escapeHtml !== "function") throw new Error("format helper exports missing");
});

test("hostAuditActionLabel maps known actions and falls back safely", () => {
  assert.equal(F.hostAuditActionLabel("host_event_delayed"), "延迟待确认事件");
  assert.equal(F.hostAuditActionLabel("checkpoint_restore"), "存档点恢复");
  assert.equal(F.hostAuditActionLabel(""), "主持操作");
  assert.equal(F.hostAuditActionLabel("custom_action"), "custom_action");
});

test("hostAuditDetail renders human summaries for audit metadata", () => {
  assert.match(
    F.hostAuditDetail({ action: "host_event_delayed", metadata: { delayMinutes: 30 } }),
    /30/
  );
  assert.match(
    F.hostAuditDetail({ action: "host_grant_clue", metadata: { roleSlotIds: ["a", "b"] } }),
    /2 名玩家/
  );
  assert.match(
    F.hostAuditDetail({
      action: "checkpoint_restore",
      metadata: { scope: { readingProgress: true, inventory: true }, crossRoom: true }
    }),
    /跨平行房/
  );
  assert.equal(F.hostAuditDetail({ action: "unknown", metadata: {} }), "");
});

test("checkpointRestoreStatusLabel maps restore statuses", () => {
  assert.equal(F.checkpointRestoreStatusLabel("applied"), "已应用");
  assert.equal(F.checkpointRestoreStatusLabel("failed"), "失败");
});

test("escapeHtml neutralizes XSS-sensitive characters", () => {
  assert.equal(F.escapeHtml(`<script>"'&</script>`), "&lt;script&gt;&quot;&#39;&amp;&lt;/script&gt;");
  assert.equal(F.escapeHtml(null), "");
});

test("formatRelativeTime handles empty and recent values", () => {
  assert.equal(F.formatRelativeTime(""), "");
  assert.equal(F.formatRelativeTime(new Date().toISOString()), "刚刚");
});

test("src no longer consumes or publishes zhimuFormat window bridge", () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".js")) files.push(full);
    }
  };
  walk(path.join(root, "src"));
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /window\.zhimuFormat|const F = window\.zhimuFormat/, path.relative(root, file));
  }
});
