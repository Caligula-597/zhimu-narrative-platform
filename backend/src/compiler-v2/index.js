/**
 * Compiler V2 pipeline orchestrator.
 * Contract: each stage receives full CompilerV2State and returns updated state.
 */

import { COMPILER_V2_STAGES, createEmptyCompilerV2State } from "./state.js";
import { stage1ProjectIdentify } from "./stages/stage1-project-identify.js";
import { stage2ManuscriptIngest } from "./stages/stage2-manuscript-ingest.js";
import { stage3TimelineCompiler } from "./stages/stage3-timeline-compiler.js";
import { stage4SceneResolver } from "./stages/stage4-scene-resolver.js";
import { stage5ClueAssetImport } from "./stages/stage5-clue-asset.js";
import { stage6CharacterCoreExtractor } from "./stages/stage6-character-core.js";
import { stage7MechanismRuntimeCompiler } from "./stages/stage7-mechanism-runtime.js";
import { stage8IntegrityValidator } from "./stages/stage8-integrity-check.js";

const STAGE_RUNNERS = Object.freeze({
  project_identify: stage1ProjectIdentify,
  manuscript_ingest: stage2ManuscriptIngest,
  timeline_compiler: stage3TimelineCompiler,
  scene_resolver: stage4SceneResolver,
  clue_asset: stage5ClueAssetImport,
  character_core: stage6CharacterCoreExtractor,
  mechanism_runtime: stage7MechanismRuntimeCompiler,
  integrity_check: stage8IntegrityValidator
});

/**
 * Run all stages synchronously (caller schedules as background job).
 * Stops at integrity_check — does NOT auto-commit to runtime.
 */
export async function runCompilerV2Pipeline(initialState, { inputFiles } = {}) {
  let state = initialState || createEmptyCompilerV2State();
  state = {
    ...state,
    job: {
      ...(state.job || {}),
      status: "processing",
      currentStage: "project_identify"
    }
  };

  for (const stageId of COMPILER_V2_STAGES) {
    const runner = STAGE_RUNNERS[stageId];
    if (!runner) throw new Error(`Missing stage runner: ${stageId}`);
    state = {
      ...state,
      job: { ...(state.job || {}), currentStage: stageId, status: "processing" }
    };
    const ctx = stageId === "project_identify" ? { inputFiles } : {};
    state = await runner(state, ctx);
  }

  // Always land in needs_review — AI 整理 ≠ 作者确认
  state = {
    ...state,
    job: {
      ...(state.job || {}),
      status: "needs_review",
      currentStage: "integrity_check"
    }
  };
  return state;
}

export { STAGE_RUNNERS, COMPILER_V2_STAGES };
