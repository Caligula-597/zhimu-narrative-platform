import { query } from "../db.js";

const RELEASE_FIELDS = `
  release.id,
  release.world_id,
  release.release_number,
  release.label,
  release.source_content_revision,
  release.snapshot_schema_version,
  release.narrative_profile,
  release.readiness,
  release.content_summary,
  release.content_sha256,
  release.snapshot_bytes,
  release.created_by_user_id,
  release.created_at`;

export async function configureWorldReleaseTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '30000ms', true)`
  );
}

export async function lockWorldReleasePublisher(client, { worldId, actorId }) {
  const result = await client.query(
    `SELECT member.role, world.content_revision
     FROM worlds world
     JOIN world_members member
       ON member.world_id = world.id AND member.user_id = $2
     WHERE world.id = $1
     FOR UPDATE OF world
     FOR SHARE OF member`,
    [worldId, actorId]
  );
  return result.rows[0] ?? null;
}

export async function countWorldReleases(client, worldId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM world_releases WHERE world_id = $1`,
    [worldId]
  );
  return result.rows[0]?.count ?? 0;
}

export async function findWorldReleaseByIdempotency(client, { worldId, actorId, idempotencyKey }) {
  if (!idempotencyKey) return null;
  const result = await client.query(
    `SELECT ${RELEASE_FIELDS}, release.request_hash
     FROM world_releases release
     WHERE release.world_id = $1
       AND release.created_by_user_id = $2
       AND release.idempotency_key = $3`,
    [worldId, actorId, idempotencyKey]
  );
  return result.rows[0] ?? null;
}

export async function insertWorldRelease(client, {
  worldId,
  actorId,
  label,
  sourceRevision,
  snapshotSchemaVersion,
  narrativeProfile,
  readiness,
  contentSummary,
  snapshotJson,
  contentSha256,
  snapshotBytes,
  idempotencyKey,
  requestHash
}) {
  const result = await client.query(
    `WITH next_release AS (
       SELECT COALESCE(MAX(release_number), 0) + 1 AS release_number
       FROM world_releases
       WHERE world_id = $1
     )
     INSERT INTO world_releases (
       world_id, release_number, label, source_content_revision,
       snapshot_schema_version, narrative_profile, readiness, content_summary,
       snapshot, content_sha256, snapshot_bytes, created_by_user_id,
       idempotency_key, request_hash
     )
     SELECT $1, next_release.release_number, $3, $4, $5, $6::jsonb, $7::jsonb,
            $8::jsonb, $9::jsonb, $10, $11, $2, $12, $13
     FROM next_release
     RETURNING id, world_id, release_number, label, source_content_revision,
               snapshot_schema_version, narrative_profile, readiness,
               content_summary, content_sha256, snapshot_bytes,
               created_by_user_id, created_at`,
    [
      worldId,
      actorId,
      label,
      sourceRevision,
      snapshotSchemaVersion,
      JSON.stringify(narrativeProfile),
      JSON.stringify(readiness),
      JSON.stringify(contentSummary),
      snapshotJson,
      contentSha256,
      snapshotBytes,
      idempotencyKey,
      requestHash
    ]
  );
  return result.rows[0];
}

export async function listWorldReleaseRows({ worldId, limit = 200 }, client = null) {
  const run = client?.query ? client.query.bind(client) : query;
  const result = await run(
    `SELECT ${RELEASE_FIELDS}, creator.display_name AS created_by_name
     FROM world_releases release
     LEFT JOIN users creator ON creator.id = release.created_by_user_id
     WHERE release.world_id = $1
     ORDER BY release.release_number DESC
     LIMIT $2`,
    [worldId, limit]
  );
  return result.rows;
}

export async function lockWorldReleaseForRoom(client, { worldId, releaseId }) {
  const result = await client.query(
    `SELECT release.id, release.release_number, release.label,
            release.source_content_revision, release.created_at
     FROM world_releases release
     WHERE release.world_id = $1 AND release.id = $2
     FOR KEY SHARE`,
    [worldId, releaseId]
  );
  return result.rows[0] ?? null;
}

export async function lockLatestWorldReleaseForRoom(client, { worldId }) {
  const result = await client.query(
    `SELECT release.id, release.release_number, release.label,
            release.source_content_revision, release.content_sha256,
            release.created_at
     FROM world_releases release
     WHERE release.world_id = $1
     ORDER BY release.release_number DESC
     LIMIT 1
     FOR KEY SHARE`,
    [worldId]
  );
  return result.rows[0] ?? null;
}
