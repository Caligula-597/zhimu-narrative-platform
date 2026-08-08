import assert from "node:assert/strict";
import test from "node:test";
import { createAdaptivePoller } from "../shared/adaptive-poller.js";

function createEventTarget(initialVisibility = "visible") {
  const listeners = new Map();
  const documentListeners = new Map();
  const add = (map, type, listener) => {
    const current = map.get(type) || new Set();
    current.add(listener);
    map.set(type, current);
  };
  const remove = (map, type, listener) => map.get(type)?.delete(listener);
  const dispatch = (map, type) => {
    for (const listener of map.get(type) || []) listener();
  };
  const target = {
    addEventListener: (type, listener) => add(listeners, type, listener),
    removeEventListener: (type, listener) => remove(listeners, type, listener),
    dispatch: (type) => dispatch(listeners, type),
    document: {
      visibilityState: initialVisibility,
      addEventListener: (type, listener) => add(documentListeners, type, listener),
      removeEventListener: (type, listener) => remove(documentListeners, type, listener),
      dispatch: (type) => dispatch(documentListeners, type)
    }
  };
  return target;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("adaptive poller coalesces slow work and stops scheduling after teardown", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  let runs = 0;
  const poller = createAdaptivePoller({
    intervalMs: 1,
    maxIntervalMs: 2,
    jitterRatio: 0,
    eventTarget: null,
    run: async () => {
      runs += 1;
      await pending;
    }
  });
  poller.start();
  await wait(10);
  assert.equal(runs, 1);
  assert.equal(poller.isRunning(), true);
  poller.stop();
  release();
  await wait(10);
  assert.equal(runs, 1);
  assert.equal(poller.isActive(), false);
});

test("adaptive poller pauses in hidden tabs and recovers immediately when visible", async () => {
  const eventTarget = createEventTarget("hidden");
  let runs = 0;
  const poller = createAdaptivePoller({
    intervalMs: 1000,
    eventTarget,
    run: () => { runs += 1; }
  });
  poller.start();
  await wait(5);
  assert.equal(runs, 0);
  assert.equal(poller.getSnapshot().status, "paused");
  eventTarget.document.visibilityState = "visible";
  eventTarget.document.dispatch("visibilitychange");
  await wait(5);
  assert.equal(runs, 1);
  poller.stop();
});

test("adaptive poller backs off failures and resets on a successful recovery run", async () => {
  const errors = [];
  let shouldFail = true;
  const poller = createAdaptivePoller({
    intervalMs: 5,
    maxIntervalMs: 20,
    jitterRatio: 0,
    eventTarget: null,
    onError: (_error, meta) => errors.push(meta),
    run: () => {
      if (shouldFail) throw new Error("offline");
    }
  });
  poller.start();
  await wait(4);
  assert.equal(errors[0]?.failures, 1);
  assert.equal(errors[0]?.nextRunInMs, 10);
  shouldFail = false;
  await poller.runNow("manual-recovery");
  assert.equal(poller.getSnapshot().failures, 0);
  poller.stop();
});
