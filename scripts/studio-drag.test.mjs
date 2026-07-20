import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { studioDragMoved, studioDragPosition } from "../src/views/studio-drag-math.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Studio drag scales pointer deltas into graph coordinates", () => {
  assert.deepEqual(
    studioDragPosition({ x: 100, y: 80, left: 240, top: 120 }, 160, 110, 0.5),
    { x: 360, y: 180 }
  );
});

test("Studio drag falls back to scale 1 for invalid zoom", () => {
  assert.deepEqual(
    studioDragPosition({ x: 10, y: 20, left: 40, top: 60 }, 30, 50, 0),
    { x: 60, y: 90 }
  );
});

test("Studio drag distinguishes a click from an intentional move", () => {
  const start = { x: 100, y: 100 };
  assert.equal(studioDragMoved(start, 102, 102), false);
  assert.equal(studioDragMoved(start, 103, 102), true);
});

test("Studio graph keeps whole-card drag delegation and pointer cancellation", () => {
  const source = fs.readFileSync(path.join(root, "src/views/studio.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(source, /event\.target\.closest\("\.node\[data-node-type\]"\)/);
  assert.doesNotMatch(source, /if\(!event\.target\.closest\("\.node-drag-handle"\)\)return/);
  assert.match(source, /addEventListener\("pointercancel",cancel/);
  assert.match(css, /\.node \{[^}]*touch-action:none/);
  assert.match(css, /\.node-board \{[^}]*touch-action:none/);
});

test("Clue graph keeps whole-card drag, cancellation, and failed-save rollback", () => {
  const source = fs.readFileSync(path.join(root, "src/views/clues-interactions.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(source, /event\.target\.closest\("\.clue-flow-node"\)/);
  assert.doesNotMatch(source, /dragHandle\?\.closest\("\.clue-flow-node"\)/);
  assert.match(source, /addEventListener\("pointercancel", cancel/);
  assert.match(source, /clue\.metadata = previousMetadata/);
  assert.match(css, /\.clue-flow-viewport \{[^}]*touch-action:none/);
  assert.match(css, /\.clue-flow-node \{[^}]*touch-action:none/);
});
