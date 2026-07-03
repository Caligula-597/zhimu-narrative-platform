/**
 * Shared status-chip renderer tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { renderStatusChip, renderStatusChipRow, STATUS_CHIP_TONES } from "../shared/components/status-chip.js";

test("renderStatusChip escapes label and applies tone", () => {
  const html = renderStatusChip({ tone: "published", label: "已加入" });
  assert.match(html, /class="status-chip published"/);
  assert.match(html, />已加入</);
});

test("renderStatusChip falls back for unknown tone", () => {
  const html = renderStatusChip({ tone: "unknown", label: "x" });
  assert.match(html, /class="status-chip draft"/);
});

test("renderStatusChip escapes HTML in label", () => {
  const html = renderStatusChip({ tone: "draft", label: '<script>"' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("STATUS_CHIP_TONES includes core tones", () => {
  for (const tone of ["draft", "testing", "published", "danger", "ok"]) {
    assert.ok(STATUS_CHIP_TONES.has(tone));
  }
});

test("renderStatusChipRow wraps content", () => {
  const row = renderStatusChipRow('<span class="status-chip draft">a</span>');
  assert.match(row, /class="status-chips"/);
});
