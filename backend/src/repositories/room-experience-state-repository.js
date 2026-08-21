import { query } from "../db.js";

function run(client, text, params = []) {
  return client?.query ? client.query(text, params) : query(text, params);
}

const STATE_COLUMNS = `
  room_id, state_kind, scope_key, subject_key, schema_version, visibility,
  payload, revision, created_by_user_id, updated_by_user_id, expires_at,
  created_at, updated_at
`;

export function projectRoomExperienceState(row) {
  if (!row) return null;
  return {
    roomId: row.room_id,
    stateKind: row.state_kind,
    scopeKey: row.scope_key,
    subjectKey: row.subject_key,
    schemaVersion: Number(row.schema_version),
    visibility: row.visibility,
    payload: row.payload ?? {},
    revision: Number(row.revision),
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findRoomExperienceState(
  roomId,
  { stateKind, scopeKey, subjectKey = "room", client = null, forUpdate = false },
) {
  const result = await run(
    client,
    `SELECT ${STATE_COLUMNS}
     FROM room_experience_states
     WHERE room_id = $1 AND state_kind = $2 AND scope_key = $3 AND subject_key = $4
     ${forUpdate ? "FOR UPDATE" : ""}`,
    [roomId, stateKind, scopeKey, subjectKey],
  );
  return projectRoomExperienceState(result.rows[0]);
}

export async function listRoomExperienceStates(
  roomId,
  { stateKind, visibility = null, subjectKey = null, client = null, limit = 500 },
) {
  const result = await run(
    client,
    `SELECT ${STATE_COLUMNS}
     FROM room_experience_states
     WHERE room_id = $1 AND state_kind = $2
       AND ($3::text IS NULL OR visibility = $3)
       AND ($4::text IS NULL OR subject_key = $4)
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY updated_at DESC
     LIMIT $5`,
    [roomId, stateKind, visibility, subjectKey, limit],
  );
  return result.rows.map(projectRoomExperienceState);
}

export async function insertRoomExperienceState(
  client,
  {
    roomId,
    stateKind,
    scopeKey,
    subjectKey = "room",
    schemaVersion = 1,
    visibility = "host",
    payload,
    actorId,
    expiresAt = null,
  },
) {
  const result = await client.query(
    `INSERT INTO room_experience_states (
       room_id, state_kind, scope_key, subject_key, schema_version, visibility,
       payload, revision, created_by_user_id, updated_by_user_id, expires_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,1,$8,$8,$9)
     ON CONFLICT (room_id, state_kind, scope_key, subject_key) DO NOTHING
     RETURNING ${STATE_COLUMNS}`,
    [
      roomId,
      stateKind,
      scopeKey,
      subjectKey,
      schemaVersion,
      visibility,
      JSON.stringify(payload),
      actorId,
      expiresAt,
    ],
  );
  return projectRoomExperienceState(result.rows[0]);
}

export async function updateRoomExperienceState(
  client,
  {
    roomId,
    stateKind,
    scopeKey,
    subjectKey = "room",
    expectedRevision,
    schemaVersion = 1,
    visibility = "host",
    payload,
    actorId,
    expiresAt = null,
  },
) {
  const result = await client.query(
    `UPDATE room_experience_states SET
       schema_version = $6,
       visibility = $7,
       payload = $8::jsonb,
       revision = revision + 1,
       updated_by_user_id = $9,
       expires_at = $10,
       updated_at = now()
     WHERE room_id = $1 AND state_kind = $2 AND scope_key = $3
       AND subject_key = $4 AND revision = $5
     RETURNING ${STATE_COLUMNS}`,
    [
      roomId,
      stateKind,
      scopeKey,
      subjectKey,
      expectedRevision,
      schemaVersion,
      visibility,
      JSON.stringify(payload),
      actorId,
      expiresAt,
    ],
  );
  return projectRoomExperienceState(result.rows[0]);
}

export async function deleteRoomExperienceState(
  client,
  { roomId, stateKind, scopeKey, subjectKey = "room", expectedRevision },
) {
  const result = await client.query(
    `DELETE FROM room_experience_states
     WHERE room_id = $1 AND state_kind = $2 AND scope_key = $3
       AND subject_key = $4 AND revision = $5`,
    [roomId, stateKind, scopeKey, subjectKey, expectedRevision],
  );
  return result.rowCount > 0;
}
