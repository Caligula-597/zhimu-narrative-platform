/**
 * Room-scoped Playable Content Runtime persistence (P7.1).
 */

import { query } from "../db.js";
import { normalizePlayableRuntimeState } from "../../shared/playable-content-runtime.js";

function run(client, text, params = []) {
  return client?.query ? client.query(text, params) : query(text, params);
}

export async function findRoomPlayableRuntime(roomId, { client = null, forUpdate = false } = {}) {
  const result = await run(
    client,
    `SELECT room_id, schema_version, playable_project_id, playable_project_revision,
            playable_fingerprint, playable_snapshot, status, current_stage_id, state,
            revision, started_at, finished_at, updated_at
     FROM room_playable_runtime_states
     WHERE room_id = $1
     ${forUpdate ? "FOR UPDATE" : ""}`,
    [roomId],
  );
  if (!result.rows[0]) return null;
  return rowToRuntime(result.rows[0]);
}

function rowToRuntime(row) {
  const merged = normalizePlayableRuntimeState({
    ...row.state,
    roomId: row.room_id,
    playableProjectId: row.playable_project_id,
    playableProjectRevision: row.playable_project_revision,
    playableFingerprint: row.playable_fingerprint,
    playableSnapshot: row.playable_snapshot,
    status: row.status,
    currentStageId: row.current_stage_id,
    revision: row.revision,
    startedAt: row.started_at?.toISOString?.() || row.started_at || row.state?.startedAt,
    finishedAt: row.finished_at?.toISOString?.() || row.finished_at || row.state?.finishedAt,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at || row.state?.updatedAt,
  });
  return merged;
}

export async function upsertRoomPlayableRuntime(client, runtime, actorId) {
  const state = normalizePlayableRuntimeState(runtime);
  if (!state?.roomId) {
    const err = new Error("ROOM_ID_REQUIRED");
    err.code = "ROOM_ID_REQUIRED";
    throw err;
  }
  const result = await client.query(
    `INSERT INTO room_playable_runtime_states (
       room_id, schema_version, playable_project_id, playable_project_revision,
       playable_fingerprint, playable_snapshot, status, current_stage_id, state,
       revision, started_at, finished_at, updated_by_user_id
     ) VALUES (
       $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10, $11, $12, $13
     )
     ON CONFLICT (room_id) DO UPDATE SET
       schema_version = EXCLUDED.schema_version,
       playable_project_id = EXCLUDED.playable_project_id,
       playable_project_revision = EXCLUDED.playable_project_revision,
       playable_fingerprint = EXCLUDED.playable_fingerprint,
       playable_snapshot = EXCLUDED.playable_snapshot,
       status = EXCLUDED.status,
       current_stage_id = EXCLUDED.current_stage_id,
       state = EXCLUDED.state,
       revision = EXCLUDED.revision,
       started_at = EXCLUDED.started_at,
       finished_at = EXCLUDED.finished_at,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_at = now()
     RETURNING room_id, schema_version, playable_project_id, playable_project_revision,
               playable_fingerprint, playable_snapshot, status, current_stage_id, state,
               revision, started_at, finished_at, updated_at`,
    [
      state.roomId,
      state.schemaVersion,
      state.playableProjectId,
      state.playableProjectRevision,
      state.playableFingerprint,
      JSON.stringify(state.playableSnapshot),
      state.status,
      state.currentStageId,
      JSON.stringify(state),
      state.revision,
      state.startedAt,
      state.finishedAt,
      actorId || null,
    ],
  );
  return rowToRuntime(result.rows[0]);
}
