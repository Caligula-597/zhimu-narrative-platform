import {
  markStageComplete,
  pushUnresolved,
  pushWarning,
  DETECTION_STATUS
} from "../state.js";
import { deepseekConfig } from "../../deepseek-config.js";
import { compileCanonMemoryFromState } from "../canon-memory/compiler.js";

/**
 * Stage 2.5 — CanonMemoryCompiler V1.
 * Dual-channel: GlobalOutline + SectionCapsules → CanonMemory.
 * Does NOT derive Timeline / CharacterCore / Mechanism.
 */
export async function stage25CanonMemoryCompiler(state, { enableLlm, useCache = true, concurrency } = {}) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "canon_memory" },
    canonMemory: null,
    globalOutline: null,
    sectionCapsules: [],
    sourceCoverage: null,
    canonMeta: null
  };

  const host = (state.documents || []).find((d) => d.kind === "HOST_BOOK");
  if (!host) {
    next = pushWarning(next, {
      code: "CANON_NO_HOST",
      message: "无主持手册，跳过 CanonMemory 编译"
    });
    return markStageComplete(next, "canon_memory");
  }

  const hostSections = (state.sourceSections || []).filter((s) => s.documentId === host.id);
  if (!hostSections.length) {
    next = pushWarning(next, {
      code: "CANON_NO_SECTIONS",
      message: "主持手册无 SourceSections，跳过 CanonMemory 编译"
    });
    return markStageComplete(next, "canon_memory");
  }

  const envOn = String(process.env.COMPILER_V2_ENABLE_CANON_LLM || "").trim() === "1";
  const shouldRunLlm = enableLlm === true || (enableLlm !== false && envOn);

  if (!shouldRunLlm) {
    next = pushUnresolved(next, {
      kind: "NEEDS_LLM",
      field: "canonMemory",
      message:
        "Stage 2.5 CanonMemory 需启用 LLM（传 enableLlm 或 COMPILER_V2_ENABLE_CANON_LLM=1）；未启用时不猜测 Canon。",
      evidence: [`hostDoc=${host.id}`, `sections=${hostSections.length}`]
    });
    return markStageComplete(next, "canon_memory");
  }

  if (!deepseekConfig().configured) {
    next = pushUnresolved(next, {
      kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
      field: "canonMemory",
      message: "已请求 Stage 2.5 Canon LLM，但 DEEPSEEK_API_KEY 未配置",
      evidence: [`hostDoc=${host.id}`]
    });
    return markStageComplete(next, "canon_memory");
  }

  try {
    const result = await compileCanonMemoryFromState(next, { useCache, concurrency });
    next = {
      ...next,
      canonMemory: result.canonMemory,
      globalOutline: result.globalOutline,
      sectionCapsules: result.sectionCapsules,
      sourceCoverage: result.sourceCoverage,
      canonMeta: result.meta
    };

    if (result.sourceCoverage?.missing?.length) {
      next = pushUnresolved(next, {
        kind: "COVERAGE_GAP",
        field: "sourceCoverage",
        message: `Canon 覆盖缺口：${result.sourceCoverage.missing.length} 段无 Capsule`,
        evidence: result.sourceCoverage.missing.slice(0, 10)
      });
    }
    if (result.sourceCoverage?.suspicious?.length) {
      next = pushWarning(next, {
        code: "CANON_SUSPICIOUS_SECTIONS",
        message: `${result.sourceCoverage.suspicious.length} 段 Capsule 疑似漏读，需人工审查`,
        evidence: result.sourceCoverage.suspicious.slice(0, 8)
      });
    }
  } catch (err) {
    next = pushUnresolved(next, {
      kind: "LLM_FAILED",
      field: "canonMemory",
      message: String(err?.message || err).slice(0, 240),
      evidence: [`hostDoc=${host.id}`]
    });
  }

  return markStageComplete(next, "canon_memory");
}
