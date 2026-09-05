/**
 * PlayableProject persistence — one current compile blob per world (P7.0).
 */

import { query } from "./db.js";
import {
  PLAYABLE_PROJECT_SCHEMA_VERSION,
  normalizePlayableProject,
  refreshPlayableProjectStale,
  playableSourceFingerprint,
} from "../../shared/playable-project-contracts.js";
import {
  compileWarehouseSixFixture,
  WAREHOUSE_SIX_FIXTURE_ID,
  WAREHOUSE_SIX_FIXTURE_REVISION,
} from "../../shared/playable-project-compiler.js";

export async function loadPlayableProject(worldId) {
  const result = await query(
    `SELECT project, schema_version, updated_at
     FROM world_playable_projects
     WHERE world_id = $1`,
    [worldId],
  );
  if (!result.rows[0]) {
    return {
      project: null,
      exists: false,
      schemaVersion: PLAYABLE_PROJECT_SCHEMA_VERSION,
      updatedAt: null,
    };
  }
  const row = result.rows[0];
  let project = normalizePlayableProject({
    ...row.project,
    worldId,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at || row.project?.updatedAt || null,
  });
  // Fixture fingerprint check (authoritative fixture revision)
  const expected = playableSourceFingerprint({
    sourceType: "FIXTURE",
    sourceId: WAREHOUSE_SIX_FIXTURE_ID,
    sourceRevision: WAREHOUSE_SIX_FIXTURE_REVISION,
    fixtureId: WAREHOUSE_SIX_FIXTURE_ID,
  });
  if (project?.source?.fixtureId === WAREHOUSE_SIX_FIXTURE_ID) {
    project = refreshPlayableProjectStale(project, { sourceFingerprint: expected });
  }
  return {
    project,
    exists: true,
    schemaVersion: row.schema_version,
    updatedAt: row.updated_at,
  };
}

export async function savePlayableProject(client, worldId, rawProject, actorId) {
  const world = await client.query(`SELECT id FROM worlds WHERE id = $1`, [worldId]);
  if (!world.rows[0]) {
    const err = new Error("WORLD_NOT_FOUND");
    err.code = "WORLD_NOT_FOUND";
    throw err;
  }

  const previous = await client.query(
    `SELECT project FROM world_playable_projects WHERE world_id = $1`,
    [worldId],
  );
  const prevRevision = Number(previous.rows[0]?.project?.revision) || 0;
  const incoming = normalizePlayableProject({
    ...rawProject,
    worldId,
  });
  if (!incoming) {
    const err = new Error("PLAYABLE_PROJECT_REQUIRED");
    err.code = "PLAYABLE_PROJECT_REQUIRED";
    throw err;
  }
  const nextRevision = Math.max(prevRevision, Number(incoming.revision) || 0) + 1;
  const updatedAt = new Date().toISOString();
  const project = normalizePlayableProject({
    ...incoming,
    worldId,
    revision: nextRevision,
    updatedAt,
  });

  const result = await client.query(
    `INSERT INTO world_playable_projects
       (world_id, schema_version, project, updated_by_user_id)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (world_id) DO UPDATE
     SET schema_version = EXCLUDED.schema_version,
         project = EXCLUDED.project,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = now()
     RETURNING project, schema_version, updated_at`,
    [worldId, PLAYABLE_PROJECT_SCHEMA_VERSION, JSON.stringify(project), actorId || null],
  );
  const row = result.rows[0];
  return {
    project: normalizePlayableProject({
      ...row.project,
      worldId,
      updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
    }),
    exists: true,
    schemaVersion: row.schema_version,
    updatedAt: row.updated_at,
  };
}

/** Compile warehouse fixture and persist as current playable project */
export async function compileAndSaveWarehouseFixture(client, worldId, actorId, options = {}) {
  const compiled = compileWarehouseSixFixture({
    worldId,
    projectId: `pp-${worldId}-warehouse-six`,
    now: options.now,
  });
  return savePlayableProject(client, worldId, compiled, actorId);
}
