/**
 * Modal helper robustness — escapeHtml in studioField/studioSelect.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadModalHelpers() {
  const formatRaw = fs.readFileSync(path.join(root, "src/utils/format.js"), "utf8");
  const formatCode = formatRaw.replace(/\nexport \{\};?\s*$/, "");
  const modalRaw = fs.readFileSync(path.join(root, "src/components/modal.js"), "utf8");
  const modalCode = modalRaw.replace(/\nexport \{\};?\s*$/, "");
  const sandbox = {
    window: {
      zhimuDom: {
        content: null,
        toast: null,
        modal: { className: "", innerHTML: "", querySelector: () => null, querySelectorAll: () => [] },
        modalBackdrop: { classList: { contains: () => false, add: () => {}, remove: () => {} }, addEventListener: () => {} }
      },
      zhimuState: {},
      zhimuApi: {},
      zhimuFormat: null,
      zhimuUi: {},
      zhimuToast: {},
      zhimuModal: {},
      zhimuRuntime: {},
      zhimuViews: {},
      zhimuGo: () => {},
      zhimuRender: () => {},
      zhimuLoadCloudData: async () => {}
    },
    document: { querySelectorAll: () => [], documentElement: { classList: { add: () => {}, remove: () => {} } }, body: { classList: { contains: () => false, add: () => {}, remove: () => {} }, style: {} } },
    MutationObserver: class { observe() {} }
  };
  vm.runInNewContext(formatCode, sandbox);
  vm.runInNewContext(modalCode, sandbox);
  return sandbox.window.zhimuModal;
}

test("studioField escapes HTML in values and labels", () => {
  const M = loadModalHelpers();
  const html = M.studioField('<img onerror=alert(1)>', "name", "input", '"><script>alert(1)</script>');
  assert.ok(!html.includes("<script>"), "script tag must be escaped");
  assert.ok(html.includes("&lt;img"), "label must be escaped");
  assert.ok(html.includes("&quot;&gt;&lt;script"), "value must be escaped");
});

test("studioOptionsHtml escapes option names and restores selected value", () => {
  const M = loadModalHelpers();
  const html = M.studioOptionsHtml([
    { id: "", name: "不关联" },
    { id: "asset-1", name: '<b onclick=alert(1)>evil.pdf</b>' }
  ], "asset-1");
  assert.ok(html.includes(" selected"), "selected option must be marked");
  assert.ok(!html.includes("<b onclick"), "option name must be escaped");
});
