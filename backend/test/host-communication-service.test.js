import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeHostCommunicationError,
  resolveHostNudgeTargets
} from "../src/host-communication-service.js";

test("explicit nudge targets are deduplicated and restricted to active players", () => {
  assert.deepEqual(resolveHostNudgeTargets({
    requestedRoleIds: ["active-2", "foreign", "active-2"],
    pendingRows: [],
    activeRoleIds: ["active-1", "active-2"]
  }), ["active-2"]);
});

test("inferred nudge targets prefer active pending roles and otherwise fall back", () => {
  const targeted = resolveHostNudgeTargets({
    requestedRoleIds: [],
    pendingRows: [{
      rule_conditions: { all: [{ roleSlotId: "active-2" }, { roleSlotId: "inactive" }] },
      actions: []
    }],
    activeRoleIds: ["active-1", "active-2"]
  });
  assert.deepEqual(targeted, ["active-2"]);

  const fallback = resolveHostNudgeTargets({
    requestedRoleIds: [],
    pendingRows: [{ rule_conditions: { all: [{ roleSlotId: "inactive" }] }, actions: [] }],
    activeRoleIds: ["active-1", "active-2"]
  });
  assert.deepEqual(fallback, ["active-1", "active-2"]);
});

test("database contention becomes typed host communication errors", () => {
  const busy = normalizeHostCommunicationError({ code: "55P03" });
  assert.equal(busy.statusCode, 409);
  assert.equal(busy.code, "HOST_COMMUNICATION_BUSY");
  const timeout = normalizeHostCommunicationError({ code: "57014" });
  assert.equal(timeout.statusCode, 503);
  assert.equal(timeout.code, "HOST_COMMUNICATION_TIMEOUT");
});
