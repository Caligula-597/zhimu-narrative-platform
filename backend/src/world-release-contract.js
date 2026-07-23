import { createHash } from "node:crypto";

export const WORLD_RELEASE_SNAPSHOT_VERSION = 1;

const RELEASE_ARRAY_FIELDS = Object.freeze([
  "chapters",
  "roles",
  "sections",
  "scenes",
  "clues",
  "investigationPoints",
  "items",
  "edges",
  "rules",
  "segments",
  "segmentRefs",
  "truthClaims",
  "roleRelationships",
  "roleArchives",
  "foreshadowBeats",
  "timelineEvents",
  "tags",
  "assetManifest"
]);

function canonicalValue(value, seen) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError("Release snapshot cannot contain circular references");
    seen.add(value);
    const normalized = value.map((entry) => canonicalValue(entry, seen) ?? null);
    seen.delete(value);
    return normalized;
  }
  if (!value || typeof value !== "object") return undefined;
  if (seen.has(value)) throw new TypeError("Release snapshot cannot contain circular references");
  seen.add(value);
  const normalized = {};
  for (const key of Object.keys(value).sort()) {
    const entry = canonicalValue(value[key], seen);
    if (entry !== undefined) normalized[key] = entry;
  }
  seen.delete(value);
  return normalized;
}

export function canonicalReleaseJson(value) {
  return JSON.stringify(canonicalValue(value, new WeakSet()));
}

export function hashWorldReleaseSnapshot(snapshot) {
  const json = canonicalReleaseJson(snapshot);
  return {
    json,
    bytes: Buffer.byteLength(json, "utf8"),
    sha256: createHash("sha256").update(json, "utf8").digest("hex")
  };
}

export function assertWorldReleaseSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TypeError("Release snapshot must be an object");
  }
  if (snapshot.schemaVersion !== WORLD_RELEASE_SNAPSHOT_VERSION) {
    throw new TypeError("Unsupported release snapshot schema version");
  }
  if (!Number.isInteger(snapshot.sourceRevision) || snapshot.sourceRevision < 1) {
    throw new TypeError("Release snapshot source revision must be a positive integer");
  }
  if (!snapshot.world?.id || typeof snapshot.world?.name !== "string" || !snapshot.narrativeProfile) {
    throw new TypeError("Release snapshot is missing its world or narrative profile");
  }
  for (const key of RELEASE_ARRAY_FIELDS) {
    if (!Array.isArray(snapshot[key])) throw new TypeError(`Release snapshot field ${key} must be an array`);
  }
  return snapshot;
}

export function summarizeWorldReleaseSnapshot(snapshot) {
  assertWorldReleaseSnapshot(snapshot);
  const counts = Object.fromEntries(RELEASE_ARRAY_FIELDS.map((key) => [key, snapshot[key].length]));
  return {
    counts,
    hasCoreTrick: Boolean(snapshot.coreTrick),
    totalObjects: Object.values(counts).reduce((sum, value) => sum + value, 0) + (snapshot.coreTrick ? 1 : 0)
  };
}

export function projectWorldRelease(row, { replayed = false } = {}) {
  return {
    id: row.id,
    worldId: row.world_id,
    releaseNumber: Number(row.release_number),
    label: row.label,
    sourceRevision: Number(row.source_content_revision),
    snapshotSchemaVersion: Number(row.snapshot_schema_version),
    narrativeProfile: row.narrative_profile,
    readinessSummary: row.readiness?.summary ?? row.readiness ?? {},
    contentSummary: row.content_summary,
    contentSha256: row.content_sha256,
    snapshotBytes: Number(row.snapshot_bytes),
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name ?? null,
    createdAt: row.created_at,
    ...(replayed ? { replayed: true } : {})
  };
}
