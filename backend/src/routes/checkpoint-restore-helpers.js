import { throwErr } from "../api-errors.js";
import { buildRoomCheckpointSnapshot } from "./checkpoint-helpers.js";

const DEFAULT_SCOPE = {
  readingProgress: true,
  clueOwnership: true,
  inventory: true,
  contentUnlocks: true,
  pendingHostEvents: true,
  investigationRecords: true,
  playerStates: true,
  ruleExecutions: true,
  timelineLogs: false
};

function mergeScope(input = {}) {
  return { ...DEFAULT_SCOPE, ...input };
}

export function validateRestoreSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throwErr("INVALID_SNAPSHOT");
  }
  const version = snapshot.schemaVersion ?? 1;
  if (version < 2) {
    throwErr("SNAPSHOT_VERSION_UNSUPPORTED", undefined, { schemaVersion: version });
  }
}

async function clearScopedState(client, roomId, scope) {
  if (scope.readingProgress) {
    await client.query(`DELETE FROM reading_progress WHERE room_id = $1`, [roomId]);
  }
  if (scope.inventory) {
    await client.query(`DELETE FROM inventory WHERE room_id = $1`, [roomId]);
  }
  if (scope.contentUnlocks) {
    await client.query(`DELETE FROM room_content_unlocks WHERE room_id = $1`, [roomId]);
  }
  if (scope.clueOwnership) {
    await client.query(`DELETE FROM clue_ownership WHERE room_id = $1`, [roomId]);
    await client.query(`DELETE FROM clue_read_receipts WHERE room_id = $1`, [roomId]);
  }
  if (scope.pendingHostEvents) {
    await client.query(
      `DELETE FROM pending_host_events WHERE room_id = $1 AND status IN ('pending', 'delayed')`,
      [roomId]
    );
  }
  if (scope.investigationRecords) {
    await client.query(`DELETE FROM investigation_records WHERE room_id = $1`, [roomId]);
  }
  if (scope.playerStates) {
    await client.query(`DELETE FROM player_states WHERE room_id = $1`, [roomId]);
  }
  if (scope.ruleExecutions) {
    await client.query(`DELETE FROM rule_executions WHERE room_id = $1`, [roomId]);
  }
  if (scope.timelineLogs) {
    await client.query(`DELETE FROM timeline_logs WHERE room_id = $1`, [roomId]);
  }
}

async function applySnapshotState(client, roomId, snapshot, scope) {
  if (scope.readingProgress) {
    for (const row of snapshot.readingProgress ?? []) {
      await client.query(
        `INSERT INTO reading_progress (room_id, role_slot_id, script_section_id, started_at, completed_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [roomId, row.role_slot_id ?? row.roleSlotId, row.script_section_id ?? row.scriptSectionId, row.started_at ?? row.startedAt ?? new Date(), row.completed_at ?? row.completedAt]
      );
    }
  }

  if (scope.inventory) {
    for (const row of snapshot.inventory ?? []) {
      await client.query(
        `INSERT INTO inventory (room_id, role_slot_id, item_id, quantity, metadata)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          roomId,
          row.role_slot_id ?? row.roleSlotId,
          row.item_id ?? row.itemId,
          row.quantity ?? 1,
          JSON.stringify(row.metadata ?? {})
        ]
      );
    }
  }

  if (scope.contentUnlocks) {
    for (const row of snapshot.contentUnlocks ?? []) {
      await client.query(
        `INSERT INTO room_content_unlocks (room_id, content_type, content_id, unlocked_at, unlocked_by_rule_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (room_id, content_type, content_id) DO NOTHING`,
        [
          roomId,
          row.content_type ?? row.contentType,
          row.content_id ?? row.contentId,
          row.unlocked_at ?? row.unlockedAt ?? new Date(),
          row.unlocked_by_rule_id ?? row.unlockedByRuleId ?? null
        ]
      );
    }
  }

  if (scope.clueOwnership) {
    for (const row of snapshot.clueOwnership ?? []) {
      await client.query(
        `INSERT INTO clue_ownership
          (room_id, role_slot_id, clue_id, acquired_at, read_at, shared_with_room, shared_with_roles, player_note, host_note, shared_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '{}'::jsonb)`,
        [
          roomId,
          row.role_slot_id ?? row.roleSlotId,
          row.clue_id ?? row.clueId,
          row.acquired_at ?? row.acquiredAt ?? new Date(),
          row.read_at ?? row.readAt ?? null,
          row.shared_with_room ?? row.sharedWithRoom ?? false,
          row.shared_with_roles ?? row.sharedWithRoles ?? [],
          row.player_note ?? row.playerNote ?? "",
          row.host_note ?? row.hostNote ?? "",
          row.shared_at ?? row.sharedAt ?? null
        ]
      );
    }
  }

  if (scope.pendingHostEvents) {
    for (const row of snapshot.pendingEvents ?? []) {
      const status = row.status ?? "pending";
      if (!["pending", "delayed"].includes(status)) continue;
      await client.query(
        `INSERT INTO pending_host_events
          (id, room_id, rule_id, event_key, title, description, actions, status, created_at, delay_until)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          roomId,
          row.rule_id ?? row.ruleId ?? null,
          row.event_key ?? row.eventKey ?? `restore-${row.id}`,
          row.title,
          row.description ?? "",
          JSON.stringify(row.actions ?? []),
          status,
          row.created_at ?? row.createdAt ?? new Date(),
          row.delay_until ?? row.delayUntil ?? null
        ]
      );
    }
  }

  if (scope.investigationRecords) {
    for (const row of snapshot.investigationRecords ?? []) {
      await client.query(
        `INSERT INTO investigation_records (room_id, investigation_point_id, role_slot_id, result, investigated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (room_id, investigation_point_id, role_slot_id) DO NOTHING`,
        [
          roomId,
          row.investigation_point_id ?? row.investigationPointId,
          row.role_slot_id ?? row.roleSlotId,
          JSON.stringify(row.result ?? {}),
          row.investigated_at ?? row.investigatedAt ?? new Date()
        ]
      );
    }
  }

  if (scope.playerStates) {
    for (const row of snapshot.playerStates ?? []) {
      await client.query(
        `INSERT INTO player_states (room_id, role_slot_id, current_scene_id, variables, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (room_id, role_slot_id) DO UPDATE
         SET current_scene_id = EXCLUDED.current_scene_id,
             variables = EXCLUDED.variables,
             updated_at = EXCLUDED.updated_at`,
        [
          roomId,
          row.role_slot_id ?? row.roleSlotId,
          row.current_scene_id ?? row.currentSceneId ?? null,
          JSON.stringify(row.variables ?? {}),
          row.updated_at ?? row.updatedAt ?? new Date()
        ]
      );
    }
  }

  if (scope.ruleExecutions) {
    for (const row of snapshot.ruleExecutions ?? []) {
      await client.query(
        `INSERT INTO rule_executions (rule_id, room_id, result, executed_at)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (rule_id, room_id) DO UPDATE
         SET result = EXCLUDED.result,
             executed_at = EXCLUDED.executed_at`,
        [
          row.rule_id ?? row.ruleId,
          roomId,
          JSON.stringify(row.result ?? {}),
          row.executed_at ?? row.executedAt ?? new Date()
        ]
      );
    }
  }

  if (scope.timelineLogs) {
    for (const row of snapshot.timelineLogs ?? []) {
      await client.query(
        `INSERT INTO timeline_logs (room_id, actor_user_id, visibility, event_type, message, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          roomId,
          row.actor_user_id ?? row.actorUserId ?? null,
          row.visibility ?? "host",
          row.event_type ?? row.eventType,
          row.message,
          JSON.stringify(row.metadata ?? {}),
          row.created_at ?? row.createdAt ?? new Date()
        ]
      );
    }
  }
}

export async function restoreRoomFromCheckpoint(client, roomId, snapshot, scopeInput = {}, options = {}) {
  validateRestoreSnapshot(snapshot);
  const scope = mergeScope(scopeInput);
  const sourceRoomId = options.sourceRoomId ?? snapshot.roomId ?? null;

  const locked = await client.query(`SELECT id FROM rooms WHERE id = $1 FOR UPDATE`, [roomId]);
  if (!locked.rowCount) {
    throwErr("ROOM_NOT_FOUND");
  }

  const beforeSnapshot = await buildRoomCheckpointSnapshot(roomId, { client });
  await clearScopedState(client, roomId, scope);
  await applySnapshotState(client, roomId, snapshot, scope);

  await client.query(
    `INSERT INTO timeline_logs (room_id, visibility, event_type, message, metadata)
     VALUES ($1, 'host', 'checkpoint_restored', '主持人从存档恢复了房间运行状态', $2::jsonb)`,
    [
      roomId,
      JSON.stringify({
        schemaVersion: snapshot.schemaVersion,
        scope,
        sourceRoomId,
        targetRoomId: roomId,
        crossRoom: sourceRoomId != null && sourceRoomId !== roomId
      })
    ]
  );

  return { beforeSnapshot, scope, sourceRoomId, targetRoomId: roomId };
}
