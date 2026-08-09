import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("modal surfaces trap and restore keyboard focus through the shared controller", () => {
  const controller = read("shared/modal-focus.js");
  assert.match(controller, /event\.key === "Escape"/);
  assert.match(controller, /event\.key !== "Tab"/);
  assert.match(controller, /restoreFocus\(returnTarget\)/);
  assert.match(controller, /aria-modal/);

  for (const file of [
    "src/components/modal.js",
    "host/src/components/modal.js",
    "host/src/main.js",
    "play/src/runtime/view-controller.js"
  ]) {
    assert.match(read(file), /createModalFocusController/, file);
  }
});

test("rendered application errors are announced immediately", () => {
  assert.match(read("host/src/components/shell.js"), /class="banner error" role="alert"/);
  assert.match(read("play/src/components/shell.js"), /class="banner error" role="alert"/);
});
