import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { POLICY_NAME, setHtml, setText } from "../shared/safe-dom.js";

test("setHtml uses the named Trusted Types policy when available", () => {
  const previous = globalThis.trustedTypes;
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
  }
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
    "app.js",
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
    "play/src/runtime/view-controller.js"
  ]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\.innerHTML\s*=|insertAdjacentHTML\s*\(/, file);
    assert.match(source, /setHtml\s*\(/, file);
  }
});
