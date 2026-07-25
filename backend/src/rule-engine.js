import { query } from "./db.js";
import { throwErr } from "./api-errors.js";
import { transaction } from "./db.js";
import { transactionWithEvents } from "./transaction-events.js";
import { grantItemToInventory } from "./inventory-helpers.js";
import { collectFailedConditionLeaves, evaluateConditions, traceConditions } from "./rule-condition-evaluator.js";
import { createRuntimeContentProvider } from "./runtime-content-provider.js";
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

async function loadRuntimeRules(roomId, executor, { modes = null } = {}) {
  const result = await executor(
    `/* FROM automation_rules runtime source */
     SELECT room.id AS runtime_room_id,
            room.world_id,
            room.name AS room_name,
            room.status AS room_status,
            room.release_id,
            world.content_revision AS current_content_revision,
            release.release_number,
            release.label AS release_label,
            release.source_content_revision AS release_source_revision,
            release.snapshot AS release_snapshot,
            release.created_at AS release_created_at,
            rule.id, rule.name, rule.mode, rule.priority, rule.conditions,
            rule.actions, rule.enabled, rule.room_id, rule.created_at,
            EXISTS (
              SELECT 1 FROM rule_executions execution
              WHERE execution.rule_id = rule.id AND execution.room_id = room.id
            ) AS already_executed,
            EXISTS (
              SELECT 1 FROM pending_host_events event
              WHERE event.room_id = room.id AND event.rule_id = rule.id
                AND event.status IN ('pending', 'delayed')
            ) AS pending_host_event
     FROM rooms room
     JOIN worlds world ON world.id = room.world_id
     LEFT JOIN world_releases release ON release.id = room.release_id
     LEFT JOIN automation_rules rule
       ON rule.enabled = true
      AND (
        rule.room_id = room.id
        OR (rule.room_id IS NULL AND rule.world_id = room.world_id)
      )
     WHERE room.id = $1
     ORDER BY rule.priority ASC, rule.created_at ASC`,
    [roomId]
  );
  // Unit consumers historically inject only the authored-rule query. Preserve
  // that seam while production uses the single round-trip room/content query.
  if (!result.rows[0]?.runtime_room_id) {
    const modeSet = modes ? new Set(modes) : null;
    return result.rows.filter((rule) => !modeSet || modeSet.has(rule.mode));
  }
  const record = result.rows[0];
  const provider = createRuntimeContentProvider({
    ...record,
    room_id: record.runtime_room_id
  });
  const modeSet = modes ? new Set(modes) : null;
  if (provider.isFrozen) {
    const statusById = new Map(result.rows.map((row) => [String(row.id), row]));
    return provider.collection("rules")
      .filter((rule) => rule.enabled)
      .filter((rule) => !rule.room_id || String(rule.room_id) === String(roomId))
      .filter((rule) => !modeSet || modeSet.has(rule.mode))
      .map((rule) => ({
        ...rule,
        already_executed: Boolean(statusById.get(String(rule.id))?.already_executed),
        pending_host_event: Boolean(statusById.get(String(rule.id))?.pending_host_event)
      }))
      .sort((left, right) => Number(left.priority) - Number(right.priority));
  }
  return result.rows
    .filter((rule) => rule.id)
    .filter((rule) => !modeSet || modeSet.has(rule.mode));
}

export async function previewRoomRules(roomId, { executor = query } = {}) {
  const authoredRules = await loadRuntimeRules(roomId, executor);
  const rules = authoredRules.map((rule) => ({
    ...rule,
    already_executed: Boolean(rule.already_executed),
    pending_host_event: Boolean(rule.pending_host_event)
  }));

  const dbClient = { query: (...args) => executor(...args) };
  const preview = [];

  for (const rule of rules) {
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
  const rules = await loadRuntimeRules(roomId, client.query.bind(client), { modes: ["manual"] });
  const rule = rules.find((candidate) => String(candidate.id) === String(ruleId));
  if (!rule) throwErr("RULE_NOT_FOUND");
  if (rule.mode !== "manual") throwErr("RULE_NOT_MANUAL");
  if (!rule.enabled) throwErr("RULE_DISABLED");
  if (rule.room_id && String(rule.room_id) !== String(roomId)) throwErr("RULE_ROOM_SCOPE_MISMATCH");

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
  const rules = await loadRuntimeRules(roomId, client.query.bind(client), {
    modes: ["automatic", "host_confirm"]
  });

  const executed = [];
  for (const rule of rules) {
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
