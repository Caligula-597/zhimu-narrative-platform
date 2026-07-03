function compareValues(actual, operator, expected) {
  const leftNum = Number(actual);
  const rightNum = Number(expected);
  const numeric = Number.isFinite(leftNum) && Number.isFinite(rightNum);

  if (operator === "eq") {
    return numeric ? leftNum === rightNum : String(actual) === String(expected);
  }
  if (operator === "neq") {
    return numeric ? leftNum !== rightNum : String(actual) !== String(expected);
  }
  if (!numeric) return false;
  if (operator === "gt") return leftNum > rightNum;
  if (operator === "gte") return leftNum >= rightNum;
  if (operator === "lt") return leftNum < rightNum;
  if (operator === "lte") return leftNum <= rightNum;
  return false;
}

async function leafConditionSatisfied(client, roomId, condition) {
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

  if (condition.type === "variable_compare") {
    const result = await client.query(
      `SELECT variables -> $3 AS value
       FROM player_states
       WHERE room_id = $1 AND role_slot_id = $2`,
      [roomId, condition.roleSlotId, condition.key]
    );
    if (!result.rowCount) return false;
    const actual = result.rows[0].value;
    if (actual === null || actual === undefined) return false;
    const unwrapped = typeof actual === "object" && actual !== null && "value" in actual ? actual.value : actual;
    return compareValues(unwrapped, condition.operator, condition.value);
  }

  return false;
}

function describeLeafCondition(condition) {
  if (condition.type === "reading_completed") {
    return "角色读完指定分幕";
  }
  if (condition.type === "clue_owned") {
    return "角色拥有指定线索";
  }
  if (condition.type === "item_owned") {
    return "角色拥有指定物品";
  }
  if (condition.type === "investigation_completed") {
    return "完成指定调查点";
  }
  if (condition.type === "variable_compare") {
    return `变量 ${condition.key || "?"} ${condition.operator || "eq"} ${condition.value ?? "?"}`;
  }
  return condition.type || "未知条件";
}

/** Explain why each leaf passes or fails (P1-05 rule debug trace). */
export async function traceConditions(client, roomId, node) {
  if (!node || typeof node !== "object") {
    return { kind: "empty", satisfied: true, label: "无条件" };
  }

  if (node.not != null) {
    const child = await traceConditions(client, roomId, node.not);
    return {
      kind: "not",
      satisfied: !child.satisfied,
      label: "取反",
      children: [child]
    };
  }

  if (Array.isArray(node.all)) {
    const children = [];
    let satisfied = true;
    for (const child of node.all) {
      const traced = await traceConditions(client, roomId, child);
      children.push(traced);
      if (!traced.satisfied) satisfied = false;
    }
    return {
      kind: "all",
      satisfied,
      label: "全部满足",
      children
    };
  }

  if (Array.isArray(node.any)) {
    const children = [];
    let satisfied = false;
    for (const child of node.any) {
      const traced = await traceConditions(client, roomId, child);
      children.push(traced);
      if (traced.satisfied) satisfied = true;
    }
    if (!node.any.length) {
      return { kind: "any", satisfied: false, label: "任一满足（空列表）", children: [] };
    }
    return {
      kind: "any",
      satisfied,
      label: "任一满足",
      children
    };
  }

  if (node.type) {
    const satisfied = await leafConditionSatisfied(client, roomId, node);
    return {
      kind: "leaf",
      type: node.type,
      satisfied,
      label: describeLeafCondition(node),
      refs: {
        roleSlotId: node.roleSlotId ?? null,
        scriptSectionId: node.scriptSectionId ?? null,
        clueId: node.clueId ?? null,
        itemId: node.itemId ?? null,
        investigationPointId: node.investigationPointId ?? null,
        key: node.key ?? null
      }
    };
  }

  return { kind: "unknown", satisfied: true, label: "未知结构" };
}

/** Flatten trace tree into failed leaf nodes for UI summaries. */
export function collectFailedConditionLeaves(trace, out = []) {
  if (!trace) return out;
  if (trace.kind === "leaf" && !trace.satisfied) {
    out.push(trace);
    return out;
  }
  for (const child of trace.children ?? []) {
    collectFailedConditionLeaves(child, out);
  }
  return out;
}

/** Evaluate nested conditions: leaf, { all }, { any }, { not }. */
export async function evaluateConditions(client, roomId, node) {
  if (!node || typeof node !== "object") return true;

  if (node.not != null) {
    return !(await evaluateConditions(client, roomId, node.not));
  }

  if (Array.isArray(node.all)) {
    for (const child of node.all) {
      if (!(await evaluateConditions(client, roomId, child))) return false;
    }
    return true;
  }

  if (Array.isArray(node.any)) {
    if (!node.any.length) return false;
    for (const child of node.any) {
      if (await evaluateConditions(client, roomId, child)) return true;
    }
    return false;
  }

  if (node.type) {
    return leafConditionSatisfied(client, roomId, node);
  }

  return true;
}

export { compareValues };
