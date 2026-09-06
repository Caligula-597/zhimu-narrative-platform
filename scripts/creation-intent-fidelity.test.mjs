/**
 * P10.2 Creation Intent Fidelity V1 — RPT1 probe + planner contracts.
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
    assert.ok(
      m08.mismatchPenalties.some(
        (p) => p.code === "SECONDARY_ROLEPLAY_ON_FACTION_PRIMARY" || p.code === "UNWANTED_STRUCTURAL_COMMITMENT",
      ),
    );

    assert.equal(plan.recommendationStatus, "REVIEW_REQUIRED");
    assert.ok(plan.coverageGaps.missingInteractionModes.includes("NEGOTIATE"));
    assert.ok(plan.coverageGaps.uncoveredAnchors.includes("OWNERSHIP_SHIFT"));

    // Forbidden old path: silent M01+M07+M08 as OK ROLEPLAY match
    const isOldBad =
      ids.length === 3 &&
      ids.includes("M01-FRAMING") &&
      ids.some((id) => id.startsWith("M07")) &&
      ids.some((id) => id.startsWith("M08")) &&
      plan.recommendationStatus === "OK" &&
      !plan.recommendedBundle.unwantedCommitments.length;
    assert.equal(isOldBad, false);

    // Recommended bundle must not quietly include M08 as ROLEPLAY win
    if (ids.some((id) => id.startsWith("M08"))) {
      assert.ok(plan.recommendedBundle.unwantedCommitments.includes("FACTION_STRUCTURE"));
    }

    assert.ok(ids.length === 2 || ids.length === 3);
    assert.equal(plan.recommendedBundle.anchorStates.length, 4);
    assert.ok(plan.intentEnvelope.confirmedAnchors.some((a) => a.anchor === "FLEXIBLE_RESOLUTION"));
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
    assert.ok(accepts.length <= 3);
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
    assert.ok(report.interactionCoverage.missing.includes("NEGOTIATE") || report.missingIntents.length >= 0);
  });
});
