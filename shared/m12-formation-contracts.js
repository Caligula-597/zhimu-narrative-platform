/**
 * F1 — M12 Formation Artifact contracts (sidecar, not cross-family schema).
 *
 * Spec: docs/M12_FORMATIONATION_PRODUCTION_SLICE_V1_ZH.md · Gold: docs/M12_FORMATIONATION_CONTRACT_V1_ZH.md
 * Artifact must NOT announce FORMATION_READY (that is F3).
 */

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 800) {
  return String(value ?? "").trim().slice(0, maximum);
}

function cleanId(value) {
  return cleanText(value, 120);
}

function uniqueIds(list) {
  return [...new Set(asArray(list).map((x) => cleanId(x)).filter(Boolean))];
}

export const M12_FORMATIONATION_ARTIFACT_VERSION = 1;

export const M12_FORMATIONATION_ARTIFACT_STATUSES = Object.freeze([
  "DRAFT",
  "READY_FOR_VALIDATION",
  "STALE",
]);

/** Forbidden on F1 artifact.status — Gate (F3) owns FORMATION_READY. */
export const M12_FORMATIONATION_FORBIDDEN_ARTIFACT_STATUSES = Object.freeze([
  "FORMATION_READY",
  "FORMATION_REVIEW_REQUIRED",
]);

export const FORMATION_NODE_KINDS = Object.freeze([
  "FACT",
  "INFO",
  "MEMORY",
  "RECORD",
  "OBJECT",
  "OBSERVABLE",
  "INFERENCE",
  "NEED",
  "TRIGGER",
  "LEVERAGE_EDGE",
]);

export const FORMATION_ACQUISITION_MODES = Object.freeze([
  "OPENING_OWNED",
  "GUARANTEED",
  "CONFIDENCE_BOOST",
]);

export const FORMATION_PROVENANCE_TYPES = Object.freeze([
  "LOCKED_FACT",
  "CHARACTER_HISTORY",
  "PUBLIC_WORLD_RULE",
  "STORY_BLOCK_BINDING",
]);

export const FORMATION_INFERENCE_CONFIDENCE = Object.freeze(["ACTIONABLE"]);

export const FORMATION_FIELD_KEYS = Object.freeze([
  "valueSource",
  "existenceSource",
  "knowledgePath",
  "locatorPath",
  "counterpartLeverage",
  "leverageProvenance",
  "counterpartNeed",
  "trigger",
]);

export function normalizeFormationFieldRef(value = {}) {
  const src = record(value);
  return {
    nodeIds: uniqueIds(src.nodeIds),
  };
}

export function normalizeFormationAcquisition(value = {}) {
  const src = record(value);
  const mode = FORMATION_ACQUISITION_MODES.includes(src.mode) ? src.mode : "GUARANTEED";
  return {
    mode,
    whoCanAcquireIds: uniqueIds(src.whoCanAcquireIds),
    how: src.how != null ? cleanText(src.how, 400) : null,
    availableStage: src.availableStage != null ? cleanText(src.availableStage, 80) : null,
  };
}

export function normalizeFormationProvenance(value = {}) {
  const src = record(value);
  const type = FORMATION_PROVENANCE_TYPES.includes(src.type) ? src.type : "LOCKED_FACT";
  return {
    type,
    sourceRefs: asArray(src.sourceRefs).map((r) => cleanText(r, 200)).filter(Boolean),
    summary: src.summary != null ? cleanText(src.summary, 600) : null,
  };
}

export function normalizeLeverageEdgeSide(value = {}) {
  const src = record(value);
  return {
    characterId: cleanId(src.characterId),
    possessesNodeIds: uniqueIds(src.possessesNodeIds),
    wantsNodeIds: uniqueIds(src.wantsNodeIds),
  };
}

/**
 * @returns {object|null} null if id missing
 */
export function normalizeFormationNode(value = {}) {
  const src = record(value);
  const id = cleanId(src.id);
  if (!id) return null;
  const kind = FORMATION_NODE_KINDS.includes(src.kind) ? src.kind : "INFO";

  const base = {
    id,
    kind,
    holderIds: uniqueIds(src.holderIds),
    visibleToIds: uniqueIds(src.visibleToIds),
    reveals: asArray(src.reveals).map((r) => cleanText(r, 400)).filter(Boolean),
    requiresNodeIds: uniqueIds(src.requiresNodeIds || src.requires),
    acquisition: normalizeFormationAcquisition(src.acquisition || src.acquire),
    provenance: normalizeFormationProvenance(src.provenance),
  };

  if (kind === "INFERENCE") {
    return {
      ...base,
      subjectCharacterId: cleanId(src.subjectCharacterId) || base.holderIds[0] || null,
      confidence: FORMATION_INFERENCE_CONFIDENCE.includes(src.confidence)
        ? src.confidence
        : "ACTIONABLE",
    };
  }

  if (kind === "LEVERAGE_EDGE") {
    const sideA = normalizeLeverageEdgeSide(src.sideA);
    const sideB = normalizeLeverageEdgeSide(src.sideB);
    return {
      ...base,
      sideA,
      sideB,
      // OPEN only — never encode gave/received/tradeCompleted
      resolution: src.resolution === "OPEN" || !src.resolution ? "OPEN" : "OPEN",
    };
  }

  return base;
}

export function normalizeFormationProof(value = {}) {
  const src = record(value);
  const bi = record(src.bilateralLeverage);
  const seekerLeverage = asArray(bi.seekerLeverageNodeIds).length
    ? bi.seekerLeverageNodeIds
    : bi.seekerObject
      ? [bi.seekerObject]
      : [];
  const holderNeed = asArray(bi.holderNeedNodeIds).length
    ? bi.holderNeedNodeIds
    : bi.holderNeed
      ? [bi.holderNeed]
      : [];
  const seekerRecognition = asArray(bi.seekerRecognitionNodeIds).length
    ? bi.seekerRecognitionNodeIds
    : bi.seekerRecognizesNeed
      ? [bi.seekerRecognizesNeed]
      : [];
  return {
    guaranteedPathToContactReason: uniqueIds(src.guaranteedPathToContactReason),
    optionalConfidence: uniqueIds(src.optionalConfidence),
    bilateralLeverage: {
      seekerLeverageNodeIds: uniqueIds(seekerLeverage),
      holderNeedNodeIds: uniqueIds(holderNeed),
      seekerRecognitionNodeIds: uniqueIds(seekerRecognition),
    },
    noPreWrittenDeal: src.noPreWrittenDeal !== false,
    noUnsourcedAnswer: src.noUnsourcedAnswer !== false && src.noUnsourcedAnswerAtStart !== false,
  };
}

function emptyFormationFields() {
  const out = {};
  for (const key of FORMATION_FIELD_KEYS) {
    out[key] = { nodeIds: [] };
  }
  return out;
}

export function normalizeM12FormationArtifact(value = {}) {
  const src = record(value);
  let status = M12_FORMATIONATION_ARTIFACT_STATUSES.includes(src.status) ? src.status : "DRAFT";
  if (M12_FORMATIONATION_FORBIDDEN_ARTIFACT_STATUSES.includes(src.status)) {
    status = "READY_FOR_VALIDATION";
  }

  const participants = record(src.participants);
  const stake = record(src.stake);
  const formationSrc = record(src.formation);
  const formation = emptyFormationFields();
  for (const key of FORMATION_FIELD_KEYS) {
    formation[key] = normalizeFormationFieldRef(formationSrc[key]);
  }

  const nodes = asArray(src.nodes)
    .map(normalizeFormationNode)
    .filter(Boolean);

  // Drop exchange-event leftovers if any slipped in
  for (const node of nodes) {
    if (node.kind === "LEVERAGE_EDGE") {
      delete node.gave;
      delete node.received;
      delete node.tradeCompleted;
      delete node.exchangeResult;
    }
  }

  return {
    version: M12_FORMATIONATION_ARTIFACT_VERSION,
    id: cleanId(src.id) || `m12f-${Math.random().toString(36).slice(2, 10)}`,
    projectId: cleanId(src.projectId) || "project",
    sourceBlockId: cleanId(src.sourceBlockId),
    sourceBlockRevision: Math.max(0, Math.trunc(Number(src.sourceBlockRevision) || 0)),
    templateId: cleanId(src.templateId) || "M12-1",
    participants: {
      seekerId: cleanId(participants.seekerId),
      holderId: cleanId(participants.holderId),
    },
    stake: {
      ref: cleanId(stake.ref) || cleanText(stake.label, 80) || null,
      label: cleanText(stake.label, 160) || null,
    },
    formation,
    nodes,
    proof: normalizeFormationProof(src.proof),
    status,
    revision: Math.max(1, Math.trunc(Number(src.revision) || 1)),
    updatedAt: src.updatedAt != null ? String(src.updatedAt) : null,
  };
}

export function listNodeIds(artifact) {
  return asArray(artifact?.nodes).map((n) => n.id);
}

/** Structural completeness for READY_FOR_VALIDATION (not Gate PASS). */
export function artifactHasCompleteFieldRefs(artifact) {
  const a = normalizeM12FormationArtifact(artifact);
  const ids = new Set(listNodeIds(a));
  if (ids.size === 0) return false;
  for (const key of FORMATION_FIELD_KEYS) {
    const refs = a.formation[key].nodeIds;
    if (!refs.length) return false;
    if (refs.some((id) => !ids.has(id))) return false;
  }
  return true;
}

export function markArtifactReadyForValidation(artifact) {
  const a = normalizeM12FormationArtifact(artifact);
  if (!artifactHasCompleteFieldRefs(a)) {
    return { ...a, status: "DRAFT" };
  }
  return { ...a, status: "READY_FOR_VALIDATION" };
}

/**
 * Compare artifact.sourceBlockRevision to live M12 block.revision → STALE.
 */
export function refreshM12FormationArtifactStaleStatus(artifact, mechanismBlocks = []) {
  const a = normalizeM12FormationArtifact(artifact);
  if (!a.sourceBlockId) return a;
  const block = asArray(mechanismBlocks).find((b) => b?.id === a.sourceBlockId);
  if (!block) {
    return { ...a, status: "STALE" };
  }
  const liveRev = Math.max(0, Math.trunc(Number(block.revision) || 0));
  if (liveRev !== a.sourceBlockRevision) {
    return { ...a, status: "STALE" };
  }
  if (a.status === "STALE") {
    // Block caught up: return to DRAFT unless fields complete
    return markArtifactReadyForValidation({ ...a, status: "DRAFT" });
  }
  return a;
}

export function refreshAllM12FormationArtifacts(state) {
  const blocks = asArray(state?.mechanismBlocks);
  return asArray(state?.m12FormationArtifacts).map((a) =>
    refreshM12FormationArtifactStaleStatus(a, blocks),
  );
}

export function upsertM12FormationArtifact(state, artifact) {
  const nextArt = normalizeM12FormationArtifact(artifact);
  const list = asArray(state?.m12FormationArtifacts).map(normalizeM12FormationArtifact);
  const idx = list.findIndex((a) => a.id === nextArt.id);
  const artifacts = idx >= 0 ? list.map((a, i) => (i === idx ? nextArt : a)) : [...list, nextArt];
  return {
    ...state,
    m12FormationArtifacts: artifacts.map((a) =>
      refreshM12FormationArtifactStaleStatus(a, state?.mechanismBlocks),
    ),
  };
}

/** Edit one node → artifact.revision +1 (does not set FORMATION_READY). */
export function updateM12FormationNode(state, artifactId, nodeId, patch = {}) {
  const list = asArray(state?.m12FormationArtifacts).map(normalizeM12FormationArtifact);
  const idx = list.findIndex((a) => a.id === artifactId);
  if (idx < 0) return state;
  const art = list[idx];
  const nodes = art.nodes.map((n) => {
    if (n.id !== nodeId) return n;
    return normalizeFormationNode({ ...n, ...record(patch), id: nodeId });
  });
  const next = normalizeM12FormationArtifact({
    ...art,
    nodes,
    revision: art.revision + 1,
    updatedAt: new Date().toISOString(),
  });
  list[idx] = next;
  return { ...state, m12FormationArtifacts: list };
}

export function assertNoCanonPollutionFromInferences(artifact) {
  const a = normalizeM12FormationArtifact(artifact);
  const issues = [];
  for (const node of a.nodes) {
    if (node.kind !== "INFERENCE") continue;
    if (!node.subjectCharacterId) {
      issues.push({ code: "INFERENCE_MISSING_SUBJECT", nodeId: node.id });
    }
    if (node.confidence !== "ACTIONABLE") {
      issues.push({ code: "INFERENCE_BAD_CONFIDENCE", nodeId: node.id });
    }
  }
  return issues;
}

export function assertLeverageEdgesAreOpen(artifact) {
  const a = normalizeM12FormationArtifact(artifact);
  const issues = [];
  for (const node of a.nodes) {
    if (node.kind !== "LEVERAGE_EDGE") continue;
    if (node.resolution !== "OPEN") {
      issues.push({ code: "LEVERAGE_EDGE_NOT_OPEN", nodeId: node.id });
    }
    for (const forbidden of ["gave", "received", "tradeCompleted", "exchangeResult"]) {
      if (Object.prototype.hasOwnProperty.call(node, forbidden) && node[forbidden] != null) {
        issues.push({ code: "LEVERAGE_EDGE_EVENT_FIELD", nodeId: node.id, field: forbidden });
      }
    }
  }
  return issues;
}
