import assert from "node:assert/strict";
import test from "node:test";
import { resolveInitialUnlockRoleId } from "../src/runtime/host-intervention-controller.js";

test("stuck intervention keeps the recommended role selected for section unlock", () => {
  const players = [
    { role_slot_id: "role-first" },
    { role_slot_id: "role-target" }
  ];
  const sections = [
    { id: "section-first", role_slot_id: "role-first", sequence: 1 },
    { id: "section-target", role_slot_id: "role-target", sequence: 1 }
  ];

  assert.equal(
    resolveInitialUnlockRoleId(players, sections, { roleSlotId: "role-target" }),
    "role-target"
  );
});

test("section unlock falls back safely when a requested role no longer exists", () => {
  const players = [{ role_slot_id: "role-live" }];
  assert.equal(
    resolveInitialUnlockRoleId(players, [], { roleSlotId: "role-deleted" }),
    "role-live"
  );
});
