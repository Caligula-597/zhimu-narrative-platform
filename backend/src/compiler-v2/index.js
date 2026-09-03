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
 * Run stages synchronously (caller schedules as background job).
 * @param {{ inputFiles?: object, toStage?: string, enableTimelineLlm?: boolean }} options
 *   toStage — stop after this stage id (inclusive). Default: full pipeline to integrity_check.
 *   enableTimelineLlm — Stage 3A Host TRUE Timeline LLM (default: env COMPILER_V2_ENABLE_TIMELINE_LLM=1).
 * Stops at integrity_check — does NOT auto-commit to runtime.
 */
export async function runCompilerV2Pipeline(initialState, { inputFiles, toStage, enableTimelineLlm } = {}) {
  let state = initialState || createEmptyCompilerV2State();
  state = {
    ...state,
    job: {
      ...(state.job || {}),
      status: "processing",
      currentStage: "project_identify"
    }
  };

  const stopAt = toStage || "integrity_check";
  const stopIdx = COMPILER_V2_STAGES.indexOf(stopAt);
  const stages =
    stopIdx >= 0 ? COMPILER_V2_STAGES.slice(0, stopIdx + 1) : [...COMPILER_V2_STAGES];

  for (const stageId of stages) {
    const runner = STAGE_RUNNERS[stageId];
    if (!runner) throw new Error(`Missing stage runner: ${stageId}`);
    state = {
      ...state,
      job: { ...(state.job || {}), currentStage: stageId, status: "processing" }
    };
    let ctx = {};
    if (stageId === "project_identify") ctx = { inputFiles };
    if (stageId === "timeline_compiler") ctx = { enableLlm: enableTimelineLlm };
    state = await runner(state, ctx);
  }

  state = {
    ...state,
    job: {
      ...(state.job || {}),
      status: "needs_review",
      currentStage: stopAt
    }
  };
  return state;
}

export { STAGE_RUNNERS, COMPILER_V2_STAGES };
