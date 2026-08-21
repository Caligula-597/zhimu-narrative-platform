import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const view = fs.readFileSync(new URL("../src/views/recap.js", import.meta.url), "utf8");
const controller = fs.readFileSync(new URL("../src/runtime/recap-notebook-controller.js", import.meta.url), "utf8");

test("recap library groups history and exposes privacy-safe actions", () => {
  assert.match(view, /我的多局复盘库/);
  assert.match(view, /data-recap-retention/);
  assert.match(view, /open-library-recap/);
  assert.match(view, /export-library-recap/);
  assert.match(view, /hide-library-recap/);
});

test("recap export reloads the player projection instead of serializing list metadata", () => {
  assert.match(controller, /api\.recapLibraryDetail\(recapId\)/);
  assert.match(controller, /JSON\.stringify\(recap, null, 2\)/);
  assert.match(controller, /原始复盘未删除/);
});
