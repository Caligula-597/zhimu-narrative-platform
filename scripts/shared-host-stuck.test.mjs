import assert from "node:assert/strict";
import test from "node:test";
import { resolveHostStuckIntervention } from "../shared/host-stuck-intervention.js";

const players = [
  { joined: true, maybe_stuck: false, role_slot_id: "a", recommended_action: "nudge" },
  { joined: true, maybe_stuck: true, role_slot_id: "b", recommended_action: "unlock_section", suggested_nudge: "unlock me" },
  { joined: true, maybe_stuck: true, role_slot_id: "c", recommended_action: "inspect" }
];

test("resolveHostStuckIntervention picks first stuck player", () => {
  const result = resolveHostStuckIntervention(players);
  assert.equal(result.ok, true);
  assert.equal(result.action, "unlock_section");
  assert.equal(result.target.role_slot_id, "b");
});

test("resolveHostStuckIntervention filters by role slot", () => {
  const result = resolveHostStuckIntervention(players, "c");
  assert.equal(result.ok, true);
  assert.equal(result.action, "inspect");
});

test("resolveHostStuckIntervention returns reason when none stuck", () => {
  const result = resolveHostStuckIntervention([players[0]]);
  assert.equal(result.ok, false);
  assert.match(result.reason, /没有需要干预/);
});
