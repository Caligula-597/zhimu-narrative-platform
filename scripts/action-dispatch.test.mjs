import assert from "node:assert/strict";
import test from "node:test";
import { dispatchActionHandlers } from "../shared/action-dispatch.js";

test("async handler returning false does not swallow later domain actions", async () => {
  const calls = [];
  const handled = await dispatchActionHandlers([
    async () => {
      calls.push("creator-cockpit");
      return false;
    },
    async () => {
      calls.push("bible");
      return false;
    },
    () => {
      calls.push("writer");
      return true;
    },
    () => {
      calls.push("should-not-run");
      return true;
    }
  ], "creator-edit-role", {});

  assert.equal(handled, true);
  assert.deepEqual(calls, ["creator-cockpit", "bible", "writer"]);
});

test("dispatch reports unhandled only after sync and async handlers decline", async () => {
  const handled = await dispatchActionHandlers([() => false, async () => false], "unknown", null);
  assert.equal(handled, false);
});
