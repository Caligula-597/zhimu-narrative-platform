/** Canon Memory — LLM capsule/outline cache version (bump invalidates API cache). */
export const CANON_COMPILER_VERSION = "canon-v1.0.0";

/** Local merge/promotion version — does NOT invalidate LLM cache. */
export const CANON_MERGE_VERSION = "merge-v1.2.0";

export const SECTION_CAPSULE_TYPE = Object.freeze({
  EVENT: "EVENT",
  BACKGROUND: "BACKGROUND",
  RULE: "RULE",
  META: "META",
  MECHANISM: "MECHANISM",
  NO_RELEVANT_CONTENT: "NO_RELEVANT_CONTENT"
});

/** Canon Knowledge Node types (V1.2 — FACT added from cross-script evidence). */
export const CANON_NODE_TYPE = Object.freeze({
  EVENT: "EVENT",
  PROCESS: "PROCESS",
  DECISION: "DECISION",
  REVEAL: "REVEAL",
  BRANCH: "BRANCH",
  FACT: "FACT"
});

export const DEFAULT_CAPSULE_CONCURRENCY = 6;

/** Recovery re-reads are demoted — representation gaps ≠ comprehension gaps. */
export const DEFAULT_ENABLE_RECOVERY = false;
