/**
 * P10.2 / P10.3 Creation Intent Fidelity + Experience Coverage probes.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildStoryCandidatePlan } from "../shared/creation-candidate-planner.js";
import { buildCreationIntentEnvelope } from "../shared/creation-intent-envelope.js";
import { auditCreationIntentFidelity } from "../shared/creation-intent-fidelity-audit.js";
import { getStoryExperienceProfile, listCompleteExperienceTemplateIds } from "../shared/story-experience-profile.js";
import { listStoryTemplates } from "../shared/story-mechanism-registry.js";
import { selectAuthorStoryAccepts } from "../shared/real-production-trial.js";
import {
  generateStoryMechanism,
  createInitialProjectStoryState,
} from "../shared/story-mechanism-engine.js";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.resolve(__dirname, "../trials/rpt-1-closed-after-hours/trial-input.json");

function loadRpt1() {
  return JSON.parse(fs.readFileSync(INPUT, "utf8"));
}

describe("P10.2 Experience Profile metadata", () => {
  it("COMPLETE templates have READY profiles with primary ≠ ROLEPLAY-only for M08", () => {
    const ids = listCompleteExperienceTemplateIds();
    assert.ok(ids.includes("M01-FRAMING"));
    assert.ok(ids.includes("M08-1"));
    assert.ok(ids.includes("M12-1"));
    const m08 = getStoryExperienceProfile("M08-1");
    assert.equal(m08.status, "READY");
    assert.ok(m08.primaryAxes.includes("FACTION"));
    assert.ok(!m08.primaryAxes.includes("ROLEPLAY"));
    assert.ok(m08.secondaryAxes.includes("ROLEPLAY"));
    assert.ok(m08.structuralCommitments.includes("FACTION_STRUCTURE"));
    const foundation = getStoryExperienceProfile("M10-1");
    assert.equal(foundation.status, "EXPERIENCE_PROFILE_INCOMPLETE");
  });
});

describe("P10.2 Intent Envelope", () => {
  it("maps author-confirmed anchors; does not NLP mustKeep", () => {
    const trial = loadRpt1();
    const env = buildCreationIntentEnvelope(trial.creationSpec, {
      authorConfirmedExperienceAnchors: trial.authorConfirmedExperienceAnchors,
    });
    assert.equal(env.dominantAxis, "ROLEPLAY");
    assert.ok(env.desiredPrimaryAxes.some((a) => a.axis === "DEDUCTION"));
    assert.ok(env.lowInterestAxes.some((a) => a.axis === "FACTION"));
    assert.ok(env.desiredInteractionModes.some((m) => m.mode === "NEGOTIATE"));
    assert.equal(env.confirmedAnchors.length, 4);
    assert.equal(env.unresolvedExplicitIntents.length, 0);
    assert.equal(env.fidelityGateHint, "READY");
  });

  it("unmapped mustKeep → REVIEW_REQUIRED / UNRESOLVED_EXPLICIT_INTENT", () => {
    const trial = loadRpt1();
    const env = buildCreationIntentEnvelope(trial.creationSpec, {
      authorConfirmedExperienceAnchors: [],
    });
    assert.ok(env.unresolvedExplicitIntents.length >= 3);
    assert.equal(env.fidelityGateHint, "REVIEW_REQUIRED");
  });
});

describe("P10.2 RPT1 Planner Probe", () => {
  it("does not prefer M08 solely for ROLEPLAY when faction=0.35", () => {
    const trial = loadRpt1();
    const plan = buildStoryCandidatePlan(trial.creationSpec, listStoryTemplates(), {
      authorConfirmedExperienceAnchors: trial.authorConfirmedExperienceAnchors,
    });
    assert.ok(plan.recommendedBundle);
    const ids = plan.recommendedBundle.blockTemplateIds;

    const m08 = plan.candidates.find((c) => c.templateId.startsWith("M08"));
    assert.ok(m08, "M08 retained in candidates for reject reasons");
    assert.ok(
      m08.warnings.some((w) => String(w).includes("UNWANTED_STRUCTURAL_COMMITMENT") || w === "NOT_ROLEPLAY_PRIMARY"),
    );

    assert.equal(ids.some((id) => id.startsWith("M08")), false);
    const isOldBad =
      ids.length === 3 &&
      ids.includes("M01-FRAMING") &&
      ids.some((id) => id.startsWith("M07")) &&
      ids.some((id) => id.startsWith("M08"));
    assert.equal(isOldBad, false);
    assert.equal(plan.recommendedBundle.anchorStates.length, 4);
  });

  it("author policy accepts recommended bundle (not distinct-family top-3)", () => {
    const trial = loadRpt1();
    const plan = buildStoryCandidatePlan(trial.creationSpec, listStoryTemplates(), {
      authorConfirmedExperienceAnchors: trial.authorConfirmedExperienceAnchors,
    });
    const accepts = selectAuthorStoryAccepts(plan, trial.authorPolicy);
    assert.deepEqual(
      accepts.map((a) => a.templateId),
      plan.recommendedBundle.blockTemplateIds,
    );
    assert.ok(accepts.every((a) => a.fromRecommendedBundle));
    assert.ok(accepts.length >= 1 && accepts.length <= 3);
  });
});

describe("P10.3 STORY Experience Coverage", () => {
  it("M12-1 declares RELATIONSHIP_BARGAIN + player-caused OWNERSHIP_SHIFT + OPEN", () => {
    const p = getStoryExperienceProfile("M12-1");
    assert.equal(p.status, "READY");
    assert.ok(p.structuralCommitments.includes("RELATIONSHIP_BARGAIN"));
    assert.ok(p.interactionModes.includes("NEGOTIATE"));
    assert.ok(p.interactionModes.includes("EXCHANGE"));
    assert.ok(p.supportedAnchors.includes("OWNERSHIP_SHIFT"));
    assert.ok(p.supportedAnchors.includes("FLEXIBLE_RESOLUTION"));
    assert.equal(p.resolutionPressure, "OPEN");
    assert.ok(p.experienceMoments.some((m) => m.kind === "OWNERSHIP_SHIFT" && m.playerCaused === true));
  });

  it("M12-1 generates via generic engine without dedicated producer", () => {
    let state = createInitialProjectStoryState("m12-gen");
    state = createProjectStoryState({
      ...state,
      premise: { genre: "当代", era: "CONTEMPORARY", tone: [], playerCount: 6, targetDuration: 210 },
      characters: [
        { id: "P1", name: "A", gender: "FEMALE" },
        { id: "P2", name: "B", gender: "MALE" },
        { id: "P3", name: "C", gender: "FEMALE" },
        { id: "P4", name: "D", gender: "MALE" },
        { id: "P5", name: "E", gender: "FEMALE" },
        { id: "P6", name: "F", gender: "MALE" },
      ],
      stages: [{ id: "act1" }, { id: "act2" }, { id: "act3" }, { id: "act4" }],
    });
    state = generateStoryMechanism({ templateId: "M12-1", projectStoryState: state });
    const block = state.mechanismBlocks[0];
    assert.equal(block.templateId, "M12-1");
    assert.ok(block.roleBindings.bargainA);
    assert.ok(block.roleBindings.bargainB);
  });

  it("Pre-Writer RPT1 clears core coverage gates without M08 / crime capture", () => {
    const trial = loadRpt1();
    const plan = buildStoryCandidatePlan(trial.creationSpec, listStoryTemplates(), {
      authorConfirmedExperienceAnchors: trial.authorConfirmedExperienceAnchors,
    });
    const b = plan.recommendedBundle;
    assert.equal(plan.recommendationStatus, "OK");
    assert.ok(b.blockTemplateIds.includes("M12-1"));
    assert.equal(b.blockTemplateIds.some((id) => id.startsWith("M08")), false);
    assert.equal(b.warnings.includes("RESOLUTION_MODE_CAPTURE"), false);
    assert.ok(b.blockTemplateIds.length <= 2);
    assert.equal(b.missingInteractionModes.includes("NEGOTIATE"), false);
    const ownership = b.anchorStates.find((a) => a.anchor === "OWNERSHIP_SHIFT");
    const flex = b.anchorStates.find((a) => a.anchor === "FLEXIBLE_RESOLUTION");
    const early = b.anchorStates.find((a) => a.anchor === "EARLY_AGENCY");
    assert.equal(ownership?.status, "COVERED_BY_PROFILE");
    assert.equal(flex?.status, "COVERED_BY_PROFILE");
    assert.equal(early?.status, "COVERED_BY_PROFILE");
    assert.ok(!b.introducedCommitments.includes("FACTION_STRUCTURE"));
  });
});

describe("P10.2 Post-accept audit", () => {
  it("flags FACTION_STRUCTURE unwanted + ownership narration-only for M01+M07+M08", () => {
    const trial = loadRpt1();
    const report = auditCreationIntentFidelity({
      creationSpec: trial.creationSpec,
      authorConfirmedExperienceAnchors: trial.authorConfirmedExperienceAnchors,
      acceptedBlocks: [
        { templateId: "M01-FRAMING", status: "USER_ACCEPTED", roleBindings: {}, completeBeat: { phases: {} } },
        { templateId: "M07-1", status: "USER_ACCEPTED", roleBindings: {}, completeBeat: { phases: {} } },
        { templateId: "M08-1", status: "USER_ACCEPTED", roleBindings: {}, completeBeat: { phases: {} } },
      ],
      playerRoleIds: ["P1", "P2", "P3", "P4", "P5", "P6"],
    });
    assert.equal(report.readOnly, true);
    assert.ok(report.unwantedCommitments.includes("FACTION_STRUCTURE"));
    assert.notEqual(report.status, "PASS");
    assert.ok(report.ownershipShift.status === "NARRATION_ONLY" || report.ownershipShift.status === "ABSENT");
  });

  it("M12 accepted bundle reports player-caused ownership shift", () => {
    const trial = loadRpt1();
    const report = auditCreationIntentFidelity({
      creationSpec: trial.creationSpec,
      authorConfirmedExperienceAnchors: trial.authorConfirmedExperienceAnchors,
      acceptedBlocks: [
        { templateId: "M12-1", status: "USER_ACCEPTED", roleBindings: {}, completeBeat: { phases: {} } },
      ],
      playerRoleIds: ["P1", "P2", "P3", "P4", "P5", "P6"],
    });
    assert.equal(report.ownershipShift.status, "PLAYER_CAUSED");
    assert.equal(report.unwantedCommitments.includes("FACTION_STRUCTURE"), false);
  });
});
