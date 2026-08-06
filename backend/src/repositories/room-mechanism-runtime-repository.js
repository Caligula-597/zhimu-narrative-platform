import { query } from "../db.js";

function run(client, text, params = []) {
  return client?.query ? client.query(text, params) : query(text, params);
}

export function projectRoomMechanismState(row) {
  if (!row) return null;
  return {
    roomId: row.room_id,
    mechanismSchemaVersion: Number(row.mechanism_schema_version),
    contentBindingMode: row.content_binding_mode,
    contentReleaseId: row.content_release_id,
    sourceContentRevision: Number(row.source_content_revision),
    mechanismPackageSha256: row.mechanism_package_sha256,
    revision: Number(row.revision),
    initializedByUserId: row.initialized_by_user_id,
    initializedAt: row.initialized_at,
    updatedAt: row.updated_at,
    metadata: row.metadata ?? {},
    runtime: {
      schemaVersion: 1,
      mechanismSchemaVersion: Number(row.mechanism_schema_version),
      status: row.status,
      currentRoundKey: row.current_round_key,
      currentRoundSequence: row.current_round_sequence == null ? null : Number(row.current_round_sequence),
      preparedRoundKey: row.prepared_round_key,
      currentBranch: row.current_branch,
      currentVariantKey: row.current_variant_key,
      states: row.state_values ?? {},
      resources: row.resource_values ?? {},
      evidence: row.evidence_states ?? {},
      events: row.event_states ?? {},
      decisionStates: row.decision_states ?? {},
      executedInvestigations: row.executed_investigations ?? {},
      ending: row.ending ?? null
    }
  };
}

const STATE_COLUMNS = `
  room_id, mechanism_schema_version, content_binding_mode, content_release_id,
  source_content_revision, mechanism_package_sha256, status, current_round_key,
  current_round_sequence, prepared_round_key, current_branch, current_variant_key,
  state_values, resource_values, evidence_states, event_states, decision_states,
  executed_investigations, ending, revision, initialized_by_user_id,
  initialized_at, updated_at, metadata
`;

export async function findRoomMechanismState(roomId, { client = null, forUpdate = false } = {}) {
  const result = await run(
    client,
    `SELECT ${STATE_COLUMNS}
     FROM room_mechanism_states
     WHERE room_id = $1
     ${forUpdate ? "FOR UPDATE" : ""}`,
    [roomId]
  );
  return projectRoomMechanismState(result.rows[0]);
}

function runtimeParams(runtime) {
  return [
    runtime.status,
    runtime.currentRoundKey,
    runtime.currentRoundSequence,
    runtime.preparedRoundKey,
    runtime.currentBranch,
    runtime.currentVariantKey,
    JSON.stringify(runtime.states ?? {}),
    JSON.stringify(runtime.resources ?? {}),
    JSON.stringify(runtime.evidence ?? {}),
    JSON.stringify(runtime.events ?? {}),
    JSON.stringify(runtime.decisionStates ?? {}),
    JSON.stringify(runtime.executedInvestigations ?? {}),
    runtime.ending == null ? null : JSON.stringify(runtime.ending)
  ];
}

export async function insertRoomMechanismState(client, {
  roomId,
  mechanismSchemaVersion,
  contentBindingMode,
  contentReleaseId,
  sourceContentRevision,
  mechanismPackageSha256,
  actorId,
  runtime,
  metadata = {}
}) {
  const values = runtimeParams(runtime);
  const result = await client.query(
    `INSERT INTO room_mechanism_states (
       room_id, mechanism_schema_version, content_binding_mode, content_release_id,
       source_content_revision, mechanism_package_sha256,
       status, current_round_key, current_round_sequence, prepared_round_key,
       current_branch, current_variant_key, state_values, resource_values,
       evidence_states, event_states, decision_states, executed_investigations,
       ending, revision, initialized_by_user_id, metadata
     ) VALUES (
       $1,$2,$3,$4,$5,$6,
       $7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,
       $17::jsonb,$18::jsonb,$19::jsonb,1,$20,$21::jsonb
     )
     RETURNING ${STATE_COLUMNS}`,
    [
      roomId, mechanismSchemaVersion, contentBindingMode, contentReleaseId,
      sourceContentRevision, mechanismPackageSha256,
      ...values,
      actorId,
      JSON.stringify(metadata)
    ]
  );
  return projectRoomMechanismState(result.rows[0]);
}

export async function replaceRoomMechanismState(client, {
  roomId,
  expectedRevision,
  mechanismSchemaVersion,
  contentBindingMode,
  contentReleaseId,
  sourceContentRevision,
  mechanismPackageSha256,
  actorId,
  runtime,
  metadata = {}
}) {
  const values = runtimeParams(runtime);
  const result = await client.query(
    `UPDATE room_mechanism_states SET
       mechanism_schema_version = $3,
       content_binding_mode = $4,
       content_release_id = $5,
       source_content_revision = $6,
       mechanism_package_sha256 = $7,
       status = $8,
       current_round_key = $9,
       current_round_sequence = $10,
       prepared_round_key = $11,
       current_branch = $12,
       current_variant_key = $13,
       state_values = $14::jsonb,
       resource_values = $15::jsonb,
       evidence_states = $16::jsonb,
       event_states = $17::jsonb,
       decision_states = $18::jsonb,
       executed_investigations = $19::jsonb,
       ending = $20::jsonb,
       revision = revision + 1,
       initialized_by_user_id = $21,
       initialized_at = now(),
       updated_at = now(),
       metadata = $22::jsonb
     WHERE room_id = $1 AND revision = $2
     RETURNING ${STATE_COLUMNS}`,
    [
      roomId, expectedRevision, mechanismSchemaVersion, contentBindingMode,
      contentReleaseId, sourceContentRevision, mechanismPackageSha256,
      ...values,
      actorId,
      JSON.stringify(metadata)
    ]
  );
  return projectRoomMechanismState(result.rows[0]);
}

export async function updateRoomMechanismRuntime(client, {
  roomId,
  expectedRevision,
  runtime
}) {
  const values = runtimeParams(runtime);
  const result = await client.query(
    `UPDATE room_mechanism_states SET
       status = $3,
       current_round_key = $4,
       current_round_sequence = $5,
       prepared_round_key = $6,
       current_branch = $7,
       current_variant_key = $8,
       state_values = $9::jsonb,
       resource_values = $10::jsonb,
       evidence_states = $11::jsonb,
       event_states = $12::jsonb,
       decision_states = $13::jsonb,
       executed_investigations = $14::jsonb,
       ending = $15::jsonb,
       revision = revision + 1,
       updated_at = now()
     WHERE room_id = $1 AND revision = $2
     RETURNING ${STATE_COLUMNS}`,
    [roomId, expectedRevision, ...values]
  );
  return projectRoomMechanismState(result.rows[0]);
}

export async function appendRoomMechanismAction(client, {
  roomId,
  actorId,
  revisionBefore,
  revisionAfter,
  roundKey,
  actionType,
  actionKey = null,
  optionKey = null,
  changes = [],
  request = {},
  metadata = {}
}) {
  const result = await client.query(
    `INSERT INTO room_mechanism_action_log (
       room_id, actor_user_id, revision_before, revision_after, round_key,
       action_type, action_key, option_key, changes, request, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb)
     RETURNING id, created_at`,
    [
      roomId, actorId, revisionBefore, revisionAfter, roundKey,
      actionType, actionKey, optionKey, JSON.stringify(changes),
      JSON.stringify(request), JSON.stringify(metadata)
    ]
  );
  return result.rows[0];
}

export async function listRoomMechanismActions(roomId, { limit = 100, client = null } = {}) {
  const result = await run(
    client,
    `SELECT id, actor_user_id, revision_before, revision_after, round_key,
            action_type, action_key, option_key, changes, request, metadata, created_at
     FROM room_mechanism_action_log
     WHERE room_id = $1
     ORDER BY revision_after DESC
     LIMIT $2`,
    [roomId, limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    revisionBefore: Number(row.revision_before),
    revisionAfter: Number(row.revision_after),
    roundKey: row.round_key,
    actionType: row.action_type,
    actionKey: row.action_key,
    optionKey: row.option_key,
    changes: row.changes ?? [],
    request: row.request ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  }));
}
