/**
 * P7.2 Playable Mechanism Runtime Bridge — Gate tests
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileWarehouseSixFixture } from "../shared/playable-project-compiler.js";
import {
  createPlayableRuntimeState,
  assignPlayableRole,
  startPlayableSession,
  advancePlayableStage,
  resolveVisibleContent,
  fetchContentUnitForRole,
  fetchClueForRole,
  buildHostPlayableView,
  buildPlayerPlayableView,
  normalizePlayableRuntimeState,
} from "../shared/playable-content-runtime.js";
import {
  startPlacementMechanism,
  bidPlacementMechanism,
  settlePlacementMechanism,
} from "../shared/playable-mechanism-bridge.js";
import {
  applyRuntimeEffects,
  effectApplicationKey,
  roleHasPermission,
  selectOutcomeBinding,
} from "../shared/playable-runtime-effects.js";
import { normalizeRuntimeEffect, validateRuntimeEffect } from "../shared/playable-project-contracts.js";

const FIXED = () => "2026-09-05T14:00:00.000Z";
const ROOM = "room-p72-warehouse";

function readyProject() {
  return compileWarehouseSixFixture({ now: FIXED });
}

function assignAllSix(runtime) {
  let next = runtime;
  for (const role of ["role_a", "role_b", "role_c", "role_d", "role_e", "role_f"]) {
    next = assignPlayableRole(next, { userId: `user_${role}`, playableRoleId: role, now: FIXED });
  }
  return next;
}

function ids(units) {
  return new Set(units.map((u) => u.id));
}

function toStage2Running() {
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: readyProject(), now: FIXED });
  runtime = assignAllSix(runtime);
  runtime = startPlayableSession(runtime, { now: FIXED });
  runtime = advancePlayableStage(runtime, { now: FIXED });
  assert.equal(runtime.currentStageId, "stage_2");
  return runtime;
}

test("effect contracts: GRANT/REVOKE/APPLY/CLEAR validate", () => {
  assert.equal(validateRuntimeEffect({ type: "PERMISSION_GRANT", permissionId: "storage_room_access", target: "WINNER" }).ok, true);
  assert.equal(validateRuntimeEffect({ type: "PERMISSION_REVOKE", permissionId: "storage_room_access", target: "WINNER" }).ok, true);
  assert.equal(validateRuntimeEffect({ type: "STATE_APPLY", key: "storage_room", value: "UNLOCKED_FOR_WINNER" }).ok, true);
  assert.equal(validateRuntimeEffect({ type: "STATE_CLEAR", key: "storage_room" }).ok, true);
});

test("STATE and PERMISSION stay separate after apply", () => {
  let runtime = toStage2Running();
  runtime = applyRuntimeEffects(runtime, {
    effects: [
      { type: "PERMISSION_GRANT", permissionId: "storage_room_access", target: "WINNER" },
      { type: "STATE_APPLY", key: "storage_room", value: "UNLOCKED_FOR_WINNER" },
    ],
    placementId: "place_m03_storage",
    outcomeId: "o1",
    outcomeIndex: 0,
    winnerRoleId: "role_b",
    now: FIXED,
  });
  assert.equal(runtime.keyStates.storage_room, "UNLOCKED_FOR_WINNER");
  assert.equal(roleHasPermission(runtime, "role_b", "storage_room_access"), true);
  assert.equal(roleHasPermission(runtime, "role_a", "storage_room_access"), false);
  // keyStates alone must NOT unlock content for everyone
  assert.ok(!ids(resolveVisibleContent({ runtime, roleId: "role_a" })).has("cu_a_s2_win"));
  assert.ok(!ids(resolveVisibleContent({ runtime, roleId: "role_c" })).has("cu_clue_clue_burned_ledger"));
});

test("placement only startable on current stage; M09 startable on final", () => {
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: readyProject(), now: FIXED });
  runtime = assignAllSix(runtime);
  runtime = startPlayableSession(runtime, { now: FIXED });
  assert.throws(
    () => startPlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED }),
    (e) => e.code === "NOT_CURRENT_STAGE",
  );
  runtime = advancePlayableStage(runtime, { now: FIXED });
  runtime = advancePlayableStage(runtime, { now: FIXED });
  runtime = advancePlayableStage(runtime, { now: FIXED });
  runtime = startPlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });
  assert.equal(runtime.mechanismExecutions.place_m09_final.status, "RUNNING");
});

test("singleton runtime instance + settle applies WINNER effects", () => {
  let runtime = toStage2Running();
  const host = buildHostPlayableView(runtime);
  const m03 = host.placements.find((p) => p.id === "place_m03_storage");
  assert.equal(m03.status, "READY");
  assert.equal(m03.canStart, true);

  runtime = startPlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  const instanceId = runtime.mechanismExecutions.place_m03_storage.runtimeInstanceId;
  // reconnect / start again is idempotent
  const again = startPlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  assert.equal(again.mechanismExecutions.place_m03_storage.runtimeInstanceId, instanceId);

  runtime = bidPlacementMechanism(runtime, {
    placementId: "place_m03_storage",
    playableRoleId: "role_a",
    amount: 5,
    bidId: "b1",
    now: FIXED,
  });
  runtime = bidPlacementMechanism(runtime, {
    placementId: "place_m03_storage",
    playableRoleId: "role_b",
    amount: 9,
    bidId: "b2",
    now: FIXED,
  });

  runtime = settlePlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  assert.equal(runtime.mechanismExecutions.place_m03_storage.status, "SETTLED");
  assert.equal(runtime.mechanismExecutions.place_m03_storage.winnerRoleId, "role_b");
  assert.equal(roleHasPermission(runtime, "role_b", "storage_room_access"), true);
  assert.equal(roleHasPermission(runtime, "role_a", "storage_room_access"), false);
  assert.equal(runtime.keyStates.storage_room, "UNLOCKED_FOR_WINNER");

  // Winner sees permission-gated content; losers do not
  assert.ok(ids(resolveVisibleContent({ runtime, roleId: "role_b" })).has("cu_a_s2_win"));
  assert.ok(ids(resolveVisibleContent({ runtime, roleId: "role_b" })).has("cu_clue_clue_burned_ledger"));
  assert.equal(fetchClueForRole(runtime, { roleId: "role_b", clueId: "clue_burned_ledger" }).ok, true);
  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_a", contentUnitId: "cu_a_s2_win" }).ok, false);
  assert.equal(fetchClueForRole(runtime, { roleId: "role_a", clueId: "clue_burned_ledger" }).ok, false);
  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_c", contentUnitId: "cu_clue_clue_burned_ledger" }).ok, false);

  // Idempotent settle
  const rev = runtime.revision;
  const keys = runtime.appliedEffectKeys.length;
  runtime = settlePlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  assert.equal(runtime.appliedEffectKeys.length, keys);
  assert.equal(runtime.permissionGrants.filter((g) => g.permissionId === "storage_room_access").length, 1);

  // Persistence roundtrip
  const restored = normalizePlayableRuntimeState(JSON.parse(JSON.stringify(runtime)));
  assert.equal(roleHasPermission(restored, "role_b", "storage_room_access"), true);
  assert.ok(ids(resolveVisibleContent({ runtime: restored, roleId: "role_b" })).has("cu_a_s2_win"));

  // Can still advance to stage 3
  runtime = advancePlayableStage(runtime, { now: FIXED });
  assert.equal(runtime.currentStageId, "stage_3");
  assert.equal(roleHasPermission(runtime, "role_b", "storage_room_access"), true);
});

test("anti-peek after grant still blocks foreign private AUTO content", () => {
  let runtime = toStage2Running();
  runtime = startPlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  runtime = bidPlacementMechanism(runtime, {
    placementId: "place_m03_storage",
    playableRoleId: "role_c",
    amount: 12,
    bidId: "b_c",
    now: FIXED,
  });
  runtime = settlePlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  // winner C gets permission content, still cannot see B's private AUTO stage text if not audience
  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_c", contentUnitId: "cu_b_s2" }).ok, false);
  assert.equal(fetchContentUnitForRole(runtime, { roleId: "role_c", contentUnitId: "cu_host_host_s2" }).ok, false);
});

test("snapshot independence: mutating project after settle does not change grants", () => {
  let runtime = toStage2Running();
  const fp = runtime.playableFingerprint;
  runtime = startPlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  runtime = bidPlacementMechanism(runtime, {
    placementId: "place_m03_storage",
    playableRoleId: "role_d",
    amount: 7,
    bidId: "b_d",
    now: FIXED,
  });
  runtime = settlePlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  runtime.playableSnapshot.permissions[0].contentUnitIds = [];
  // normalize restores from frozen snapshot object — keep a deep copy check via re-normalize of serialized
  const frozen = normalizePlayableRuntimeState(JSON.parse(JSON.stringify({
    ...runtime,
    playableSnapshot: compileWarehouseSixFixture({ now: FIXED }),
  })));
  // Even if we rebuild from same fixture, grants stick on runtime overlay
  assert.equal(runtime.playableFingerprint, fp);
  assert.equal(roleHasPermission(runtime, "role_d", "storage_room_access"), true);
  assert.ok(frozen); // sanity
});

test("effect application key is stable for idempotency", () => {
  const effect = normalizeRuntimeEffect({
    type: "PERMISSION_GRANT",
    permissionId: "storage_room_access",
    target: "WINNER",
  });
  const a = effectApplicationKey({
    placementId: "place_m03_storage",
    outcomeIndex: 0,
    effectIndex: 0,
    targetRoleId: "role_b",
    effect,
  });
  const b = effectApplicationKey({
    placementId: "place_m03_storage",
    outcomeIndex: 0,
    effectIndex: 0,
    targetRoleId: "role_b",
    effect,
  });
  assert.equal(a, b);
});

test("player view after settle exposes unlocked clue for winner only", () => {
  let runtime = toStage2Running();
  runtime = startPlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  runtime = bidPlacementMechanism(runtime, {
    placementId: "place_m03_storage",
    playableRoleId: "role_e",
    amount: 11,
    bidId: "b_e",
    now: FIXED,
  });
  runtime = settlePlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  const winnerView = buildPlayerPlayableView(runtime, { playableRoleId: "role_e" });
  const loserView = buildPlayerPlayableView(runtime, { playableRoleId: "role_a" });
  assert.ok(winnerView.clues.some((c) => c.clueId === "clue_burned_ledger" || c.title?.includes("账册")));
  assert.ok(winnerView.contentUnits.some((u) => u.id === "cu_a_s2_win"));
  assert.ok(!loserView.clues.some((c) => c.clueId === "clue_burned_ledger"));
  assert.ok(!loserView.contentUnits.some((u) => u.id === "cu_a_s2_win"));
  const hostView = buildHostPlayableView(runtime);
  const settled = hostView.placements.find((p) => p.id === "place_m03_storage");
  assert.equal(settled?.canStart, false);
  assert.equal(settled?.canSettle, false);
  assert.ok(settled?.winnerLabel);
  assert.ok(settled?.outcomeSummary);
});

test("selectOutcomeBinding picks WINNER binding", () => {
  const pp = readyProject();
  const placement = pp.mechanismPlacements.find((p) => p.id === "place_m03_storage");
  const { binding, outcomeIndex } = selectOutcomeBinding(placement, { status: "SOLD", winner: "role_a" });
  assert.ok(binding);
  assert.equal(outcomeIndex, 0);
  assert.ok(binding.effects.some((e) => e.type === "PERMISSION_GRANT"));
});
