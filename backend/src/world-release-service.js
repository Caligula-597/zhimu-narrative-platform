import { hashIdempotencyRequest, readIdempotencyKey } from "./idempotency.js";
import { throwErr } from "./api-errors.js";
import { transaction } from "./db.js";
import {
  assertWorldReleaseSnapshot,
  hashWorldReleaseSnapshot,
  projectWorldRelease,
  summarizeWorldReleaseSnapshot,
  WORLD_RELEASE_SNAPSHOT_VERSION
} from "./world-release-contract.js";
import { buildWorldReleaseCandidate } from "./world-release-snapshot.js";
import { evaluateWorldPublishReadiness } from "./world-publish-readiness.js";
import {
  configureWorldReleaseTransaction,
  countWorldReleases,
  findWorldReleaseByIdempotency,
  insertWorldRelease,
  listWorldReleaseRows,
  lockWorldReleasePublisher
} from "./repositories/world-release-repository.js";
import {
  parseIfMatch,
  setWorldRevisionHeaders,
  throwWorldVersionConflict,
  withContentRevision
} from "./world-revision.js";

const WORLD_RELEASE_WRITER_ROLES = new Set(["owner", "editor"]);
export const MAX_WORLD_RELEASES = 200;
export const MAX_WORLD_RELEASE_BYTES = 25 * 1024 * 1024;
export const MAX_WORLD_RELEASE_OBJECTS = 30_000;

function normalizeLabel(value) {
  const label = String(value ?? "").trim();
  return label || `正式发布 ${new Date().toISOString().slice(0, 10)}`;
}

export function normalizeWorldReleaseError(error) {
  if (["40P01", "55P03"].includes(error?.code)) {
    const normalized = new Error("World release write is busy; retry shortly");
    normalized.code = "WORLD_RELEASE_WRITE_BUSY";
    normalized.statusCode = 409;
    return normalized;
  }
  if (error?.code === "57014") {
    const normalized = new Error("World release exceeded its safe execution window");
    normalized.code = "WORLD_RELEASE_WRITE_TIMEOUT";
    normalized.statusCode = 503;
    return normalized;
  }
  return error;
}

function assertReleasePublisher(row) {
  if (!row) throwErr("WORLD_ACCESS_DENIED");
  if (!WORLD_RELEASE_WRITER_ROLES.has(row.role)) throwErr("WORLD_EDITOR_REQUIRED");
}

function readinessFailureDetails(readiness) {
  return {
    summary: readiness.summary,
    blockingChecks: readiness.checks
      .filter((check) => check.level === "error")
      .slice(0, 20)
  };
}

export function prepareWorldReleaseArtifact(snapshot, { readinessSnapshot = null } = {}) {
  try {
    assertWorldReleaseSnapshot(snapshot);
  } catch (error) {
    throwErr("WORLD_RELEASE_SNAPSHOT_INVALID", error.message);
  }

  const readiness = evaluateWorldPublishReadiness(readinessSnapshot ?? { ...snapshot, rooms: [] });
  if (readiness.summary.errorCount > 0) {
    throwErr("WORLD_RELEASE_READINESS_BLOCKED", undefined, readinessFailureDetails(readiness));
  }

  const contentSummary = summarizeWorldReleaseSnapshot(snapshot);
  if (contentSummary.totalObjects > MAX_WORLD_RELEASE_OBJECTS) {
    throwErr("WORLD_RELEASE_TOO_LARGE", "Release contains too many runtime objects", {
      maxObjects: MAX_WORLD_RELEASE_OBJECTS,
      actualObjects: contentSummary.totalObjects
    });
  }
  const digest = hashWorldReleaseSnapshot(snapshot);
  if (digest.bytes > MAX_WORLD_RELEASE_BYTES) {
    throwErr("WORLD_RELEASE_TOO_LARGE", undefined, {
      maxBytes: MAX_WORLD_RELEASE_BYTES,
      actualBytes: digest.bytes
    });
  }
  return { readiness, contentSummary, digest };
}

export function addWorldRelease({ request, reply, actorId, worldId, label }) {
  const idempotencyKey = readIdempotencyKey(request);
  if (!idempotencyKey) throwErr("IDEMPOTENCY_KEY_REQUIRED");
  const requestHash = idempotencyKey ? hashIdempotencyRequest(request) : null;
  const expectedRevision = parseIfMatch(request);
  if (expectedRevision == null) throwErr("WORLD_REVISION_REQUIRED");

  return transaction(async (client) => {
    await configureWorldReleaseTransaction(client);
    const publisher = await lockWorldReleasePublisher(client, { worldId, actorId });
    assertReleasePublisher(publisher);
    const currentRevision = Number(publisher.content_revision);

    // Replay is resolved before the revision comparison. A transport retry must
    // still return the original Release even if the author edited the draft in
    // another tab after the first request committed.
    const existing = await findWorldReleaseByIdempotency(client, {
      worldId,
      actorId,
      idempotencyKey
    });
    if (existing) {
      if (existing.request_hash !== requestHash) {
        throwErr(
          "IDEMPOTENCY_PAYLOAD_MISMATCH",
          "Idempotency-Key was already used with another release request"
        );
      }
      return {
        release: projectWorldRelease(existing, { replayed: true }),
        revision: currentRevision
      };
    }

    if (expectedRevision != null && expectedRevision !== currentRevision) {
      throwWorldVersionConflict(expectedRevision, currentRevision);
    }
    if (await countWorldReleases(client, worldId) >= MAX_WORLD_RELEASES) {
      throwErr("WORLD_RELEASE_LIMIT_REACHED");
    }

    const candidate = await buildWorldReleaseCandidate(worldId, currentRevision, client);
    if (!candidate) throwErr("WORLD_NOT_FOUND");
    const { snapshot, readinessSnapshot } = candidate;
    const { readiness, contentSummary, digest } = prepareWorldReleaseArtifact(snapshot, {
      readinessSnapshot
    });

    const release = await insertWorldRelease(client, {
      worldId,
      actorId,
      label: normalizeLabel(label),
      sourceRevision: currentRevision,
      snapshotSchemaVersion: WORLD_RELEASE_SNAPSHOT_VERSION,
      narrativeProfile: snapshot.narrativeProfile,
      readiness,
      contentSummary,
      snapshotJson: digest.json,
      contentSha256: digest.sha256,
      snapshotBytes: digest.bytes,
      idempotencyKey,
      requestHash
    });
    return { release: projectWorldRelease(release), revision: currentRevision };
  }).then(({ release, revision }) => {
    setWorldRevisionHeaders(reply, revision);
    reply.code(201);
    return withContentRevision(release, revision);
  }).catch((error) => {
    throw normalizeWorldReleaseError(error);
  });
}

export async function listWorldReleases({ worldId }) {
  const rows = await listWorldReleaseRows({ worldId });
  return rows.map((row) => projectWorldRelease(row));
}
