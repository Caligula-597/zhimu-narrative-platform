export async function clearCheckpointScope(client, roomId, scope) {
  // Keep this order stable across restores to minimize deadlock cycles.
  if (scope.readingProgress) await client.query(`DELETE FROM reading_progress WHERE room_id = $1`, [roomId]);
  if (scope.inventory) await client.query(`DELETE FROM inventory WHERE room_id = $1`, [roomId]);
  if (scope.contentUnlocks) await client.query(`DELETE FROM room_content_unlocks WHERE room_id = $1`, [roomId]);
  if (scope.clueOwnership) {
    await client.query(`DELETE FROM clue_read_receipts WHERE room_id = $1`, [roomId]);
    await client.query(`DELETE FROM clue_ownership WHERE room_id = $1`, [roomId]);
  }
  if (scope.pendingHostEvents) {
    await client.query(
      `DELETE FROM pending_host_events WHERE room_id = $1 AND status IN ('pending', 'delayed')`,
      [roomId]
    );
  }
  if (scope.investigationRecords) await client.query(`DELETE FROM investigation_records WHERE room_id = $1`, [roomId]);
  if (scope.playerStates) await client.query(`DELETE FROM player_states WHERE room_id = $1`, [roomId]);
  if (scope.ruleExecutions) await client.query(`DELETE FROM rule_executions WHERE room_id = $1`, [roomId]);
  if (scope.timelineLogs) await client.query(`DELETE FROM timeline_logs WHERE room_id = $1`, [roomId]);
}

async function insertJsonRows(client, text, roomId, rows) {
  if (!rows.length) return;
  await client.query(text, [roomId, JSON.stringify(rows)]);
}

export async function applyCheckpointState(client, roomId, state, scope) {
  if (scope.readingProgress) {
    await insertJsonRows(client,
      `INSERT INTO reading_progress (room_id, role_slot_id, script_section_id, started_at, completed_at)
       SELECT $1, row.role_slot_id, row.script_section_id, row.started_at, row.completed_at
       FROM jsonb_to_recordset($2::jsonb) AS row(
         role_slot_id uuid, script_section_id uuid, started_at timestamptz, completed_at timestamptz
       )`, roomId, state.readingProgress);
  }
  if (scope.inventory) {
    await insertJsonRows(client,
      `INSERT INTO inventory (room_id, role_slot_id, item_id, quantity, metadata)
       SELECT $1, row.role_slot_id, row.item_id, row.quantity, row.metadata
       FROM jsonb_to_recordset($2::jsonb) AS row(
         role_slot_id uuid, item_id uuid, quantity integer, metadata jsonb
       )`, roomId, state.inventory);
  }
  if (scope.contentUnlocks) {
    await insertJsonRows(client,
      `INSERT INTO room_content_unlocks (room_id, content_type, content_id, unlocked_at, unlocked_by_rule_id)
       SELECT $1, row.content_type, row.content_id, row.unlocked_at, row.unlocked_by_rule_id
       FROM jsonb_to_recordset($2::jsonb) AS row(
         content_type text, content_id uuid, unlocked_at timestamptz, unlocked_by_rule_id uuid
       )
       ON CONFLICT (room_id, content_type, content_id) DO NOTHING`, roomId, state.contentUnlocks);
  }
  if (scope.clueOwnership) {
    await insertJsonRows(client,
      `INSERT INTO clue_ownership
        (room_id, role_slot_id, clue_id, acquired_at, read_at, shared_with_room,
         shared_with_roles, player_note, host_note, shared_at, metadata)
       SELECT $1, row.role_slot_id, row.clue_id, row.acquired_at, row.read_at,
              row.shared_with_room, row.shared_with_roles, row.player_note,
              row.host_note, row.shared_at, '{}'::jsonb
       FROM jsonb_to_recordset($2::jsonb) AS row(
         role_slot_id uuid, clue_id uuid, acquired_at timestamptz, read_at timestamptz,
         shared_with_room boolean, shared_with_roles uuid[], player_note text,
         host_note text, shared_at timestamptz
       )`, roomId, state.clueOwnership);
  }
  if (scope.pendingHostEvents) {
    await insertJsonRows(client,
      `INSERT INTO pending_host_events
        (id, room_id, rule_id, event_key, title, description, actions, status, created_at, delay_until)
       SELECT gen_random_uuid(), $1, row.rule_id, row.event_key, row.title, row.description,
              row.actions, row.status, row.created_at, row.delay_until
       FROM jsonb_to_recordset($2::jsonb) AS row(
         rule_id uuid, event_key text, title text, description text, actions jsonb,
         status text, created_at timestamptz, delay_until timestamptz
       )
       ON CONFLICT (room_id, rule_id) WHERE rule_id IS NOT NULL DO UPDATE
       SET event_key = EXCLUDED.event_key,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           actions = EXCLUDED.actions,
           status = EXCLUDED.status,
           created_at = EXCLUDED.created_at,
           delay_until = EXCLUDED.delay_until,
           resolved_at = NULL,
           resolved_by_user_id = NULL`, roomId, state.pendingEvents);
  }
  if (scope.investigationRecords) {
    await insertJsonRows(client,
      `INSERT INTO investigation_records
        (room_id, investigation_point_id, role_slot_id, result, investigated_at)
       SELECT $1, row.investigation_point_id, row.role_slot_id, row.result, row.investigated_at
       FROM jsonb_to_recordset($2::jsonb) AS row(
         investigation_point_id uuid, role_slot_id uuid, result jsonb, investigated_at timestamptz
       )
       ON CONFLICT (room_id, investigation_point_id, role_slot_id) DO NOTHING`, roomId, state.investigationRecords);
  }
  if (scope.playerStates) {
    await insertJsonRows(client,
      `INSERT INTO player_states (room_id, role_slot_id, current_scene_id, variables, updated_at)
       SELECT $1, row.role_slot_id, row.current_scene_id, row.variables, row.updated_at
       FROM jsonb_to_recordset($2::jsonb) AS row(
         role_slot_id uuid, current_scene_id uuid, variables jsonb, updated_at timestamptz
       )
       ON CONFLICT (room_id, role_slot_id) DO UPDATE
       SET current_scene_id = EXCLUDED.current_scene_id,
           variables = EXCLUDED.variables,
           updated_at = EXCLUDED.updated_at`, roomId, state.playerStates);
  }
  if (scope.ruleExecutions) {
    await insertJsonRows(client,
      `INSERT INTO rule_executions (rule_id, room_id, result, executed_at)
       SELECT row.rule_id, $1, row.result, row.executed_at
       FROM jsonb_to_recordset($2::jsonb) AS row(
         rule_id uuid, result jsonb, executed_at timestamptz
       )
       ON CONFLICT (rule_id, room_id) DO UPDATE
       SET result = EXCLUDED.result, executed_at = EXCLUDED.executed_at`, roomId, state.ruleExecutions);
  }
  if (scope.timelineLogs) {
    await insertJsonRows(client,
      `INSERT INTO timeline_logs
        (room_id, actor_user_id, visibility, event_type, message, metadata, created_at)
       SELECT $1, row.actor_user_id, row.visibility::visibility_scope, row.event_type,
              row.message, row.metadata, row.created_at
       FROM jsonb_to_recordset($2::jsonb) AS row(
         actor_user_id uuid, visibility text, event_type text, message text,
         metadata jsonb, created_at timestamptz
       )`, roomId, state.timelineLogs);
  }
}
