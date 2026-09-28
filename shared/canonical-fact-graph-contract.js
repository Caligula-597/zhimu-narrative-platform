/**
 * Minimal Canonical Fact Graph contract.
 * The graph is the only future authoring substrate; existing Canon blocks are
 * views and are never silently repaired by this module.
 */

export const CANONICAL_FACT_GRAPH_NODE_TYPES = Object.freeze([
  "entities",
  "events",
  "relations",
  "objectStates",
  "evidence",
  "claims",
  "mappingMutations",
  "causalEdges",
]);

export function emptyCanonicalFactGraph() {
  return {
    version: 1,
    entities: [],
    events: [],
    relations: [],
    objectStates: [],
    evidence: [],
    claims: [],
    mappingMutations: [],
    causalEdges: [],
  };
}

export function canonicalFactGraphNodeCounts(graph = {}) {
  return Object.fromEntries(CANONICAL_FACT_GRAPH_NODE_TYPES.map((type) => [type, Array.isArray(graph[type]) ? graph[type].length : 0]));
}
