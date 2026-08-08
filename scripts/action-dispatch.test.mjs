import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { dispatchActionHandlers } from "../shared/action-dispatch.js";
import { BIBLE_ACTIONS, ownsBibleAction, ownsCreatorCockpitAction } from "../src/runtime/action-ownership.js";

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

test("domain preconditions cannot swallow actions owned by another module", () => {
  assert.equal(ownsCreatorCockpitAction("delete-relationship-inline"), false);
  assert.equal(ownsBibleAction("delete-relationship-inline"), false);
  assert.equal(ownsCreatorCockpitAction("cockpit-add-role"), true);
  assert.equal(ownsBibleAction("save-role-archive"), true);
});

test("Bible action ownership stays aligned with its switch cases", () => {
  const source = fs.readFileSync(new URL("../src/runtime/actions-bible.js", import.meta.url), "utf8");
  const cases = new Set([...source.matchAll(/case\s+"([^"]+)"\s*:/g)].map((match) => match[1]));
  assert.deepEqual([...BIBLE_ACTIONS].sort(), [...cases].sort());
});

test("writer lazy bundle loads the Bible handler used by role archives", () => {
  const source = fs.readFileSync(new URL("../src/runtime/view-loader.js", import.meta.url), "utf8");
  const writerModules = source.match(/writer:\s*\[([\s\S]*?)\n\s*\],\n\s*studio:/)?.[1] || "";
  assert.match(writerModules, /import\("\.\/actions-bible\.js"\)/);
  assert.match(writerModules, /import\("\.\/actions-writer\.js"\)/);
});
