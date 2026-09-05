/**
 * P8.0.3 Owner Authority — single deterministic OWNER resolution path.
 *
 * StoryTemplate symbolic slot
 *   → explicit roleBinding / roleAssignment
 *   → semantics.actorRefs[]
 *   → ProductionBeat.ownerCharacterIds[]
 *   → CharacterView OWNER
 *
 * Forbidden: name matching, characterIds[0], eventSummary parse, Character View guess.
 */

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanId(value) {
  return String(value ?? "").trim().slice(0, 120);
}

function stableUnique(ids) {
  const out = [];
  const seen = new Set();
  for (const raw of ids || []) {
    const id = cleanId(raw);
    if (!id || id === "unknown" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function looksLikeCharacterId(id, characters) {
  const cid = cleanId(id);
  if (!cid || cid === "unknown") return false;
  if (!characters?.length) return Boolean(cid);
  return characters.some((c) => c.id === cid);
}

function looksSymbolicSlot(label) {
  const s = String(label || "").trim();
  if (!s) return false;
  // Chinese display names are not slots; camelCase / snake slot keys are.
  if (/[\u4e00-\u9fff]/.test(s)) return false;
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s);
}

/**
 * @returns {{
 *   actorRefs: string[],
 *   actorLabel?: string,
 *   source: "DIRECT" | "ROLE_ASSIGNMENT" | "UNRESOLVED" | "AMBIGUOUS",
 *   symbolicRole?: string,
 *   unresolved: boolean,
 *   ambiguous: boolean,
 * }}
 */
export function resolveBeatOwnerRefs({
  semantics = null,
  roleBindings = {},
  roleAssignments = [],
  characters = [],
  cardinality = "ONE",
} = {}) {
  const sem = record(semantics);
  const direct = stableUnique(sem.actorRefs).filter((id) => looksLikeCharacterId(id, characters));
  if (direct.length) {
    if (cardinality === "ONE" && direct.length > 1) {
      return {
        actorRefs: [],
        actorLabel: sem.actorLabel,
        source: "AMBIGUOUS",
        unresolved: true,
        ambiguous: true,
      };
    }
    const label =
      direct.length === 1
        ? characters.find((c) => c.id === direct[0])?.name || sem.actorLabel
        : sem.actorLabel;
    return {
      actorRefs: cardinality === "ONE" ? [direct[0]] : direct,
      actorLabel: label,
      source: "DIRECT",
      unresolved: false,
      ambiguous: false,
      actorResolution: { source: "DIRECT" },
    };
  }

  const symbolic =
    (looksSymbolicSlot(sem.actorLabel) && String(sem.actorLabel).trim()) ||
    (looksSymbolicSlot(sem.primaryRole) && String(sem.primaryRole).trim()) ||
    null;

  if (!symbolic) {
    return {
      actorRefs: [],
      actorLabel: sem.actorLabel,
      source: "UNRESOLVED",
      unresolved: true,
      ambiguous: false,
      actorResolution: { source: "UNRESOLVED" },
    };
  }

  const fromBinding = roleBindings?.[symbolic]?.id ? cleanId(roleBindings[symbolic].id) : null;
  const fromAssignments = asArray(roleAssignments)
    .filter(
      (r) =>
        r &&
        (r.slotId === symbolic || r.narrativeRole === symbolic) &&
        looksLikeCharacterId(r.characterId, characters),
    )
    .map((r) => cleanId(r.characterId));

  const candidates = stableUnique([fromBinding, ...fromAssignments].filter(Boolean));

  if (candidates.length === 0) {
    return {
      actorRefs: [],
      actorLabel: symbolic,
      source: "UNRESOLVED",
      symbolicRole: symbolic,
      unresolved: true,
      ambiguous: false,
      actorResolution: { source: "UNRESOLVED", symbolicRole: symbolic },
    };
  }

  if (cardinality === "ONE" && candidates.length > 1) {
    return {
      actorRefs: [],
      actorLabel: symbolic,
      source: "AMBIGUOUS",
      symbolicRole: symbolic,
      unresolved: true,
      ambiguous: true,
      actorResolution: { source: "AMBIGUOUS", symbolicRole: symbolic },
    };
  }

  const chosen = cardinality === "ONE" ? [candidates[0]] : candidates;
  const name = characters.find((c) => c.id === chosen[0])?.name || roleBindings?.[symbolic]?.name;
  return {
    actorRefs: chosen,
    actorLabel: name || symbolic,
    source: "ROLE_ASSIGNMENT",
    symbolicRole: symbolic,
    unresolved: false,
    ambiguous: false,
    actorResolution: { source: "ROLE_ASSIGNMENT", symbolicRole: symbolic },
  };
}

/** Apply resolution onto a semantics object (immutable). */
export function applyOwnerResolution(semantics, resolution) {
  if (!semantics) return null;
  return {
    ...semantics,
    actorRefs: resolution.actorRefs || [],
    actorLabel: resolution.actorLabel || semantics.actorLabel,
    actorResolution: resolution.actorResolution || {
      source: resolution.source,
      symbolicRole: resolution.symbolicRole,
    },
    needsDetail: Boolean(semantics.needsDetail) || Boolean(resolution.unresolved),
  };
}
