import { markStageComplete, pushUnresolved, pushWarning } from "../state.js";

/**
 * Stage 3 — Timeline Compiler (LLM-backed later).
 * Deterministic pass: does not invent events. Marks UNCERTAIN / needs LLM.
 * Must NOT write locationId — only locationHint when LLM path is enabled.
 */
export async function stage3TimelineCompiler(state) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "timeline_compiler" },
    timelineTracks: state.timelineTracks || [],
    timelineEvents: state.timelineEvents || []
  };

  const host = (state.documents || []).find((d) => d.kind === "HOST_BOOK");
  if (!host?.text) {
    next = pushWarning(next, {
      code: "TIMELINE_NO_HOST",
      message: "无主持手册文本，跳过时间线提取"
    });
    return markStageComplete(next, "timeline_compiler");
  }

  next = pushUnresolved(next, {
    kind: "NEEDS_LLM",
    field: "timelineEvents",
    message:
      "主时间线 / 角色分支时间线需 LLM 提取；当前骨架未自动猜测事件。不确定项不得标 CONFIRMED。",
    evidence: [`hostDoc=${host.id}`]
  });

  return markStageComplete(next, "timeline_compiler");
}
