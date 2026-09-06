/**
 * P10.2 — Pre-Writer RPT1 replay (no Writer / no LLM).
 * Prints Creation Intent bundle recommendation for 《闭馆之后》.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStoryCandidatePlan } from "../shared/creation-candidate-planner.js";
import { listStoryTemplates } from "../shared/story-mechanism-registry.js";
import { selectAuthorStoryAccepts } from "../shared/real-production-trial.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.resolve(__dirname, "../trials/rpt-1-closed-after-hours/trial-input.json");

const trial = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const plan = buildStoryCandidatePlan(trial.creationSpec, listStoryTemplates(), {
  authorConfirmedExperienceAnchors: trial.authorConfirmedExperienceAnchors,
});
const accepts = selectAuthorStoryAccepts(plan, trial.authorPolicy);

const out = {
  trialId: trial.trialId,
  title: trial.title,
  recommendationStatus: plan.recommendationStatus,
  recommendedBundle: plan.recommendedBundle
    ? {
        blockTemplateIds: plan.recommendedBundle.blockTemplateIds,
        fidelityScore: plan.recommendedBundle.fidelityScore,
        interactionCoverage: plan.recommendedBundle.interactionCoverage,
        unwantedCommitments: plan.recommendedBundle.unwantedCommitments,
        missingInteractionModes: plan.recommendedBundle.missingInteractionModes,
        anchorStates: plan.recommendedBundle.anchorStates,
        warnings: plan.recommendedBundle.warnings,
        reasons: plan.recommendedBundle.reasons,
      }
    : null,
  coverageGaps: plan.coverageGaps,
  authorWouldAccept: accepts.map((a) => a.templateId),
  m08RejectSample: plan.candidates
    .filter((c) => String(c.templateId).startsWith("M08"))
    .slice(0, 2)
    .map((c) => ({
      templateId: c.templateId,
      fidelityScore: c.fidelityScore,
      warnings: c.warnings,
      mismatchPenalties: c.mismatchPenalties,
      provides: c.provides,
    })),
  intent: {
    dominantAxis: plan.intentEnvelope?.dominantAxis,
    desiredPrimaryAxes: plan.intentEnvelope?.desiredPrimaryAxes,
    desiredInteractionModes: plan.intentEnvelope?.desiredInteractionModes,
    confirmedAnchors: plan.intentEnvelope?.confirmedAnchors,
  },
};

const outDir = path.resolve(__dirname, "../trials/rpt-1-closed-after-hours/p10-2-prewriter");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "replay-summary.json");
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");

console.log("P10.2 Pre-Writer RPT1 Replay");
console.log(`  status=${out.recommendationStatus}`);
console.log(`  bundle=${JSON.stringify(out.recommendedBundle?.blockTemplateIds)}`);
console.log(`  gaps=${JSON.stringify(out.coverageGaps)}`);
console.log(`  wrote ${outPath}`);
