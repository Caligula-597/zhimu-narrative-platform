/**
 * Pure helper robustness tests — run without browser or backend.
 * Usage: node --test scripts/format-helpers.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadFormat() {
  const raw = fs.readFileSync(path.join(root, "src/utils/format.js"), "utf8");
  const code = raw.replace(/\nexport \{\};?\s*$/, "");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.zhimuFormat;
}

test("hostAuditActionLabel maps known actions and falls back safely", () => {
  const F = loadFormat();
  assert.equal(F.hostAuditActionLabel("host_event_delayed"), "延迟待确认事件");
  assert.equal(F.hostAuditActionLabel("checkpoint_restore"), "存档点恢复");
  assert.equal(F.hostAuditActionLabel(""), "主持操作");
  assert.equal(F.hostAuditActionLabel("custom_action"), "custom_action");
});

test("hostAuditDetail renders human summaries for audit metadata", () => {
  const F = loadFormat();
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
  const F = loadFormat();
  assert.equal(F.checkpointRestoreStatusLabel("applied"), "已应用");
  assert.equal(F.checkpointRestoreStatusLabel("failed"), "失败");
});

test("escapeHtml neutralizes XSS-sensitive characters", () => {
  const F = loadFormat();
  assert.equal(F.escapeHtml(`<script>"'&</script>`), "&lt;script&gt;&quot;&#39;&amp;&lt;/script&gt;");
  assert.equal(F.escapeHtml(null), "");
});

test("formatRelativeTime handles empty and recent values", () => {
  const F = loadFormat();
  assert.equal(F.formatRelativeTime(""), "");
  assert.equal(F.formatRelativeTime(new Date().toISOString()), "刚刚");
});
