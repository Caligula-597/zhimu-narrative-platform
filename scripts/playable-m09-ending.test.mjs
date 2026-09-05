/**
 * P7.3 M09 Vote + Ending Settlement — layered Gate tests
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileWarehouseSixFixture } from "../shared/playable-project-compiler.js";
import {
  createPlayableRuntimeState,
  assignPlayableRole,
  startPlayableSession,
  advancePlayableStage,
  finishPlayableSession,
  resolveVisibleContent,
  buildHostPlayableView,
  buildPlayerPlayableView,
  normalizePlayableRuntimeState,
} from "../shared/playable-content-runtime.js";
import {
  startPlacementMechanism,
  bidPlacementMechanism,
  settlePlacementMechanism,
  votePlacementMechanism,
} from "../shared/playable-mechanism-bridge.js";
import { roleHasPermission, selectOutcomeBinding } from "../shared/playable-runtime-effects.js";
import { canFinishPlayableSession } from "../shared/playable-ending-settlement.js";

const FIXED = () => "2026-09-05T16:00:00.000Z";
const ROOM = "room-p73-warehouse";

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

function toFinalRunning() {
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: readyProject(), now: FIXED });
  runtime = assignAllSix(runtime);
  runtime = startPlayableSession(runtime, { now: FIXED });
  runtime = advancePlayableStage(runtime, { now: FIXED }); // 2
  runtime = startPlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  runtime = bidPlacementMechanism(runtime, {
    placementId: "place_m03_storage",
    playableRoleId: "role_b",
    amount: 10,
    bidId: "m03b",
    now: FIXED,
  });
  runtime = settlePlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  runtime = advancePlayableStage(runtime, { now: FIXED }); // 3
  runtime = advancePlayableStage(runtime, { now: FIXED }); // 4
  return runtime;
}

function voteAll(runtime, choiceByRole = {}) {
  let next = runtime;
  for (const role of ["role_a", "role_b", "role_c", "role_d", "role_e", "role_f"]) {
    next = votePlacementMechanism(next, {
      placementId: "place_m09_final",
      playableRoleId: role,
      optionId: choiceByRole[role] || "role_c",
      now: FIXED,
    });
  }
  return next;
}

// ── A. M09 adapter ──

test("A: start M09 on final stage with existing M09-1 runtime", () => {
  let runtime = toFinalRunning();
  runtime = startPlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });
  const exec = runtime.mechanismExecutions.place_m09_final;
  assert.equal(exec.status, "RUNNING");
  assert.equal(exec.templateId, "M09-1");
  assert.ok(exec.runtimeInstanceId);
  assert.deepEqual(exec.instance.params.candidates, [
    "role_a",
    "role_b",
    "role_c",
    "role_d",
    "role_e",
    "role_f",
  ]);
});

test("A: valid / invalid participant and option", () => {
  let runtime = toFinalRunning();
  runtime = startPlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });
  runtime = votePlacementMechanism(runtime, {
    placementId: "place_m09_final",
    playableRoleId: "role_a",
    optionId: "role_c",
    now: FIXED,
  });
  assert.equal(
    runtime.mechanismExecutions.place_m09_final.gameState.ballots.main.role_a.choice,
    "role_c",
  );
  assert.throws(
    () =>
      votePlacementMechanism(runtime, {
        placementId: "place_m09_final",
        playableRoleId: "role_ghost",
        optionId: "role_c",
        now: FIXED,
      }),
    (e) => e.code === "ROLE_NOT_ASSIGNED" || e.code === "NOT_PARTICIPANT",
  );
  assert.throws(
    () =>
      votePlacementMechanism(runtime, {
        placementId: "place_m09_final",
        playableRoleId: "role_a",
        optionId: "not_a_role",
        now: FIXED,
      }),
    (e) => e.code === "INVALID_OPTION",
  );
});

test("A: revise vote before settle (M09-1 allow_revise)", () => {
  let runtime = toFinalRunning();
  runtime = startPlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });
  runtime = votePlacementMechanism(runtime, {
    placementId: "place_m09_final",
    playableRoleId: "role_a",
    optionId: "role_b",
    now: FIXED,
  });
  runtime = votePlacementMechanism(runtime, {
    placementId: "place_m09_final",
    playableRoleId: "role_a",
    optionId: "role_c",
    now: FIXED,
  });
  assert.equal(
    runtime.mechanismExecutions.place_m09_final.gameState.ballots.main.role_a.choice,
    "role_c",
  );
  const player = buildPlayerPlayableView(runtime, { playableRoleId: "role_a" });
  const m09 = player.placements.find((p) => p.placementId === "place_m09_final");
  assert.equal(m09.mySubmission.optionId, "role_c");
  assert.equal(m09.canSubmit, true);
});

test("A: settle DECIDED + TIE", () => {
  let runtime = toFinalRunning();
  runtime = startPlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });
  runtime = voteAll(runtime, {
    role_a: "role_c",
    role_b: "role_c",
    role_c: "role_c",
    role_d: "role_c",
    role_e: "role_a",
    role_f: "role_a",
  });
  runtime = settlePlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });
  assert.equal(runtime.mechanismExecutions.place_m09_final.result.status, "DECIDED");
  assert.equal(runtime.mechanismExecutions.place_m09_final.winnerRoleId, "role_c");

  // Tie path
  let tie = toFinalRunning();
  tie = startPlacementMechanism(tie, { placementId: "place_m09_final", now: FIXED });
  tie = voteAll(tie, {
    role_a: "role_a",
    role_b: "role_a",
    role_c: "role_a",
    role_d: "role_b",
    role_e: "role_b",
    role_f: "role_b",
  });
  tie = settlePlacementMechanism(tie, { placementId: "place_m09_final", now: FIXED });
  assert.equal(tie.mechanismExecutions.place_m09_final.result.status, "TIE");
  assert.equal(tie.endingSettlement.result.outcomeType, "TIE");
  assert.match(tie.endingSettlement.publicSummary, /票数相同/);
});

// ── B. Bridge / FSM ──

test("B: M09 FSM singleton + outcome binding + idempotent settle", () => {
  let runtime = toFinalRunning();
  runtime = startPlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });
  const id1 = runtime.mechanismExecutions.place_m09_final.runtimeInstanceId;
  runtime = startPlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });
  assert.equal(runtime.mechanismExecutions.place_m09_final.runtimeInstanceId, id1);

  runtime = voteAll(runtime);
  const placement = runtime.playableSnapshot.mechanismPlacements.find((p) => p.id === "place_m09_final");
  const { binding } = selectOutcomeBinding(placement, { status: "DECIDED", winner: "role_c" });
  assert.ok(binding);
  assert.equal(binding.outcomeMatcher.type, "MAJORITY");

  runtime = settlePlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });
  const keys = runtime.appliedEffectKeys.length;
  const endingId = runtime.endingSettlement.id;
  runtime = settlePlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });
  assert.equal(runtime.appliedEffectKeys.length, keys);
  assert.equal(runtime.endingSettlement.id, endingId);
  assert.throws(
    () => startPlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED }),
    (e) => e.code === "ALREADY_SETTLED",
  );
});

// ── C. Ending ──

test("C: ending once, vote≠truth, reveal, confirm, finished guards", () => {
  let runtime = toFinalRunning();
  assert.equal(canFinishPlayableSession(runtime).ok, false);

  runtime = startPlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });
  // Wrong majority (accuse role_a); truth is role_c
  runtime = voteAll(runtime, {
    role_a: "role_a",
    role_b: "role_a",
    role_c: "role_a",
    role_d: "role_a",
    role_e: "role_c",
    role_f: "role_c",
  });
  runtime = settlePlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });

  assert.equal(runtime.endingSettlement.status, "PENDING_CONFIRMATION");
  assert.equal(runtime.status, "RUNNING");
  assert.equal(runtime.keyStates.final_accused_role, "role_a");
  assert.equal(runtime.endingSettlement.result.winningOptionId, "role_a");
  assert.equal(runtime.endingSettlement.result.correctOptionId, "role_c");
  assert.equal(runtime.endingSettlement.result.isCorrect, false);
  assert.match(runtime.endingSettlement.publicSummary, /指认错误/);
  assert.equal(runtime.keyStates.truth_revealed, true);
  // permission separate from keyState
  assert.equal(roleHasPermission(runtime, "role_a", "ending_reveal_access"), true);
  assert.ok(ids(resolveVisibleContent({ runtime, roleId: "role_a" })).has("cu_public_s4_truth"));

  const host = buildHostPlayableView(runtime);
  assert.equal(host.canConfirmEnding, true);
  assert.ok(host.endingSummary);

  runtime = finishPlayableSession(runtime, { now: FIXED });
  assert.equal(runtime.status, "FINISHED");
  assert.equal(runtime.endingSettlement.status, "CONFIRMED");
  assert.ok(runtime.endingSnapshot);
  assert.throws(
    () =>
      votePlacementMechanism(runtime, {
        placementId: "place_m09_final",
        playableRoleId: "role_a",
        optionId: "role_c",
        now: FIXED,
      }),
    (e) => e.code === "NOT_RUNNING",
  );
  assert.throws(
    () => finishPlayableSession(runtime, { now: FIXED }),
    (e) => e.code === "NOT_RUNNING",
  );
});

// ── D. Full flow ──

test("D: Stage1→M03→Final→M09→FINISHED + refresh persistence", () => {
  let runtime = createPlayableRuntimeState({ roomId: ROOM, playableProject: readyProject(), now: FIXED });
  runtime = assignAllSix(runtime);
  runtime = startPlayableSession(runtime, { now: FIXED });
  runtime = advancePlayableStage(runtime, { now: FIXED });
  runtime = startPlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  runtime = bidPlacementMechanism(runtime, {
    placementId: "place_m03_storage",
    playableRoleId: "role_e",
    amount: 8,
    bidId: "full_m03",
    now: FIXED,
  });
  runtime = settlePlacementMechanism(runtime, { placementId: "place_m03_storage", now: FIXED });
  assert.equal(roleHasPermission(runtime, "role_e", "storage_room_access"), true);
  assert.ok(ids(resolveVisibleContent({ runtime, roleId: "role_e" })).has("cu_a_s2_win"));

  runtime = advancePlayableStage(runtime, { now: FIXED });
  runtime = advancePlayableStage(runtime, { now: FIXED });
  runtime = startPlacementMechanism(runtime, { placementId: "place_m09_final", now: FIXED });
  runtime = votePlacementMechanism(runtime, {
    placementId: "place_m09_final",
    playableRoleId: "role_a",
    optionId: "role_c",
    now: FIXED,
  });
  // Refresh mid-vote
  let restored = normalizePlayableRuntimeState(JSON.parse(JSON.stringify(runtime)));
  assert.equal(
    restored.mechanismExecutions.place_m09_final.gameState.ballots.main.role_a.choice,
    "role_c",
  );
  const midView = buildPlayerPlayableView(restored, { playableRoleId: "role_a" });
  assert.equal(midView.placements.find((p) => p.placementId === "place_m09_final").mySubmission.optionId, "role_c");

  restored = voteAll(restored, {
    role_a: "role_c",
    role_b: "role_c",
    role_c: "role_c",
    role_d: "role_c",
    role_e: "role_c",
    role_f: "role_b",
  });
  restored = settlePlacementMechanism(restored, { placementId: "place_m09_final", now: FIXED });
  assert.equal(restored.endingSettlement.result.isCorrect, true);

  restored = finishPlayableSession(restored, { now: FIXED });
  const after = normalizePlayableRuntimeState(JSON.parse(JSON.stringify(restored)));
  assert.equal(after.status, "FINISHED");
  assert.equal(after.endingSettlement.status, "CONFIRMED");
  assert.equal(roleHasPermission(after, "role_e", "storage_room_access"), true);
  const finishedPlayer = buildPlayerPlayableView(after, { playableRoleId: "role_a" });
  assert.equal(finishedPlayer.status, "FINISHED");
  assert.ok(finishedPlayer.endingSummary?.publicSummary);
  const finishedHost = buildHostPlayableView(after);
  assert.equal(finishedHost.placements.find((p) => p.placementId === "place_m09_final")?.canStart, false);
});
