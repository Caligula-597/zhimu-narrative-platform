/**
 * P8.0.2 Semantic Fact Scope — type vs instance + deterministic ids.
 * P8.0.5: requirement sourceKind + exact factType compatibility (no substring).
 * Integrator weave matching consumes these helpers; no world-state registry.
 */

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 200) {
  return String(value ?? "").trim().slice(0, maximum);
}

function cleanId(value) {
  return cleanText(value, 120).replace(/[^a-zA-Z0-9_:\-./]/g, "_");
}

/** Requirement provenance — never invent a default. */
export const REQUIREMENT_SOURCE_KINDS = Object.freeze([
  "STORY_FACT",
  "PROJECT_PREREQ",
  "EXTERNAL_TRIGGER",
]);

/**
 * Explicit aliases only. V1: empty — exact equality is the only match.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const EXPLICIT_FACT_TYPE_COMPATIBILITY = Object.freeze({});

export function factTypesCompatible(a, b) {
  const ta = cleanId(a).toLowerCase();
  const tb = cleanId(b).toLowerCase();
  if (!ta || !tb) return false;
  if (ta === tb) return true;
  const aliasesA = EXPLICIT_FACT_TYPE_COMPATIBILITY[ta] || [];
  const aliasesB = EXPLICIT_FACT_TYPE_COMPATIBILITY[tb] || [];
  return aliasesA.includes(tb) || aliasesB.includes(ta);
}

export function normalizeRequirementSourceKind(value) {
  const kind = String(value ?? "").trim().toUpperCase();
  return REQUIREMENT_SOURCE_KINDS.includes(kind) ? kind : undefined;
}

export function normalizeFactScope(value = {}) {
  const src = record(value);
  return {
    characterIds: asArray(src.characterIds).map(String).filter(Boolean),
    entityIds: asArray(src.entityIds).map(String).filter(Boolean),
    factionIds: asArray(src.factionIds).map(String).filter(Boolean),
    locationIds: asArray(src.locationIds).map(String).filter(Boolean),
    sourceBlockId: cleanId(src.sourceBlockId) || undefined,
    global: Boolean(src.global),
  };
}

export function scopesOverlap(a, b) {
  const sa = normalizeFactScope(a);
  const sb = normalizeFactScope(b);
  if (sa.global && sb.global) return true;
  const share = (x, y) => x.some((id) => y.includes(id));
  if (share(sa.characterIds, sb.characterIds)) return true;
  if (share(sa.entityIds, sb.entityIds)) return true;
  if (share(sa.factionIds, sb.factionIds)) return true;
  if (share(sa.locationIds, sb.locationIds)) return true;
  return false;
}

export function factTypeOf(fact) {
  if (!fact) return "";
  return cleanId(fact.factType || fact.kind || fact.id || "").toLowerCase();
}

export function factIdOf(fact) {
  if (!fact) return "";
  return cleanId(fact.factId || fact.id || "");
}

/**
 * Deterministic instance id:
 * fact:{block}:{beat}:{factType}:{scopeOwner}
 */
export function buildDeterministicFactId({
  sourceBlockId,
  sourceBeatId,
  factType,
  scope = {},
} = {}) {
  const type = cleanId(factType) || "fact";
  const sc = normalizeFactScope(scope);
  const owner =
    sc.characterIds[0] ||
    sc.entityIds[0] ||
    sc.factionIds[0] ||
    sc.locationIds[0] ||
    (sc.global ? "global" : "block");
  return `fact:${cleanId(sourceBlockId) || "block"}:${cleanId(sourceBeatId) || "beat"}:${type}:${cleanId(owner)}`;
}

/**
 * Normalize SemanticFactRef. Backward compatible with { id, kind, summary }.
 * sourceKind is preserved when present; never defaulted.
 */
export function normalizeSemanticFactRef(value = {}, context = {}) {
  if (value == null) return null;
  if (typeof value === "string") {
    const type = cleanId(value);
    if (!type) return null;
    return instantiateSemanticFact(
      { factType: type, kind: type, id: type, summary: type },
      context,
    );
  }
  const src = record(value);
  const factType = cleanId(src.factType || src.kind || src.id);
  if (!factType) return null;
  const scope = normalizeFactScope({
    ...record(src.scope),
    sourceBlockId: src.scope?.sourceBlockId || context.sourceBlockId || src.sourceBlockId,
    characterIds:
      src.scope?.characterIds ||
      context.characterIds ||
      asArray(src.characterIds),
    entityIds: src.scope?.entityIds || context.entityIds || asArray(src.entityIds),
    factionIds: src.scope?.factionIds || context.factionIds || asArray(src.factionIds),
    locationIds: src.scope?.locationIds || context.locationIds || asArray(src.locationIds),
    global: src.scope?.global ?? src.global ?? false,
  });
  const factId =
    cleanId(src.factId) ||
    (context.sourceBlockId
      ? buildDeterministicFactId({
          sourceBlockId: context.sourceBlockId,
          sourceBeatId: context.sourceBeatId,
          factType,
          scope,
        })
      : cleanId(src.id) || factType);
  const summary = cleanText(src.summary, 200) || factType;
  const sourceKind = normalizeRequirementSourceKind(src.sourceKind);
  const sourceRef = cleanId(src.sourceRef) || undefined;
  const out = {
    factId,
    factType,
    /** @deprecated aliases for older consumers */
    id: factId,
    kind: factType,
    scope,
    summary,
  };
  if (sourceKind) out.sourceKind = sourceKind;
  if (sourceRef) out.sourceRef = sourceRef;
  return out;
}

export function instantiateSemanticFact(value, context = {}) {
  return normalizeSemanticFactRef(value, context);
}

export function instantiateFactList(list, context = {}) {
  return asArray(list)
    .map((f) => instantiateSemanticFact(f, context))
    .filter(Boolean);
}

/**
 * Same-block: factType (exact / explicit alias) + overlapping scope (or exact factId).
 * Cross-block: exact factId only (or explicit bridge — separate path).
 */
export function factsSatisfy(producer, consumer, { allowCrossBlockTypeMatch = false } = {}) {
  if (!producer || !consumer) return false;
  const pid = factIdOf(producer);
  const cid = factIdOf(consumer);
  if (pid && cid && pid === cid) return true;

  const pType = factTypeOf(producer);
  const cType = factTypeOf(consumer);
  if (!factTypesCompatible(pType, cType)) return false;

  const pBlock = producer.scope?.sourceBlockId;
  const cBlock = consumer.scope?.sourceBlockId;
  const sameBlock = pBlock && cBlock && pBlock === cBlock;
  if (sameBlock) {
    // Same-block lifecycle: exact/aliased factType is enough.
    // Character scope is attribution within one block (M01 multi-role chain).
    // Cross-block still rejects type-only matching.
    return true;
  }

  if (allowCrossBlockTypeMatch) {
    return scopesOverlap(producer.scope, consumer.scope);
  }
  return false;
}

/**
 * Returns matched producer factTypes (for weave reason strings).
 */
export function matchProducedToRequired(produces, requires, options = {}) {
  const matched = [];
  for (const req of asArray(requires)) {
    for (const prod of asArray(produces)) {
      if (factsSatisfy(prod, req, options)) {
        matched.push(factTypeOf(prod) || factIdOf(prod));
        break;
      }
    }
  }
  return matched;
}

export function normalizeTargetRef(value, context = {}) {
  if (value == null) return null;
  if (typeof value === "string") return null; // plain label is display-only
  const src = record(value);
  const targetType = cleanId(src.targetType || src.type || src.kind);
  if (!targetType && !src.targetId) return null;
  const scope = normalizeFactScope({ ...record(src.scope), ...context });
  const targetId =
    cleanId(src.targetId) ||
    buildDeterministicFactId({
      sourceBlockId: context.sourceBlockId || scope.sourceBlockId,
      sourceBeatId: context.sourceBeatId || "target",
      factType: targetType || "target",
      scope,
    });
  return {
    targetId,
    targetType: targetType || "target",
    scope,
    label: cleanText(src.label || src.summary, 160) || targetType,
  };
}

export function normalizeLocationRef(value, context = {}) {
  if (value == null) return null;
  if (typeof value === "string") return null;
  const src = record(value);
  const locationId = cleanId(src.locationId || src.id);
  if (!locationId) return null;
  return {
    locationId,
    locationType: cleanId(src.locationType || src.type) || undefined,
    scope: normalizeFactScope({ ...record(src.scope), locationIds: [locationId], ...context }),
    label: cleanText(src.label, 120) || locationId,
  };
}

export function targetRefsMatch(a, b) {
  if (!a?.targetId || !b?.targetId) return false;
  return a.targetId === b.targetId;
}

export function locationRefsMatch(a, b) {
  if (!a?.locationId || !b?.locationId) return false;
  return a.locationId === b.locationId;
}

/** Contract stub for explicit cross-block bridges (UI later). */
export function normalizeStoryFactBridge(value = {}) {
  const src = record(value);
  const id = cleanId(src.id);
  const fromFactId = cleanId(src.fromFactId);
  const toRequirementId = cleanId(src.toRequirementId || src.toFactId);
  if (!fromFactId || !toRequirementId) return null;
  const status = ["PROPOSED", "ACCEPTED", "REJECTED"].includes(src.status) ? src.status : "PROPOSED";
  return {
    id: id || `bridge:${fromFactId}:${toRequirementId}`,
    fromBlockId: cleanId(src.fromBlockId) || undefined,
    fromFactId,
    toBlockId: cleanId(src.toBlockId) || undefined,
    toRequirementId,
    relation: cleanText(src.relation, 40) || "SATISFIES",
    status,
  };
}

export function bridgesSatisfy(bridges, producerFactId, consumerFactId) {
  return asArray(bridges).some(
    (b) =>
      b &&
      b.status === "ACCEPTED" &&
      b.fromFactId === producerFactId &&
      b.toRequirementId === consumerFactId,
  );
}

export function buildBeatPositionIndex(stages) {
  const map = new Map();
  const sorted = [...asArray(stages)].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  sorted.forEach((st, stageIndex) => {
    (st.beats || []).forEach((beat, beatIndex) => {
      if (beat?.id) {
        map.set(beat.id, {
          stageIndex,
          beatIndex,
          stageId: st.id,
          order: st.order ?? stageIndex,
        });
      }
    });
  });
  return map;
}

export function positionIsBefore(a, b) {
  if (!a || !b) return false;
  if (a.stageIndex !== b.stageIndex) return a.stageIndex < b.stageIndex;
  return a.beatIndex < b.beatIndex;
}
