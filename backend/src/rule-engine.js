import { transaction } from "./db.js";
import { publishRoomEvent } from "./room-event-bus.js";

async function conditionSatisfied(client, roomId, condition) {
  if (condition.type === "reading_completed") {
    const result = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM reading_progress
        WHERE room_id = $1 AND role_slot_id = $2 AND script_section_id = $3
          AND completed_at IS NOT NULL
      ) AS ok`,
      [roomId, condition.roleSlotId, condition.scriptSectionId]
    );
    return result.rows[0].ok;
  }

  if (condition.type === "clue_owned") {
    const result = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM clue_ownership
        WHERE room_id = $1 AND role_slot_id = $2 AND clue_id = $3
      ) AS ok`,
      [roomId, condition.roleSlotId, condition.clueId]
    );
    return result.rows[0].ok;
  }

  if (condition.type === "item_owned") {
    const result = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM inventory
        WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3 AND quantity > 0
      ) AS ok`,
      [roomId, condition.roleSlotId, condition.itemId]
    );
    return result.rows[0].ok;
  }

  if (condition.type === "investigation_completed") {
    const result = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM investigation_records
        WHERE room_id = $1 AND investigation_point_id = $2
      ) AS ok`,
      [roomId, condition.investigationPointId]
    );
    return result.rows[0].ok;
  }

  return false;
}

async function executeAction(client, roomId, action) {
  if (action.type === "unlock_script_section") {
    await client.query(
      `INSERT INTO room_content_unlocks (room_id, content_type, content_id, unlocked_at)
       VALUES ($1, 'script_section', $2, now())
       ON CONFLICT (room_id, content_type, content_id) DO NOTHING`,
      [roomId, action.scriptSectionId]
    );
  }

  if (action.type === "unlock_scene") {
    await client.query(
      `INSERT INTO room_content_unlocks (room_id, content_type, content_id, unlocked_at)
       VALUES ($1, 'scene', $2, now())
       ON CONFLICT (room_id, content_type, content_id) DO NOTHING`,
      [roomId, action.sceneId]
    );
  }

  if (action.type === "timeline_log") {
    await client.query(
      `INSERT INTO timeline_logs (room_id, visibility, event_type, message, metadata)
       VALUES ($1, 'host', 'rule_action', $2, $3::jsonb)`,
      [roomId, action.message, JSON.stringify(action.metadata ?? {})]
    );
  }

  if (action.type === "grant_clue") {
    await client.query(
      `INSERT INTO clue_ownership (room_id, role_slot_id, clue_id, metadata)
       VALUES ($1, $2, $3, jsonb_build_object('source', $4::text))
       ON CONFLICT (room_id, role_slot_id, clue_id) DO NOTHING`,
      [roomId, action.roleSlotId, action.clueId, action.source ?? "automation"]
    );
  }
}

async function executeActionsWithClient(client, roomId, actions) {
  for (const action of actions ?? []) {
    await executeAction(client, roomId, action);
  }
}

export async function executeActions(roomId, actions) {
  return transaction(async (client) => {
    await executeActionsWithClient(client, roomId, actions);
  });
}

export { executeActionsWithClient };

export async function evaluateRoomRules(roomId) {
  return transaction(async (client) => {
    const rules = await client.query(
      `SELECT id, name, mode, conditions, actions
       FROM automation_rules
       WHERE room_id = $1 AND enabled = true AND mode IN ('automatic', 'host_confirm')
       ORDER BY priority ASC, created_at ASC`,
      [roomId]
    );

    const executed = [];
    for (const rule of rules.rows) {
      const alreadyExecuted = await client.query(
        `SELECT 1 FROM rule_executions WHERE rule_id = $1 AND room_id = $2 LIMIT 1`,
        [rule.id, roomId]
      );
      if (alreadyExecuted.rowCount) continue;

      const conditions = rule.conditions?.all ?? [];
      const checks = await Promise.all(
        conditions.map((condition) => conditionSatisfied(client, roomId, condition))
      );
      if (!checks.every(Boolean)) continue;

      if (rule.mode === "host_confirm") {
        const inserted = await client.query(
          `INSERT INTO pending_host_events
            (room_id, rule_id, event_key, title, description, actions)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)
           ON CONFLICT (room_id, rule_id) WHERE rule_id IS NOT NULL DO NOTHING
           RETURNING id, title`,
          [
            roomId,
            rule.id,
            `rule:${rule.id}`,
            rule.name,
            "条件已满足，等待主持人确认。",
            JSON.stringify(rule.actions ?? [])
          ]
        );
        if (inserted.rowCount) {
          publishRoomEvent(roomId, "room.host_event_pending", {
            eventId: inserted.rows[0].id,
            title: inserted.rows[0].title,
            source: "rule"
          });
        }
        continue;
      }

      await executeActionsWithClient(client, roomId, rule.actions);
      for (const action of rule.actions ?? []) {
        if (action.type === "unlock_scene") {
          publishRoomEvent(roomId, "room.scene_unlocked", { sceneId: action.sceneId, source: "rule" });
        }
        if (action.type === "grant_clue") {
          publishRoomEvent(roomId, "room.clue_granted", {
            clueId: action.clueId,
            roleSlotId: action.roleSlotId,
            source: "rule"
          });
        }
      }
      await client.query(
        `INSERT INTO rule_executions (rule_id, room_id, result)
         VALUES ($1, $2, '{"status":"executed"}'::jsonb)`,
        [rule.id, roomId]
      );
      executed.push(rule.id);
    }
    return executed;
  });
}
