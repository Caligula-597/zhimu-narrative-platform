import { query } from "../db.js";

function run(client, text, params = []) {
  return client ? client.query(text, params) : query(text, params);
}

export async function listCheckpointSummaries(roomId) {
  const result = await query(
    `SELECT cp.id,
            cp.label,
            COALESCE(cp.snapshot->>'description', '') AS description,
            cp.created_at,
            COALESCE((
              SELECT profile.display_name FROM user_portal_profiles profile
              WHERE profile.user_id = u.id AND profile.portal = 'host'
            ), u.display_name) AS created_by_name,
            jsonb_build_object(
              'joinedPlayers', (
                SELECT COUNT(*)::int
                FROM jsonb_array_elements(
                  CASE WHEN jsonb_typeof(cp.snapshot->'players') = 'array'
                    THEN cp.snapshot->'players' ELSE '[]'::jsonb END
                ) AS player
                WHERE player->>'joined' = 'true'
              ),
              'totalRoles', CASE WHEN jsonb_typeof(cp.snapshot->'players') = 'array'
                THEN jsonb_array_length(cp.snapshot->'players') ELSE 0 END,
              'clueCount', CASE WHEN jsonb_typeof(cp.snapshot->'clueOwnership') = 'array'
                THEN jsonb_array_length(cp.snapshot->'clueOwnership')
                ELSE COALESCE((
                  SELECT SUM(CASE WHEN player->>'ownedClues' ~ '^[0-9]+$'
                    THEN (player->>'ownedClues')::int ELSE 0 END)::int
                  FROM jsonb_array_elements(
                    CASE WHEN jsonb_typeof(cp.snapshot->'players') = 'array'
                      THEN cp.snapshot->'players' ELSE '[]'::jsonb END
                  ) AS player
                ), 0)
              END,
              'unlockedSceneCount', CASE WHEN jsonb_typeof(cp.snapshot->'unlockedScenes') = 'array'
                THEN jsonb_array_length(cp.snapshot->'unlockedScenes') ELSE 0 END,
              'pendingEventCount', CASE WHEN jsonb_typeof(cp.snapshot->'pendingEvents') = 'array'
                THEN jsonb_array_length(cp.snapshot->'pendingEvents') ELSE 0 END
            ) AS summary
     FROM checkpoints cp
     JOIN users u ON u.id = cp.created_by_user_id
     WHERE cp.room_id = $1
     ORDER BY cp.created_at DESC`,
    [roomId]
  );
  return result.rows;
}

export async function findCheckpoint(roomId, checkpointId) {
  const result = await query(
    `SELECT cp.id, cp.label, cp.snapshot, cp.schema_version, cp.created_at, cp.room_id,
            COALESCE((
              SELECT profile.display_name FROM user_portal_profiles profile
              WHERE profile.user_id = u.id AND profile.portal = 'host'
            ), u.display_name) AS created_by_name
     FROM checkpoints cp
     JOIN users u ON u.id = cp.created_by_user_id
     WHERE cp.id = $1 AND cp.room_id = $2`,
    [checkpointId, roomId]
  );
  return result.rows[0] ?? null;
}

export async function listCheckpointRestores(roomId, checkpointId) {
  const result = await query(
    `SELECT cr.id, cr.status, cr.restore_scope, cr.error_message, cr.applied_at, cr.created_at,
            COALESCE((
              SELECT profile.display_name FROM user_portal_profiles profile
              WHERE profile.user_id = u.id AND profile.portal = 'host'
            ), u.display_name) AS requested_by_name
     FROM checkpoint_restores cr
     JOIN users u ON u.id = cr.requested_by_user_id
     WHERE cr.room_id = $1 AND cr.checkpoint_id = $2
     ORDER BY cr.created_at DESC`,
    [roomId, checkpointId]
  );
  return result.rows;
}

export async function findCheckpointRestoreContext(checkpointId, targetRoomId, { client = null } = {}) {
  const result = await run(
    client,
    `SELECT cp.id, cp.schema_version, cp.snapshot, cp.room_id AS source_room_id,
            source_room.world_id AS source_world_id,
            target_room.id AS target_room_id,
            target_room.world_id AS target_world_id
     FROM checkpoints cp
     JOIN rooms source_room ON source_room.id = cp.room_id
     LEFT JOIN rooms target_room ON target_room.id = $2
     WHERE cp.id = $1`,
    [checkpointId, targetRoomId]
  );
  return result.rows[0] ?? null;
}

export async function insertCheckpoint(client, { roomId, actorId, title, snapshot }) {
  const result = await client.query(
    `INSERT INTO checkpoints (room_id, created_by_user_id, label, snapshot, schema_version)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id, label, snapshot, schema_version, created_at`,
    [roomId, actorId, title, JSON.stringify(snapshot), snapshot.schemaVersion ?? 2]
  );
  return result.rows[0];
}

export async function insertPendingCheckpointRestore({ roomId, checkpointId, actorId, scope }) {
  const result = await query(
    `INSERT INTO checkpoint_restores (room_id, checkpoint_id, requested_by_user_id, status, restore_scope)
     VALUES ($1, $2, $3, 'pending', $4::jsonb)
     RETURNING id`,
    [roomId, checkpointId, actorId, JSON.stringify(scope)]
  );
  return result.rows[0];
}

export async function markCheckpointRestoreApplied(client, { restoreId, beforeSnapshot, result }) {
  await client.query(
    `UPDATE checkpoint_restores
     SET status = 'applied', before_snapshot = $2::jsonb, applied_at = now(), result = $3::jsonb,
         error_message = NULL
     WHERE id = $1`,
    [restoreId, JSON.stringify(beforeSnapshot), JSON.stringify(result)]
  );
}

export async function markCheckpointRestoreFailed(restoreId, publicMessage) {
  await query(
    `UPDATE checkpoint_restores
     SET status = 'failed', error_message = $2, applied_at = now()
     WHERE id = $1 AND status = 'pending'`,
    [restoreId, publicMessage]
  );
}

export async function configureCheckpointTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '5000ms', true),
            set_config('statement_timeout', '30000ms', true)`
  );
}

export async function lockCheckpointTargetRoom(client, roomId) {
  const result = await client.query(`SELECT id FROM rooms WHERE id = $1 FOR UPDATE`, [roomId]);
  return result.rowCount > 0;
}

export async function appendCheckpointRestoreLog(client, { roomId, snapshot, scope, sourceRoomId }) {
  await client.query(
    `INSERT INTO timeline_logs (room_id, visibility, event_type, message, metadata)
     VALUES ($1, 'host', 'checkpoint_restored', '主持人从存档恢复了房间运行状态', $2::jsonb)`,
    [roomId, JSON.stringify({
      schemaVersion: snapshot.schemaVersion,
      scope,
      sourceRoomId,
      targetRoomId: roomId,
      crossRoom: sourceRoomId != null && sourceRoomId !== roomId
    })]
  );
}

export async function insertCheckpointRestoreAudit(client, {
  roomId,
  actorId,
  checkpointId,
  restoreId,
  scope,
  sourceRoomId
}) {
  await client.query(
    `INSERT INTO host_audit_log
      (room_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, 'checkpoint_restore', 'checkpoint', $3, $4::jsonb)`,
    [roomId, actorId, checkpointId, JSON.stringify({
      restoreId,
      scope,
      sourceRoomId,
      crossRoom: sourceRoomId !== roomId
    })]
  );
}
