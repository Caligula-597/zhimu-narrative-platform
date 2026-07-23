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

test("SSE lifecycle keeps polling and reconnecting when disconnect observers fail", async () => {
  const statuses = [];
  const errors = [];
  let polls = 0;
  const lifecycle = createSseLifecycle({
    eventTarget: null,
    reconnectBaseMs: 10000,
    pollMs: 10000,
    open: async () => {},
    poll: async () => { polls += 1; },
    onDisconnected: async () => { throw new Error("observer failed"); },
    onStatus: (status) => statuses.push(status),
    onError: (error, meta) => errors.push({ error, meta })
  });
  lifecycle.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(errors.some((entry) => entry.meta.phase === "disconnect"), true);
  assert.equal(polls, 1);
  assert.ok(statuses.includes("polling"));
  assert.ok(statuses.includes("reconnecting"));
  lifecycle.stop();
});

test("SSE lifecycle coalesces polling while a fallback refresh is in flight", async () => {
  let releasePoll;
  const pendingPoll = new Promise((resolve) => { releasePoll = resolve; });
  let polls = 0;
  const lifecycle = createSseLifecycle({
    eventTarget: null,
    reconnectBaseMs: 10000,
    pollMs: 1,
    open: async () => {},
    poll: async () => {
      polls += 1;
      await pendingPoll;
    }
  });
  lifecycle.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(polls, 1);
  releasePoll();
  lifecycle.stop();
});

test("SSE lifecycle reconnects a stale-credential 401 without logging out the new session", async () => {
  let authLost = false;
  let errors = 0;
  const lifecycle = createSseLifecycle({
    eventTarget: null,
    reconnectBaseMs: 10000,
    poll: async () => {},
    open: async () => {
      throw Object.assign(new Error("old token rejected"), {
        status: 401,
        staleCredential: true
      });
    },
    onAuthLost: () => { authLost = true; },
    onError: () => { errors += 1; }
  });
  lifecycle.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(authLost, false);
  assert.equal(lifecycle.isActive(), true);
  assert.equal(errors, 1);
  lifecycle.stop();
});

test("SSE lifecycle reconciles periodically while the stream remains connected", async () => {
  const reasons = [];
  let releaseStream;
  const stream = new Promise((resolve) => { releaseStream = resolve; });
  const lifecycle = createSseLifecycle({
    eventTarget: null,
    connectedReconcileMs: 10,
    reconcile: async (reason) => { reasons.push(reason); },
    open: async ({ onConnected }) => {
      await onConnected({});
      await stream;
    }
  });
  lifecycle.start();
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.equal(reasons[0], "connected");
  assert.ok(reasons.filter((reason) => reason === "connected-periodic").length >= 2);
  lifecycle.stop();
  releaseStream();
});

test("SSE lifecycle coalesces slow connected reconciliation", async () => {
  let calls = 0;
  let releasePeriodic;
  const pendingPeriodic = new Promise((resolve) => { releasePeriodic = resolve; });
  let releaseStream;
  const stream = new Promise((resolve) => { releaseStream = resolve; });
  const lifecycle = createSseLifecycle({
    eventTarget: null,
    connectedReconcileMs: 10,
    reconcile: async (reason) => {
      calls += 1;
      if (reason === "connected-periodic") await pendingPeriodic;
    },
    open: async ({ onConnected }) => {
      await onConnected({});
      await stream;
    }
  });
  lifecycle.start();
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.equal(calls, 2);
  releasePeriodic();
  lifecycle.stop();
  releaseStream();
});
