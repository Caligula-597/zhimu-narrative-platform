import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relative) =>
  fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

test("creator exposes the mechanism guide through a guarded lazy workbench", () => {
  const model = read("src/views/creator-cockpit-model.js");
  const panels = read("src/views/creator-cockpit-panels.js");
  const actions = read("src/runtime/actions-creator-cockpit.js");
  const workbench = read("src/views/creator-mechanism-workbench.js");

  assert.match(model, /cockpit-open-mechanism-workbench/);
  assert.match(
    actions,
    /import\("\.\.\/views\/creator-mechanism-workbench\.js"\)/,
  );
  assert.doesNotMatch(actions, /^import .*creator-mechanism-workbench/m);
  assert.match(workbench, /MECHANISM_DESIGN_QUESTIONS/);
  assert.match(workbench, /data-mechanism-save="draft"/);
  assert.match(workbench, /data-mechanism-save="confirmed"/);
  assert.match(workbench, /validateMechanismDesignConfirmation/);
  assert.match(workbench, /mechanism-validation-message/);
  assert.match(workbench, /aria-invalid/);
  assert.match(workbench, /numeric_allocation/);
  assert.match(workbench, /data-mechanism-design-field="allocationTotal"/);
  assert.match(workbench, /creator-mechanism-workbench\.css/);
  assert.match(workbench, /cockpit-core-canvas/);
  assert.match(workbench, /data-workspace-editor/);
  assert.match(panels, /view: "publish", label: "发布 Release"/);
  assert.doesNotMatch(workbench, /modalBackdrop|components\/modal\.js/);
});
