import assert from "node:assert/strict";
import test from "node:test";

import { validateStoryEvaluation } from "../src/deepseek-validation/evaluation-validator.js";

test("story evaluation cannot import a mechanically fair but dramatically flat script", () => {
  const evaluation = validateStoryEvaluation({
    overallScore: 8.5,
    scores: {
      playability: 9,
      fairness: 9,
      styleFit: 9,
      humanAuthorship: 8,
      sourceFidelity: 8,
      subtext: 8,
      voiceDistinctness: 8,
      dramaticTension: 4
    },
    sourceFidelityAudit: { verdict: "preserved" },
    issues: [],
    revisions: [],
    readyForImport: true
  });

  assert.equal(evaluation.readyForImport, false);
  assert.equal(evaluation.scores.dramaticTension, 4);
});

test("story evaluation requires the new tension score instead of defaulting it to a pass", () => {
  const evaluation = validateStoryEvaluation({
    overallScore: 9,
    scores: {
      playability: 9,
      fairness: 9,
      styleFit: 9,
      humanAuthorship: 9,
      sourceFidelity: 9,
      subtext: 9,
      voiceDistinctness: 9
    },
    sourceFidelityAudit: { verdict: "preserved" },
    issues: [],
    revisions: [],
    readyForImport: true
  });

  assert.equal(evaluation.scores.dramaticTension, 1);
  assert.equal(evaluation.readyForImport, false);
});
