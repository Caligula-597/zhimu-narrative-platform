/**
 * Shared toast helper tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createToastTimer, renderToastHostHtml } from "../shared/toast.js";

test("createToastTimer schedules once", async () => {
  const timer = createToastTimer(20);
  let fired = 0;
  timer.schedule(() => {
    fired += 1;
  }, 15);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(fired, 1);
});

test("renderToastHostHtml escapes message", () => {
  const html = renderToastHostHtml("<bad>");
  assert.match(html, /&lt;bad&gt;/);
  assert.match(html, /toast-host/);
});
