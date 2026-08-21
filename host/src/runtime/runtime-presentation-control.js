function uniqueIds(values, max = 24) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean))]
    .slice(0, max);
}

function validTimestamp(value, fallback) {
  const text = String(value ?? "").trim();
  return text && Number.isFinite(Date.parse(text)) ? text : fallback;
}

export function hasRuntimePresentationMutation(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length);
}

export function matchesRuntimeControl(current, expected, keys) {
  if (!current || typeof current !== "object" || !expected || typeof expected !== "object") return false;
  return keys.every((key) => String(current[key] ?? "") === String(expected[key] ?? ""));
}

export function serializeRuntimeVariableValues(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map((item) => {
    const id = String(item?.id ?? "").trim();
    const numeric = Number(item?.value);
    if (!id || seen.has(id) || !Number.isFinite(numeric)) return null;
    seen.add(id);
    return { id: id.slice(0, 80), value: Math.round(Math.max(-9999, Math.min(9999, numeric))) };
  }).filter(Boolean).slice(0, 8);
}

export function serializePublishedEndingControl(value, { now = () => new Date().toISOString() } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = String(value.id ?? "").trim().slice(0, 80);
  if (!id) return null;
  return {
    id,
    publishedAt: validTimestamp(value.publishedAt, now())
  };
}

/**
 * Convert the audience projection back to the small control object accepted by
 * the room settings endpoint. Projected encounters intentionally contain NPC
 * cards instead of npcIds, so writing them back verbatim fails strict schema
 * validation and risks persisting presentation-only fields.
 */
export function serializeActiveEncounterControl(value, { now = () => new Date().toISOString() } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.status !== "active") return null;
  const locationId = String(value.locationId ?? "").trim();
  const npcIds = uniqueIds(
    Array.isArray(value.npcIds) && value.npcIds.length
      ? value.npcIds
      : (Array.isArray(value.npcs) ? value.npcs.map((npc) => npc?.id) : []),
    12
  );
  if (!locationId || !npcIds.length) return null;
  const fallback = now();
  return {
    locationId,
    npcIds,
    status: "active",
    startedAt: validTimestamp(value.startedAt, fallback)
  };
}

export function buildRuntimePresentationPatch(patch = {}, {
  now = () => new Date().toISOString()
} = {}) {
  const source = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
  const timestamp = now();
  const result = { updatedAt: timestamp };
  if (Object.hasOwn(source, "activeSegmentKey")) result.activeSegmentKey = String(source.activeSegmentKey ?? "");
  if (Object.hasOwn(source, "activeLocationId")) result.activeLocationId = String(source.activeLocationId ?? "");
  if (Object.hasOwn(source, "revealedLocationIds")) {
    result.revealedLocationIds = uniqueIds(source.revealedLocationIds, 24);
  }
  if (Object.hasOwn(source, "mapVisible")) result.mapVisible = Boolean(source.mapVisible);
  if (Object.hasOwn(source, "activeCheck")) result.activeCheck = source.activeCheck || null;
  if (Object.hasOwn(source, "activeEncounter")) {
    result.activeEncounter = serializeActiveEncounterControl(source.activeEncounter, { now: () => timestamp });
  }
  if (Object.hasOwn(source, "variableValues")) {
    result.variableValues = serializeRuntimeVariableValues(source.variableValues);
  }
  if (Object.hasOwn(source, "publishedEnding")) {
    result.publishedEnding = serializePublishedEndingControl(source.publishedEnding, { now: () => timestamp });
  }
  return result;
}
