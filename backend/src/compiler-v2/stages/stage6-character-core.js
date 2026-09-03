import { markStageComplete, pushUnresolved } from "../state.js";

/**
 * Stage 6 — Character Core Extractor (LLM later).
 * Does not invent cores; queues NEEDS_LLM for review.
 */
export async function stage6CharacterCoreExtractor(state) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "character_core" },
    characterCores: state.characterCores || []
  };

  if ((state.characters || []).length) {
    next = pushUnresolved(next, {
      kind: "NEEDS_LLM",
      field: "characterCores",
      message:
        "角色核心信息（身份/背景/秘密/每幕目标）需 LLM 从角色本提炼，并挂 sourceRefs；当前不自动编造。",
      evidence: (state.characters || []).map((c) => c.id)
    });
  }

  return markStageComplete(next, "character_core");
}
