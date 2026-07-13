import assert from "node:assert/strict";
import test from "node:test";
import { createSseLifecycle } from "../shared/sse-lifecycle.js";

test("SSE lifecycle reconciles on connect and reports authentication loss", async () => {
  const statuses = [];
  let authLost = false;
  let reconciled = 0;
  const lifecycle = createSseLifecycle({
    eventTarget: null,
    onStatus: (status) => statuses.push(status),
    reconcile: async () => { reconciled += 1; },
    onAuthLost: async () => { authLost = true; },
    open: async ({ onConnected }) => {
      await onConnected({});
      throw Object.assign(new Error("expired"), { status: 401 });
    }
  });
  lifecycle.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(reconciled, 1);
  assert.equal(authLost, true);
  assert.ok(statuses.includes("connected"));
  assert.equal(lifecycle.isActive(), false);
  lifecycle.stop();
});

test("SSE lifecycle contains synchronous transport failures and enters polling fallback", async () => {
  const statuses = [];
  const errors = [];
  const lifecycle = createSseLifecycle({
    eventTarget: null,
    reconnectBaseMs: 10000,
    onStatus: (status) => statuses.push(status),
    onError: (error, meta) => errors.push({ error, meta }),
    poll: async () => {},
    open: () => { throw new Error("sync transport failure"); }
  });
  lifecycle.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(errors[0]?.meta.phase, "stream");
  assert.ok(statuses.includes("polling"));
  lifecycle.stop();
});
