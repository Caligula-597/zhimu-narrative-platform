import assert from "node:assert/strict";
import test from "node:test";
import { projectRuntimeTabletopCheck } from "../shared/tabletop-flow.js";

test("player check projections never expose private variable values", () => {
  const projected = projectRuntimeTabletopCheck({
    id: "check-1",
    templateId: "check-1",
    locationId: "room-a",
    label: "Public check",
    instruction: "Describe the action",
    target: 12,
    bonus: 0,
    rollMode: "normal",
    dice: { count: 1, sides: 20, modifier: 0, defaultTarget: 12 },
    status: "resolved",
    result: {
      label: "Public result",
      rollMode: "normal",
      attempts: [[15]],
      rolls: [15],
      rawTotal: 15,
      total: 15,
      target: 12,
      success: true,
      criticalSuccess: false,
      criticalFailure: false,
      margin: 3,
      degree: "success",
      degreeLabel: "Success",
      degreeRank: 1
    },
    successText: "private branch",
    failureText: "private branch",
    appliedAt: "2026-08-10T14:00:00.000Z",
    appliedChanges: [{
      id: "trust",
      label: "Trust",
      previous: 6,
      value: 8,
      delta: 2,
      hostNotes: "private"
    }],
    outcomeText: "Public outcome",
    startedAt: "2026-08-10T13:59:00.000Z",
    resolvedAt: "2026-08-10T14:00:00.000Z"
  }, { audience: "player" });

  assert.equal(projected.successText, undefined);
  assert.equal(projected.failureText, undefined);
  assert.ok(Array.isArray(projected.appliedChanges));
  for (const change of projected.appliedChanges) {
    assert.deepEqual(Object.keys(change).sort(), ["delta", "id", "label"]);
    assert.equal(change.previous, undefined);
    assert.equal(change.value, undefined);
    assert.equal(change.hostNotes, undefined);
  }
});
