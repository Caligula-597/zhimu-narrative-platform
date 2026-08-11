function clean(value) {
  return String(value ?? "").trim();
}

function clueLocationId(clue) {
  return clean(clue?.location_id || clue?.locationId);
}

function clueSegmentKey(clue) {
  return clean(clue?.segment_key || clue?.segmentKey);
}

/**
 * The deck only receives clues that the player-home endpoint has already
 * authorized for this player. Location/segment metadata is used for grouping,
 * never for expanding that authorized set.
 */
export function authorizedCluesForLocation(location, owned = [], shared = []) {
  const locationId = clean(location?.id);
  const segmentKey = clean(location?.segmentKey || location?.segment_key);
  if (!locationId && !segmentKey) return [];

  const seen = new Set();
  return [...owned, ...shared].filter((clue) => {
    const id = clean(clue?.id);
    if (!id || seen.has(id)) return false;
    const matchesLocation = locationId && clueLocationId(clue) === locationId;
    const matchesSegment = segmentKey && clueSegmentKey(clue) === segmentKey;
    if (!matchesLocation && !matchesSegment) return false;
    seen.add(id);
    return true;
  });
}

export function shuffledClueIds(clues, random = Math.random) {
  const ids = clues.map((clue) => clean(clue?.id)).filter(Boolean);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const sample = Number(random());
    const bounded = Number.isFinite(sample) ? Math.max(0, Math.min(0.999999999, sample)) : 0;
    const target = Math.floor(bounded * (index + 1));
    [ids[index], ids[target]] = [ids[target], ids[index]];
  }
  return ids;
}

export function clueArchiveCode(location, index = 0) {
  const source = clean(location?.segmentKey || location?.segment_key || location?.id || "scene")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12) || "SCENE";
  return `${source}-${String(index + 1).padStart(2, "0")}`;
}
