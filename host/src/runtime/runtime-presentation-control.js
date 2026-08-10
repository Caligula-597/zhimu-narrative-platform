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
  return result;
}
