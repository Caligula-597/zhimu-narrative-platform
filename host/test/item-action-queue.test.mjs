import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const layout = fs.readFileSync(new URL("../src/views/host-layout.js", import.meta.url), "utf8");
const actions = fs.readFileSync(new URL("../src/runtime/director-actions.js", import.meta.url), "utf8");

test("host queue can approve or reject pending item actions with a revision", () => {
  assert.match(layout, /cloudHostItemActions/);
  assert.match(layout, /host-resolve-item-action/);
  assert.match(layout, /data-revision/);
  assert.match(actions, /resolveHostItemAction/);
});
