/**
 * ProjectStoryState persistence — one JSON blob per world.
 */

import { query } from "./db.js";
import {
  STORY_MECHANISM_CONTRACT_VERSION,
  normalizeProjectStoryState,
} from "../../shared/story-mechanism-contracts.js";
import { createInitialProjectStoryState } from "../../shared/story-mechanism-engine.js";

export async function loadProjectStoryState(worldId) {
  const result = await query(
    `SELECT state, schema_version, updated_at
     FROM world_project_story_states
     WHERE world_id = $1`,
    [worldId],
  );
  if (!result.rows[0]) {
    const initial = createInitialProjectStoryState(worldId);
    return {
      state: initial,
      exists: false,
      schemaVersion: STORY_MECHANISM_CONTRACT_VERSION,
      updatedAt: null,
    };
  }
  const row = result.rows[0];
  const state = normalizeProjectStoryState({
    ...row.state,
    projectId: worldId,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at || row.state?.updatedAt || null,
  });
  return {
    state,
    exists: true,
    schemaVersion: row.schema_version,
    updatedAt: row.updated_at,
  };
}

/**
 * Upsert normalized state. Bumps ProjectStoryState.revision monotonically.
 * @param {object} client - pg client from runRevisionMutation
 */
export async function saveProjectStoryState(client, worldId, rawState, actorId) {
  const world = await client.query(`SELECT id FROM worlds WHERE id = $1`, [worldId]);
  if (!world.rows[0]) {
    const err = new Error("WORLD_NOT_FOUND");
    err.code = "WORLD_NOT_FOUND";
    throw err;
  }

  const previous = await client.query(
    `SELECT state FROM world_project_story_states WHERE world_id = $1`,
    [worldId],
  );
  const prevRevision = Number(previous.rows[0]?.state?.revision) || 0;
  const incoming = normalizeProjectStoryState({
    ...rawState,
    projectId: worldId,
  });
  const nextRevision = Math.max(prevRevision, Number(incoming.revision) || 0) + 1;
  const updatedAt = new Date().toISOString();
  const state = normalizeProjectStoryState({
    ...incoming,
    projectId: worldId,
    revision: nextRevision,
    updatedAt,
  });

  const result = await client.query(
    `INSERT INTO world_project_story_states
       (world_id, schema_version, state, updated_by_user_id)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (world_id) DO UPDATE
     SET schema_version = EXCLUDED.schema_version,
         state = EXCLUDED.state,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = now()
     RETURNING state, schema_version, updated_at`,
    [worldId, STORY_MECHANISM_CONTRACT_VERSION, JSON.stringify(state), actorId || null],
  );

  const row = result.rows[0];
  return {
    state: normalizeProjectStoryState({
      ...row.state,
      projectId: worldId,
      updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
    }),
    exists: true,
    schemaVersion: row.schema_version,
    updatedAt: row.updated_at,
  };
}
