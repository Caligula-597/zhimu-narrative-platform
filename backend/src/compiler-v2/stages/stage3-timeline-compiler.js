import {
  markStageComplete,
  pushUnresolved,
  pushWarning,
  DETECTION_STATUS
} from "../state.js";
import { deepseekConfig } from "../../deepseek-config.js";
import { extractHostTrueTimelineV2 } from "../host-timeline/pipeline.js";

/**
 * Stage 3 — Timeline Compiler.
 *
 * Stage 3A V2: HostHandbook → TRUE Timeline (Stateful Reader).
 * Does NOT extract character belief tracks, Scene IDs, or mechanisms.
 *
 * enableLlm: explicit option, or env COMPILER_V2_ENABLE_TIMELINE_LLM=1
 * Without LLM → timelineEvents=[] + NEEDS_LLM (healthy empty).
 */
export async function stage3TimelineCompiler(state, { enableLlm } = {}) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "timeline_compiler" },
    timelineTracks: [],
    timelineEvents: [],
    globalStoryMap: null,
    storyMemory: null,
    eventCandidates: [],
    sourceDispositions: [],
    candidateDispositions: [],
    timelineTransitions: [],
    timelineDisplayGroups: []
  };

  const host = (state.documents || []).find((d) => d.kind === "HOST_BOOK");
  if (!host?.text) {
    next = pushWarning(next, {
      code: "TIMELINE_NO_HOST",
      message: "无主持手册文本，跳过时间线提取"
    });
    return markStageComplete(next, "timeline_compiler");
  }

  const envOn = String(process.env.COMPILER_V2_ENABLE_TIMELINE_LLM || "").trim() === "1";
  const shouldRunLlm = enableLlm === true || (enableLlm !== false && envOn);

  if (!shouldRunLlm) {
    next = pushUnresolved(next, {
      kind: "NEEDS_LLM",
      field: "timelineEvents",
      message:
        "Stage 3A V2 Host TRUE Timeline 需启用 LLM（传 enableLlm 或 COMPILER_V2_ENABLE_TIMELINE_LLM=1）；未启用时不猜测事件。",
      evidence: [`hostDoc=${host.id}`]
    });
    return markStageComplete(next, "timeline_compiler");
  }

  if (!deepseekConfig().configured) {
    next = pushUnresolved(next, {
      kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
      field: "timelineEvents",
      message: "已请求 Stage 3A V2 LLM，但 DEEPSEEK_API_KEY 未配置",
      evidence: [`hostDoc=${host.id}`]
    });
    return markStageComplete(next, "timeline_compiler");
  }

  try {
    const result = await extractHostTrueTimelineV2(state);
    next = {
      ...next,
      timelineEvents: result.events,
      timelineTracks: result.track ? [result.track] : [],
      timelineMeta: result.meta,
      globalStoryMap: result.globalStoryMap,
      storyMemory: result.storyMemory,
      eventCandidates: result.eventCandidates,
      sourceDispositions: result.sourceDispositions,
      candidateDispositions: result.candidateDispositions,
      timelineTransitions: result.timelineTransitions,
      timelineDisplayGroups: result.timelineDisplayGroups
    };

    const missingRefs = result.events.filter((e) => !(e.sourceSectionIds || []).length);
    if (missingRefs.length) {
      next = pushWarning(next, {
        code: "TIMELINE_MISSING_SOURCE_REFS",
        message: `${missingRefs.length} 条时间线事件缺少有效 sourceSectionIds`,
        evidence: missingRefs.slice(0, 5).map((e) => e.id)
      });
    }

    const autoDisp = result.meta?.passes?.pass1?.autoFilledDispositions || 0;
    if (autoDisp > 0) {
      next = pushWarning(next, {
        code: "TIMELINE_SOURCE_DISPOSITION_AUTOFILL",
        message: `${autoDisp} 个 Host SourceSection 缺少模型 disposition，已自动补 NO_TIMELINE_CONTENT（需审计）`
      });
    }

    if (result.meta?.silentCandidateLoss > 0) {
      next = pushWarning(next, {
        code: "TIMELINE_SILENT_LOSS_RECOVERED",
        message: `${result.meta.silentCandidateLoss} 个候选曾被静默遗漏，已强制 CANONICAL（invariant: silent loss = 0）`
      });
    }

    if (!result.events.length) {
      next = pushWarning(next, {
        code: "TIMELINE_EMPTY",
        message: "Stage 3A V2 LLM 未产出任何 TRUE 事件"
      });
    }
  } catch (error) {
    next = pushUnresolved(next, {
      kind: "NEEDS_LLM",
      field: "timelineEvents",
      message: `Stage 3A V2 Host TRUE Timeline 失败：${error?.message || error}`,
      evidence: [`hostDoc=${host.id}`]
    });
  }

  return markStageComplete(next, "timeline_compiler");
}
