/**
 * P9.2 GAME Narrative Binding — GEN-05 closed loop + safety gates
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditGameNarrativePlan, auditGameNarrativeRevisionImpact } from "../shared/game-narrative-audit.js";
import {
  GEN05_BEAT_CATALOG,
  acceptGen05GamePlacements,
  buildGen05ContextProfile,
  buildGen05GameNarrativePlan,
  buildGen05NarrativelyBoundPackage,
} from "../shared/game-narrative-gen05-fixture.js";
import { acceptGameplayPlacement } from "../shared/game-narrative-plan.js";
import { planGameplayCandidates } from "../shared/creation-candidate-planner.js";
import { compileCompleteScriptPackage } from "../shared/complete-script-playable-adapter.js";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";
import {
  advancePlayableStage,
  assignPlayableRole,
  createPlayableRuntimeState,
  fetchClueForRole,
  startPlayableSession,
} from "../shared/playable-content-runtime.js";
import {
  bidPlacementMechanism,
  settlePlacementMechanism,
  startPlacementMechanism,
  votePlacementMechanism,
} from "../shared/playable-mechanism-bridge.js";
import { roleHasPermission } from "../shared/playable-runtime-effects.js";
import { createInitialProjectStoryState } from "../shared/story-mechanism-engine.js";

const FIXED = () => "2026-09-05T12:00:00.000Z";

describe("P9.2 authoring boundary", () => {
  it("gameplay preference does not auto-place", () => {
    const planned = planGameplayCandidates({
      playerCount: 6,
      stagePreference: { mode: "EXACT", count: 4 },
      gameplayPreferences: { preferred: ["BIDDING", "VOTING"] },
    });
    assert.ok(planned?.candidates?.length >= 1);
    for (const row of planned.candidates) {
      assert.ok(row.warnings.some((w) => /不做 stage placement/i.test(w) || /P8\.1/.test(w)));
      assert.equal(row.stageId, undefined);
      assert.equal(row.outcomeBindings, undefined);
    }
  });

  it("placement requires explicit accept", () => {
    const accepted = acceptGen05GamePlacements();
    assert.equal(accepted.length, 3);
    assert.ok(accepted.every((b) => b.selectionSource === "EXPLICIT"));
    assert.ok(accepted.every((b) => b.acceptedFromCandidate === true));
  });

  it("unsupported families stay NARRATIVE_RUNTIME_UNSUPPORTED", () => {
    const stub = acceptGameplayPlacement({
      stageId: "act2",
      mechanismTemplateId: "M04-1",
      familyId: "M04",
      instanceKey: "transfer",
      sourceBeatIds: ["beat_x"],
    });
    stub.narrative = {
      causeSummary: "x",
      stake: { label: "具体信物转移权" },
      participantReason: "y",
      publicPrompt: "z",
    };
    stub.outcomes = [
      {
        outcomeMatcher: { type: "WINNER" },
        narrativeMeaning: "转移完成",
        effects: [],
        contentBindings: [],
      },
    ];
    const audit = auditGameNarrativePlan({
      plan: { revision: 1, bindings: [stub] },
      beatCatalog: ["beat_x"],
    });
    assert.equal(audit.status, "FAIL");
    assert.ok(audit.failed.some((c) => c.code === "NARRATIVE_RUNTIME_UNSUPPORTED"));
  });
});

describe("P9.2 GEN-05 narrative plan", () => {
  it("audit PASS with concrete stakes, causes, and closed loops", () => {
    const contextProfile = buildGen05ContextProfile();
    const plan = buildGen05GameNarrativePlan({ contextProfile });
    const audit = auditGameNarrativePlan({
      plan,
      beatCatalog: GEN05_BEAT_CATALOG,
      contextProfile,
    });
    assert.equal(audit.status, "PASS", JSON.stringify(audit.failed, null, 2));

    const [a, b, c] = plan.bindings;
    assert.equal(a.familyId, "M03");
    assert.equal(b.familyId, "M03");
    assert.equal(c.familyId, "M09");
    assert.ok(a.narrative.stake.label.includes("加密拍品目录"));
    assert.ok(b.narrative.stake.label.includes("关键证物"));
    assert.ok(!/关键资源/.test(a.narrative.stake.label));
    assert.deepEqual(
      a.outcomes[0].effects.find((e) => e.type === "PERMISSION_GRANT").permissionId,
      "catalog_preview_access",
    );
    assert.deepEqual(
      b.outcomes[0].effects.find((e) => e.type === "PERMISSION_GRANT").permissionId,
      "evidence_custody_access",
    );
    assert.notEqual(
      a.outcomes[0].effects.find((e) => e.type === "PERMISSION_GRANT").permissionId,
      b.outcomes[0].effects.find((e) => e.type === "PERMISSION_GRANT").permissionId,
    );
  });

  it("rejects generic stake and unsupported cause beats", () => {
    const plan = buildGen05GameNarrativePlan();
    plan.bindings[0].narrative.stake.label = "关键资源";
    plan.bindings[0].sourceBeatIds = ["beat_invented"];
    const audit = auditGameNarrativePlan({
      plan,
      beatCatalog: GEN05_BEAT_CATALOG,
    });
    assert.equal(audit.status, "FAIL");
    assert.ok(audit.failed.some((c) => c.code === "STAKE_INSTANTIATED" || c.detail?.code === "NARRATIVE_STAKE_NOT_INSTANTIATED"));
    assert.ok(audit.failed.some((c) => c.code === "CAUSE_BEATS_IN_PMD"));
  });

  it("gameNarrativePlan null is legal on ProjectStoryState", () => {
    const state = createProjectStoryState({ projectId: "p92" });
    assert.equal(state.gameNarrativePlan, null);
    const withPlan = createProjectStoryState({
      projectId: "p92",
      gameNarrativePlan: buildGen05GameNarrativePlan(),
    });
    assert.equal(withPlan.gameNarrativePlan.bindings.length, 3);
  });

  it("context revision drift → GAME_NARRATIVE_REVIEW_REQUIRED", () => {
    const plan = buildGen05GameNarrativePlan();
    plan.bindings[0].status = "USER_MODIFIED";
    plan.sourceContextRevision = 1;
    const report = auditGameNarrativeRevisionImpact({
      plan,
      contextProfile: { revision: 3, bindings: {} },
    });
    assert.equal(report.status, "REVIEW_REQUIRED");
    assert.ok(report.reviewRequired.some((r) => r.code === "GAME_NARRATIVE_REVIEW_REQUIRED"));
  });
});

describe("P9.2 GEN-05 package → runtime closed loop", () => {
  it("compiles and isolates two M03 winners + M09 ending without truth rewrite", () => {
    const { package: pkg, plan, beatCatalog } = buildGen05NarrativelyBoundPackage();
    const audit = auditGameNarrativePlan({ plan, beatCatalog });
    assert.equal(audit.status, "PASS", JSON.stringify(audit.failed, null, 2));

    assert.equal(pkg.mechanismAnnotations.length, 3);
    assert.ok(pkg.permissions.some((p) => p.id === "catalog_preview_access"));
    assert.ok(pkg.permissions.some((p) => p.id === "evidence_custody_access"));
    assert.ok(pkg.permissions.some((p) => p.id === "ending_reveal_access"));
    assert.equal(
      pkg.clues.find((c) => c.id === "clue_encrypted_catalog").permissionId,
      "catalog_preview_access",
    );
    assert.equal(
      pkg.clues.find((c) => c.id === "clue_contested_exhibit").permissionId,
      "evidence_custody_access",
    );

    const compiled = compileCompleteScriptPackage(pkg, { now: FIXED });
    assert.equal(compiled.status, "READY", JSON.stringify(compiled.diagnostics));
    const placeA = compiled.mechanismPlacements.find((p) => p.id.includes("intel"));
    const placeB = compiled.mechanismPlacements.find((p) => p.id.includes("resource"));
    const placeV = compiled.mechanismPlacements.find((p) => p.familyId === "M09");
    assert.ok(placeA && placeB && placeV);

    let runtime = createPlayableRuntimeState({
      playableProject: compiled,
      roomId: "room-gen05-p92",
      now: FIXED,
    });
    for (const role of compiled.roles.filter((r) => r.type === "PLAYER")) {
      runtime = assignPlayableRole(runtime, {
        playableRoleId: role.id,
        userId: `user_${role.id}`,
        now: FIXED,
      });
    }
    runtime = startPlayableSession(runtime, { now: FIXED });
    // advance to act2
    while (runtime.currentStageId !== "act2") {
      runtime = advancePlayableStage(runtime, { now: FIXED });
    }

    runtime = startPlacementMechanism(runtime, { placementId: placeA.id, now: FIXED });
    runtime = bidPlacementMechanism(runtime, {
      placementId: placeA.id,
      playableRoleId: "A2",
      amount: 3,
      bidId: "a2",
      now: FIXED,
    });
    runtime = bidPlacementMechanism(runtime, {
      placementId: placeA.id,
      playableRoleId: "A1",
      amount: 8,
      bidId: "a1",
      now: FIXED,
    });
    runtime = settlePlacementMechanism(runtime, { placementId: placeA.id, now: FIXED });
    assert.equal(runtime.mechanismExecutions[placeA.id].winnerRoleId, "A1");
    assert.equal(roleHasPermission(runtime, "A1", "catalog_preview_access"), true);
    assert.equal(roleHasPermission(runtime, "A2", "catalog_preview_access"), false);
    assert.equal(roleHasPermission(runtime, "A1", "evidence_custody_access"), false);
    assert.equal(fetchClueForRole(runtime, { roleId: "A1", clueId: "clue_encrypted_catalog" }).ok, true);
    assert.equal(fetchClueForRole(runtime, { roleId: "A2", clueId: "clue_encrypted_catalog" }).ok, false);

    runtime = advancePlayableStage(runtime, { now: FIXED }); // act3
    assert.equal(runtime.currentStageId, "act3");

    runtime = startPlacementMechanism(runtime, { placementId: placeB.id, now: FIXED });
    runtime = bidPlacementMechanism(runtime, {
      placementId: placeB.id,
      playableRoleId: "A3",
      amount: 11,
      bidId: "b3",
      now: FIXED,
    });
    runtime = settlePlacementMechanism(runtime, { placementId: placeB.id, now: FIXED });
    assert.equal(runtime.mechanismExecutions[placeB.id].winnerRoleId, "A3");
    assert.equal(roleHasPermission(runtime, "A3", "evidence_custody_access"), true);
    assert.equal(roleHasPermission(runtime, "A1", "evidence_custody_access"), false);
    // A still keeps catalog permission; B settle does not overwrite A
    assert.equal(roleHasPermission(runtime, "A1", "catalog_preview_access"), true);
    assert.equal(fetchClueForRole(runtime, { roleId: "A3", clueId: "clue_contested_exhibit" }).ok, true);
    assert.equal(fetchClueForRole(runtime, { roleId: "A1", clueId: "clue_contested_exhibit" }).ok, false);

    runtime = advancePlayableStage(runtime, { now: FIXED }); // act4
    runtime = startPlacementMechanism(runtime, { placementId: placeV.id, now: FIXED });
    for (const rid of ["A1", "A2", "A3", "A4", "A5", "A6"]) {
      runtime = votePlacementMechanism(runtime, {
        placementId: placeV.id,
        playableRoleId: rid,
        optionId: rid === "A1" || rid === "A2" ? "A4" : "A3",
        now: FIXED,
      });
    }
    runtime = settlePlacementMechanism(runtime, { placementId: placeV.id, now: FIXED });
    assert.equal(runtime.mechanismExecutions[placeV.id].status, "SETTLED");
    assert.equal(roleHasPermission(runtime, "A1", "ending_reveal_access"), true);
    // player decision state exists; canon truth is not a SemanticFact rewrite field
    assert.ok(runtime.keyStates.final_vote_status);
    assert.notEqual(runtime.keyStates.canonical_culprit, "A4");
  });
});

describe("P9.2 does not invent plan from preferences in engine state", () => {
  it("initial state keeps gameNarrativePlan null", () => {
    const state = createInitialProjectStoryState("p92-engine");
    assert.equal(state.gameNarrativePlan, null);
  });
});
