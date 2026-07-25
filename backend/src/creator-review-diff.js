const DOMAINS = Object.freeze([
  ["roles", "name"],
  ["chapters", "title"],
  ["sections", "title"],
  ["scenes", "name"],
  ["clues", "name"],
  ["items", "name"],
  ["investigationPoints", "name"],
  ["rules", "name"],
  ["segments", "title"],
  ["segmentRefs", "ref_type"],
  ["truthClaims", "title"],
  ["roleRelationships", "label"],
  ["roleArchives", "public_identity"],
  ["foreshadowBeats", "title"],
  ["timelineEvents", "event_summary"],
  ["playerTasks", "body"],
  ["edges", "label"],
  ["assetManifest", "originalFilename"],
  ["tags", "tag_key"]
]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function changedFieldNames(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys]
    .filter((key) => JSON.stringify(canonical(before?.[key])) !== JSON.stringify(canonical(after?.[key])))
    .sort()
    .slice(0, 40);
}

function compareDomain(beforeRows, afterRows, labelKey) {
  const before = new Map((beforeRows || []).filter((item) => item?.id).map((item) => [item.id, item]));
  const after = new Map((afterRows || []).filter((item) => item?.id).map((item) => [item.id, item]));
  const added = [];
  const removed = [];
  const changed = [];
  for (const [id, row] of after) {
    const old = before.get(id);
    if (!old) {
      added.push({ id, label: String(row[labelKey] || row.title || row.name || id) });
      continue;
    }
    const fields = changedFieldNames(old, row);
    if (fields.length) changed.push({ id, label: String(row[labelKey] || row.title || row.name || id), fields });
  }
  for (const [id, row] of before) {
    if (!after.has(id)) removed.push({ id, label: String(row[labelKey] || row.title || row.name || id) });
  }
  return {
    counts: { added: added.length, removed: removed.length, changed: changed.length },
    added: added.slice(0, 100),
    removed: removed.slice(0, 100),
    changed: changed.slice(0, 100),
    truncated: added.length > 100 || removed.length > 100 || changed.length > 100
  };
}

export function compareCreatorSnapshots(baseSnapshot = {}, headSnapshot = {}) {
  const domains = {};
  const totals = { added: 0, removed: 0, changed: 0 };
  for (const [key, labelKey] of DOMAINS) {
    const comparison = compareDomain(baseSnapshot[key], headSnapshot[key], labelKey);
    domains[key] = comparison;
    totals.added += comparison.counts.added;
    totals.removed += comparison.counts.removed;
    totals.changed += comparison.counts.changed;
  }
  const worldFields = changedFieldNames(baseSnapshot.world || {}, headSnapshot.world || {});
  if (worldFields.length) totals.changed += 1;
  const coreTrickFields = changedFieldNames(
    baseSnapshot.coreTrick || {},
    headSnapshot.coreTrick || {}
  );
  if (coreTrickFields.length) totals.changed += 1;
  return {
    summary: totals,
    world: { changed: worldFields.length > 0, fields: worldFields },
    coreTrick: { changed: coreTrickFields.length > 0, fields: coreTrickFields },
    domains
  };
}
