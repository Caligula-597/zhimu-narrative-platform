import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  POLICY_NAME,
  assertSafeProductHtml,
  htmlFragment,
  resetTrustedHtmlPolicyForTests,
  setHtml,
  setText
} from "../shared/safe-dom.js";

test("setHtml uses the named Trusted Types policy when available", () => {
  const previous = globalThis.trustedTypes;
  resetTrustedHtmlPolicyForTests();
  const calls = [];
  globalThis.trustedTypes = {
    createPolicy(name, rules) {
      assert.equal(name, POLICY_NAME);
      return { createHTML(value) { calls.push(value); return rules.createHTML(value); } };
    }
  };
  try {
    const node = { innerHTML: "" };
    setHtml(node, "<b>audited</b>");
    assert.equal(node.innerHTML, "<b>audited</b>");
    assert.deepEqual(calls, ["<b>audited</b>"]);
  } finally {
    globalThis.trustedTypes = previous;
    resetTrustedHtmlPolicyForTests();
  }
});

test("setHtml refuses fail-open when Trusted Types API exists without a usable policy", () => {
  const previous = globalThis.trustedTypes;
  resetTrustedHtmlPolicyForTests();
  globalThis.trustedTypes = {
    createPolicy() {
      throw new Error("policy denied");
    }
  };
  try {
    const node = { innerHTML: "keep" };
    assert.throws(() => setHtml(node, "<b>x</b>"), /policy unavailable/);
    assert.equal(node.innerHTML, "keep");
  } finally {
    globalThis.trustedTypes = previous;
    resetTrustedHtmlPolicyForTests();
  }
});

test("assertSafeProductHtml blocks executable vectors", () => {
  assert.equal(assertSafeProductHtml("<p>ok</p>"), "<p>ok</p>");
  assert.throws(() => assertSafeProductHtml('<img src=x onerror="alert(1)">'), /event handler/);
  assert.throws(() => assertSafeProductHtml("<script>alert(1)</script>"), /script/);
  assert.throws(() => assertSafeProductHtml('<a href="javascript:alert(1)">x</a>'), /scheme/);
  assert.throws(() => assertSafeProductHtml('<a href="java&#x73;cript:alert(1)">x</a>'), /scheme/);
  assert.throws(() => assertSafeProductHtml('<img src="data:image/svg+xml,<svg></svg>">'), /scheme/);
  assert.throws(() => assertSafeProductHtml('<iframe srcdoc="<p>x</p>"></iframe>'), /iframe|srcdoc/);
  assert.throws(() => assertSafeProductHtml('<svg><foreignObject><p>x</p></foreignObject></svg>'), /active document/);
  assert.throws(() => htmlFragment('<meta http-equiv="refresh" content="0">'), /active document/);
});

test("setText never invokes the HTML sink", () => {
  const node = { textContent: "" };
  setText(node, "<script>");
  assert.equal(node.textContent, "<script>");
});

test("migrated public entry points do not bypass the audited HTML sink", () => {
  for (const file of [
    "src/components/creator-guide.js",
    "src/runtime/global-search.js",
    "src/views/pipeline-wizard-open.js",
    "src/views/platform-runtime.js",
    "src/views/player.js",
    "src/views/account.js",
    "src/views/archive.js",
    "src/views/settings.js",
    "src/bootstrap/render-shell.js",
    "src/components/feedback-button.js",
    "src/components/modal.js",
    "src/runtime/dependency-guard.js",
    "src/runtime/wizard.js",
    "src/runtime/world-revision.js",
    "src/views/assets.js",
    "src/views/creator-workspaces.js",
    "src/views/rules.js",
    "src/views/studio.js",
    "play/src/runtime/sync-helpers.js",
    "play/src/runtime/reader.js",
    "play/src/runtime/view-controller.js",
    "host/src/main.js",
    "host/src/components/modal.js",
    "site/main.js",
    "site/pricing-commercial.js"
  ]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\.innerHTML\s*=|insertAdjacentHTML\s*\(/, file);
    assert.match(source, /setHtml\s*\(/, file);
  }
});
