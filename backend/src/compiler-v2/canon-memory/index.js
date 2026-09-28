export { CANON_COMPILER_VERSION, CANON_MERGE_VERSION, SECTION_CAPSULE_TYPE, CANON_NODE_TYPE, DEFAULT_CAPSULE_CONCURRENCY, DEFAULT_ENABLE_RECOVERY } from "./constants.js";
export { hashSourceSection, capsuleCacheKey, outlineCacheKey } from "./source-hash.js";
export { readCanonCache, writeCanonCache } from "./file-cache.js";
export { auditSourceCoverage, flagSuspiciousCapsules } from "./coverage.js";
export { compileGlobalOutline, normalizeGlobalOutline, emptyGlobalOutline } from "./global-outline.js";
export {
  compileSectionCapsule,
  compileSectionCapsulesBatch,
  normalizeSectionCapsule,
  emptyCapsuleForSection
} from "./section-capsule.js";
export { mergeCanonMemory } from "./merge.js";
export {
  promoteCapsuleToNodes,
  buildCanonNodes,
  reconcileOutlineToNodes,
  nodeText
} from "./promote.js";
export { detectNeedsSplit, classifyCapsuleEvent } from "./needs-split.js";
export {
  detectEventBoundary,
  detectNeedsSplitViaBoundary
} from "./event-boundary-detector.js";
export {
  proposeEventSplit,
  validateSplitProposal,
  applySplitProposal,
  proposeSplitsForEvents,
  SPLIT_REASON
} from "./splitter-v1.js";
export {
  loadPromotionRegression,
  scoreEventRegression,
  scoreNonEventRegression,
  summarizePromotionTargets
} from "./promotion-regression.js";
export { compileCanonMemoryFromState, hostSectionsFromState } from "./compiler.js";
export { scoreCanonGoldPresence } from "./gold-presence.js";
export {
  scoreCanonGoldV2,
  matchGoldEventV2,
  matchGoldKnowledgeV2,
  sampleCanonEventsForPrecision,
  sampleCanonNodesForPrecision,
  summarizePrecisionLabels,
  GOLD_MATCH
} from "./gold-scorer-v2.js";
