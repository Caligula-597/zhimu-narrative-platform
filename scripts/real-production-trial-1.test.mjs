/**
 * Real Production Trial #1 — dry/mock harness smoke (no network required).
 * P10.2: author accepts recommended fidelity bundle (not distinct-family top-3).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  runRealProductionTrial,
  selectAuthorStoryAccepts,
} from "../shared/real-production-trial.js";
import { buildStoryCandidatePlan } from "../shared/creation-candidate-planner.js";
import { listStoryTemplates } from "../shared/story-mechanism-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.resolve(__dirname, "../trials/rpt-1-closed-after-hours/trial-input.json");

describe("Real Production Trial #1 harness", () => {
  it("author policy accepts recommended fidelity bundle", () => {
    const trialInput = JSON.parse(fs.readFileSync(INPUT, "utf8"));
    const plan = buildStoryCandidatePlan(trialInput.creationSpec, listStoryTemplates(), {
      authorConfirmedExperienceAnchors: trialInput.authorConfirmedExperienceAnchors,
    });
    const accepts = selectAuthorStoryAccepts(plan, trialInput.authorPolicy);
    assert.ok(accepts.length >= 2);
    assert.ok(accepts.length <= 3);
    assert.deepEqual(
      accepts.map((a) => a.templateId),
      plan.recommendedBundle.blockTemplateIds,
    );
    assert.equal(accepts[0].intentionalOverlap, false);
    if (accepts[1]) assert.equal(accepts[1].intentionalOverlap, true);
  });

  it("mock mode runs CreationSpec→Package→Quality without developer firefighting on happy path", async () => {
    const trialInput = JSON.parse(fs.readFileSync(INPUT, "utf8"));
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpt1-"));
    const result = await runRealProductionTrial({
      trialInput,
      outDir,
      writerMode: "mock",
      now: () => "2026-09-06T13:00:00.000Z",
    });
    assert.ok(["TRIAL_PARTIAL", "TRIAL_PASS_CANDIDATE", "TRIAL_FAIL"].includes(result.trialVerdict));
    assert.ok(fs.existsSync(path.join(outDir, "complete-script-package.json")));
    assert.ok(fs.existsSync(path.join(outDir, "quality-report.json")));
    assert.ok(fs.existsSync(path.join(outDir, "author-decisions.json")));
    assert.ok(fs.existsSync(path.join(outDir, "readable-scripts.md")));
    assert.ok(fs.existsSync(path.join(outDir, "creation-intent-fidelity-report.json")));
    assert.equal(result.humanIntervention.developerFirefighting, 0);
    assert.ok(result.humanIntervention.authorConfirmations >= 1);
    assert.equal(trialInput.rules.noGenFixture, true);
  });
});
