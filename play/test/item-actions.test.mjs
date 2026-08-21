import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const inventory = fs.readFileSync(new URL("../src/views/game-investigation-views.js", import.meta.url), "utf8");
const controller = fs.readFileSync(new URL("../src/runtime/game-action-controller.js", import.meta.url), "utf8");

test("player inventory renders creator-authored item action controls", () => {
  assert.match(inventory, /itemActions/);
  assert.match(inventory, /data-item-action-target/);
  assert.match(inventory, /data-item-action-combine/);
  assert.match(inventory, /等待主持确认/);
});

test("player item actions submit explicit target and combination identifiers", () => {
  assert.match(controller, /api\.submitItemAction/);
  assert.match(controller, /actionKey: button\.dataset\.actionKey/);
  assert.match(controller, /combineItemId/);
});
