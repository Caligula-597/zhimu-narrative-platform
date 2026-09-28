import { CANON_COMPILER_VERSION, DEFAULT_CAPSULE_CONCURRENCY, DEFAULT_ENABLE_RECOVERY } from "./constants.js";
import { auditSourceCoverage } from "./coverage.js";
import { compileGlobalOutline } from "./global-outline.js";
import { mergeCanonMemory } from "./merge.js";
import { compileSectionCapsule, compileSectionCapsulesBatch } from "./section-capsule.js";

function sumUsage(usages = []) {
  return usages.reduce(
    (acc, u) => ({
      promptTokens: acc.promptTokens + (u?.promptTokens || u?.prompt_tokens || 0),
      completionTokens: acc.completionTokens + (u?.completionTokens || u?.completion_tokens || 0),
      totalTokens: acc.totalTokens + (u?.totalTokens || u?.total_tokens || 0)
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );
}

function hostSectionsFromState(state) {
  const host = (state.documents || []).find((d) => d.kind === "HOST_BOOK");
  if (!host?.id) return [];
  return (state.sourceSections || []).filter((s) => s.documentId === host.id);
}

/**
 * Stage 2.5 — dual-channel Canon compile: GlobalOutline + SectionCapsules → CanonMemory.
 */
export async function compileCanonMemoryFromState(state, {
  requestJson,
  useCache = true,
  concurrency = DEFAULT_CAPSULE_CONCURRENCY,
  enableRecovery = DEFAULT_ENABLE_RECOVERY,
  modelTag = "default"
} = {}) {
  const sections = hostSectionsFromState(state);
  const meta = {
    compilerVersion: CANON_COMPILER_VERSION,
    sectionCount: sections.length,
    calls: 0,
    cacheHits: 0,
    recoveryCount: 0,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  };

  if (!sections.length) {
    return {
      canonMemory: mergeCanonMemory({
        globalOutline: null,
        sectionCapsules: [],
        sourceCoverage: { total: 0, covered: 0, rate: 1, missing: [], suspicious: [], entries: [] },
        projectMeta: state.project,
        stageSchema: state.stageSchema,
        sourceSections: []
      }),
      globalOutline: null,
      sectionCapsules: [],
      sourceCoverage: auditSourceCoverage([], []),
      meta: { ...meta, skipped: true, reason: "NO_HOST_SECTIONS" }
    };
  }

  const outlineResult = await compileGlobalOutline(sections, {
    projectMeta: state.project,
    stageSchema: state.stageSchema,
    requestJson,
    useCache,
    modelTag: `${modelTag}-outline`
  });
  if (outlineResult.cached) meta.cacheHits += 1;
  else if (!outlineResult.skipped && outlineResult.usage) {
    meta.calls += 1;
    meta.usage = sumUsage([outlineResult.usage]);
  }

  const batch = await compileSectionCapsulesBatch(sections, {
    globalOutline: outlineResult.outline,
    stageSchema: state.stageSchema,
    requestJson,
    useCache,
    concurrency,
    modelTag: `${modelTag}-capsule`
  });

  let capsules = batch.capsules;
  meta.calls += batch.usages.length;
  meta.usage = sumUsage([meta.usage, ...batch.usages]);
  meta.cacheHits += capsules.filter((c) => c.cached).length;
  meta.llmCapsules = capsules.length - meta.cacheHits;

  if (enableRecovery) {
    const sectionById = new Map(sections.map((s) => [s.id, s]));
    const toRecover = capsules.filter((c) => c.suspicious).map((c) => c.sourceSectionId);
    for (const sid of toRecover) {
      const sec = sectionById.get(sid);
      if (!sec) continue;
      try {
        const r = await compileSectionCapsule(sec, {
          globalOutline: outlineResult.outline,
          stageSchema: state.stageSchema,
          requestJson,
          useCache: false,
          modelTag: `${modelTag}-recovery`
        });
        meta.recoveryCount += 1;
        if (r.usage) {
          meta.calls += 1;
          meta.usage = sumUsage([meta.usage, r.usage]);
        }
        const idx = capsules.findIndex((c) => c.sourceSectionId === sid);
        if (idx >= 0) capsules[idx] = r.capsule;
      } catch {
        // keep original suspicious capsule
      }
    }
  }

  const sourceCoverage = auditSourceCoverage(sections, capsules);
  const canonMemory = mergeCanonMemory({
    globalOutline: outlineResult.outline,
    sectionCapsules: capsules,
    sourceCoverage,
    projectMeta: state.project,
    stageSchema: state.stageSchema,
    sourceSections: sections
  });

  return {
    canonMemory,
    globalOutline: outlineResult.outline,
    sectionCapsules: capsules,
    sourceCoverage,
    meta
  };
}

export { hostSectionsFromState };
