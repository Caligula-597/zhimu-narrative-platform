import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { transaction } from "./db.js";
import { transactionWithEvents } from "./transaction-events.js";
import { grantItemToInventory } from "./inventory-helpers.js";
import { collectFailedConditionLeaves, evaluateConditions, traceConditions } from "./rule-condition-evaluator.js";
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

  if (action.type === "grant_item") {
    await grantItemToInventory(client, {
      roomId,
      roleSlotId: action.roleSlotId,
      itemId: action.itemId,
      quantity: action.quantity ?? 1,
      source: action.source ?? "automation"
    });
  }
}

async function executeActionsWithClient(client, roomId, actions) {
  for (const action of actions ?? []) {
    await executeAction(client, roomId, action);
  }
}

export function queueRuleActionEvents(queueEvent, roomId, actions, source = "rule") {
  for (const action of actions ?? []) {
    if (action.type === "unlock_scene") {
      queueEvent(roomId, "room.scene_unlocked", { sceneId: action.sceneId, source });
    }
    if (action.type === "unlock_script_section") {
      queueEvent(roomId, "room.section_unlocked", {
        scriptSectionId: action.scriptSectionId,
        source
      });
    }
    if (action.type === "grant_clue") {
      queueEvent(roomId, "room.clue_granted", {
        clueId: action.clueId,
        roleSlotId: action.roleSlotId,
        source
      });
    }
    if (action.type === "grant_item") {
      queueEvent(roomId, "room.item_granted", {
        itemId: action.itemId,
        roleSlotId: action.roleSlotId,
        source
      });
    }
  }
}

export async function executeActions(roomId, actions) {
  return transaction(async (client) => {
    await executeActionsWithClient(client, roomId, actions);
  });
}

export { executeActionsWithClient };

export async function previewRoomRules(roomId, { executor = query } = {}) {
  const rules = await executor(
    `SELECT ar.id, ar.name, ar.mode, ar.priority, ar.conditions, ar.enabled,
            EXISTS (
              SELECT 1 FROM rule_executions re
              WHERE re.rule_id = ar.id AND re.room_id = $1
            ) AS already_executed,
            EXISTS (
              SELECT 1 FROM pending_host_events phe
              WHERE phe.room_id = $1 AND phe.rule_id = ar.id
                AND phe.status IN ('pending', 'delayed')
            ) AS pending_host_event
     FROM automation_rules ar
     WHERE ar.room_id = $1 AND ar.enabled = true
     ORDER BY ar.priority ASC, ar.created_at ASC`,
    [roomId]
  );

  const dbClient = { query: (...args) => executor(...args) };
  const preview = [];

  for (const rule of rules.rows) {
    const conditions = rule.conditions ?? {};
    const conditionTrace = await traceConditions(dbClient, roomId, conditions);
    const conditionsMet = conditionTrace.satisfied;
    const failedLeaves = collectFailedConditionLeaves(conditionTrace);
    let status = "waiting";
    if (rule.mode === "manual") {
      status = conditionsMet ? "manual_ready" : "conditions_unmet";
    } else if (rule.already_executed) {
      status = "already_executed";
    } else if (!conditionsMet) {
      status = "conditions_unmet";
    } else if (rule.mode === "host_confirm") {
      status = rule.pending_host_event ? "pending_host_event" : "would_queue_host_confirm";
    } else {
      status = "would_execute";
    }

    preview.push({
      id: rule.id,
      name: rule.name,
      mode: rule.mode,
      priority: rule.priority,
      conditionsMet,
      alreadyExecuted: rule.already_executed,
      pendingHostEvent: rule.pending_host_event,
      status,
      conditionTrace,
      failedConditions: failedLeaves.map((leaf) => ({
        type: leaf.type,
        label: leaf.label,
        refs: leaf.refs
      }))
    });
  }

  return preview;
}

export async function triggerManualRuleWithClient(client, queueEvent, roomId, ruleId) {
  const ruleResult = await client.query(
    `SELECT id, name, mode, enabled, room_id, conditions, actions
     FROM automation_rules WHERE id = $1`,
    [ruleId]
  );
  if (!ruleResult.rowCount) throwErr("RULE_NOT_FOUND");
  const rule = ruleResult.rows[0];
  if (rule.mode !== "manual") throwErr("RULE_NOT_MANUAL");
  if (!rule.enabled) throwErr("RULE_DISABLED");
  if (rule.room_id !== roomId) throwErr("RULE_ROOM_SCOPE_MISMATCH");

  const conditionsMet = await evaluateConditions(client, roomId, rule.conditions ?? {});
  if (!conditionsMet) {
    throwErr("RULE_CONDITIONS_NOT_MET");
  }

  await executeActionsWithClient(client, roomId, rule.actions);
  queueRuleActionEvents(queueEvent, roomId, rule.actions, "manual_rule");

  await client.query(
    `INSERT INTO timeline_logs (room_id, visibility, event_type, message, metadata)
     VALUES ($1, 'host', 'manual_rule_triggered', $2, jsonb_build_object('ruleId', $3::text))`,
    [roomId, `主持人手动触发规则「${rule.name}」`, ruleId]
  );

  return { ok: true, ruleId, ruleName: rule.name };
}

export async function triggerManualRule(roomId, ruleId) {
  return transactionWithEvents((client, queueEvent) => (
    triggerManualRuleWithClient(client, queueEvent, roomId, ruleId)
  ));
}

export async function evaluateRoomRulesWithClient(client, queueEvent, roomId) {
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

    const conditionsMet = await evaluateConditions(client, roomId, rule.conditions ?? {});
    if (!conditionsMet) continue;

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
        queueEvent(roomId, "room.host_event_pending", {
          eventId: inserted.rows[0].id,
          title: inserted.rows[0].title,
          source: "rule"
        });
      }
      continue;
    }

    await executeActionsWithClient(client, roomId, rule.actions);
    queueRuleActionEvents(queueEvent, roomId, rule.actions, "rule");
    await client.query(
      `INSERT INTO rule_executions (rule_id, room_id, result)
       VALUES ($1, $2, '{"status":"executed"}'::jsonb)`,
      [rule.id, roomId]
    );
    executed.push(rule.id);
  }
  return executed;
}

export async function evaluateRoomRules(roomId) {
  return transactionWithEvents((client, queueEvent) => (
    evaluateRoomRulesWithClient(client, queueEvent, roomId)
  ));
}
