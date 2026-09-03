import {
  markStageComplete,
  pushUnresolved,
  pushWarning,
  DETECTION_STATUS
} from "../state.js";
import { deepseekConfig } from "../../deepseek-config.js";
import { extractHostTrueTimeline } from "../host-true-timeline.js";

/**
 * Stage 3 — Timeline Compiler.
 *
 * Stage 3A (this pass): HostHandbook → TRUE Timeline only.
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
    timelineEvents: []
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
        "Stage 3A Host TRUE Timeline 需启用 LLM（传 enableLlm 或 COMPILER_V2_ENABLE_TIMELINE_LLM=1）；未启用时不猜测事件。",
      evidence: [`hostDoc=${host.id}`]
    });
    return markStageComplete(next, "timeline_compiler");
  }

  if (!deepseekConfig().configured) {
    next = pushUnresolved(next, {
      kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
      field: "timelineEvents",
      message: "已请求 Stage 3A LLM，但 DEEPSEEK_API_KEY 未配置",
      evidence: [`hostDoc=${host.id}`]
    });
    return markStageComplete(next, "timeline_compiler");
  }

  try {
    const { events, track, meta } = await extractHostTrueTimeline(state);
    next = {
      ...next,
      timelineEvents: events,
      timelineTracks: track ? [track] : [],
      timelineMeta: meta
    };

    const missingRefs = events.filter((e) => !(e.sourceSectionIds || []).length);
    if (missingRefs.length) {
      next = pushWarning(next, {
        code: "TIMELINE_MISSING_SOURCE_REFS",
        message: `${missingRefs.length} 条时间线事件缺少有效 sourceSectionIds`,
        evidence: missingRefs.slice(0, 5).map((e) => e.id)
      });
    }
    if (!events.length) {
      next = pushWarning(next, {
        code: "TIMELINE_EMPTY",
        message: "Stage 3A LLM 未产出任何 TRUE 事件"
      });
    }
  } catch (error) {
    next = pushUnresolved(next, {
      kind: "NEEDS_LLM",
      field: "timelineEvents",
      message: `Stage 3A Host TRUE Timeline 失败：${error?.message || error}`,
      evidence: [`hostDoc=${host.id}`]
    });
  }

  return markStageComplete(next, "timeline_compiler");
}
