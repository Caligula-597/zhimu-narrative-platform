import test from "node:test";
import assert from "node:assert/strict";
import {
  COLLISION_TYPES,
  DRAFT_OPTIMIZE,
  EDITOR_FORBIDDEN_MUTATIONS,
  FORBIDDEN_LLM_ROLES,
  GENERATION_ARCHITECTURE_VERSION,
  INFO_KIND,
  LLM_ROLES,
  PASSES,
  WORLD_DESIGN_PIPELINE,
  affectedRolesFromRefs,
  corpusAnomalyFirstRoute,
  editorMayDelete,
  isAllowedLlmRole,
  isEditorialCode,
  isQaCode,
  isResourceCollision,
  qaFailureMayGoToEditor,
  routeAnomaly,
  reworkLayerFor
} from "../shared/world-engine/index.js";

test("V9 three-pass freeze splits writer, editor, and game QA", () => {
  assert.equal(GENERATION_ARCHITECTURE_VERSION, "9.0");
  assert.deepEqual(WORLD_DESIGN_PIPELINE[0], "dramatic_premise");
  assert.deepEqual(WORLD_DESIGN_PIPELINE.at(-1), "current_situation");
  assert.ok(PASSES.indexOf("draft") < PASSES.indexOf("editorial"));
  assert.ok(PASSES.indexOf("editorial") < PASSES.indexOf("fairness_qa"));
  assert.ok(PASSES.indexOf("host_truth_sheet") < PASSES.indexOf("draft"));
  assert.ok(PASSES.indexOf("final_host_manual") > PASSES.indexOf("interestingness_qa"));
  assert.deepEqual(DRAFT_OPTIMIZE, [
    "coverage",
    "perspective_integrity",
    "cross_role_consistency",
    "character_coherence"
  ]);
  assert.equal(isAllowedLlmRole("writer"), true);
  assert.equal(isAllowedLlmRole("editor"), true);
  assert.equal(isAllowedLlmRole("fairness_qa"), true);
  assert.equal(isAllowedLlmRole("situation_writer"), false);
  assert.ok(FORBIDDEN_LLM_ROLES.includes("fun_rewriter"));
  assert.ok(FORBIDDEN_LLM_ROLES.includes("fairness_editor"));
  assert.ok(FORBIDDEN_LLM_ROLES.includes("language_optimizer"));
  assert.ok(LLM_ROLES.includes("editorial_diagnoser"));
  assert.equal(isResourceCollision("unpaid_obligation"), true);
  assert.equal(isResourceCollision("trust_theme"), false);
  assert.ok(!COLLISION_TYPES.includes("thematic_echo"));
});

test("editorial problems do not route to world rebuild; QA never goes to editor", () => {
  assert.equal(isEditorialCode("semantic_redundancy"), true);
  assert.equal(isEditorialCode("cross_role_repetition"), true);
  assert.equal(routeAnomaly("semantic_redundancy"), "editorial_pass");
  assert.equal(routeAnomaly("voice_homogenization"), "editorial_pass");
  assert.equal(corpusAnomalyFirstRoute(), "editorial_diagnosis");
  assert.equal(isQaCode("underpowered_role"), true);
  assert.equal(routeAnomaly("underpowered_role"), "game_design_upstream");
  assert.equal(routeAnomaly("overpowered_role"), "game_design_upstream");
  assert.equal(qaFailureMayGoToEditor(), false);
  assert.equal(editorMayDelete(INFO_KIND.INTERPRETATION_OPTIONAL), true);
  assert.equal(editorMayDelete(INFO_KIND.FACT_REQUIRED), false);
  assert.ok(EDITOR_FORBIDDEN_MUTATIONS.includes("new_secret"));
  assert.equal(reworkLayerFor("opening_state_saturation"), "act_entry");
  assert.deepEqual(
    affectedRolesFromRefs(["RT_006"], { RT_006: ["CHAR_001", "CHAR_007"] }),
    ["CHAR_001", "CHAR_007"]
  );
});
