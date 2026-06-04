const CONDITION_TYPES = new Set([
  "reading_completed",
  "clue_owned",
  "investigation_completed",
  "item_owned",
  "variable_compare"
]);

const VARIABLE_OPERATORS = new Set(["eq", "neq", "gt", "gte", "lt", "lte"]);

const ACTION_TYPES = new Set([
  "unlock_script_section",
  "unlock_scene",
  "grant_clue",
  "grant_item",
  "timeline_log"
]);

function entityIds(snapshot) {
  return {
    roles: new Set((snapshot.roles ?? []).map((item) => item.id)),
    sections: new Set((snapshot.sections ?? []).map((item) => item.id)),
    scenes: new Set((snapshot.scenes ?? []).map((item) => item.id)),
    clues: new Set((snapshot.clues ?? []).map((item) => item.id)),
    points: new Set((snapshot.investigationPoints ?? []).map((item) => item.id)),
    items: new Set((snapshot.items ?? []).map((item) => item.id))
  };
}

function validateLeafCondition(snapshot, condition, path, errors, label) {
  const ids = entityIds(snapshot);
  if (!condition?.type) {
    errors.push({ path, message: `${label} 缺少类型，请选择条件类型。` });
    return;
  }
  if (!CONDITION_TYPES.has(condition.type)) {
    errors.push({ path, message: `${label} 的类型「${condition.type}」不受支持。` });
    return;
  }
  if (condition.type === "reading_completed") {
    if (!condition.roleSlotId) errors.push({ path, message: `${label} 缺少 roleSlotId，请选择一个角色。` });
    else if (!ids.roles.has(condition.roleSlotId)) errors.push({ path, message: `${label} 的角色不存在，请重新选择。` });
    if (!condition.scriptSectionId) errors.push({ path, message: `${label} 缺少 scriptSectionId，请选择一个分幕。` });
    else if (!ids.sections.has(condition.scriptSectionId)) errors.push({ path, message: `${label} 的分幕不存在，请重新选择。` });
  }
  if (condition.type === "clue_owned") {
    if (!condition.roleSlotId) errors.push({ path, message: `${label} 缺少 roleSlotId，请选择一个角色。` });
    else if (!ids.roles.has(condition.roleSlotId)) errors.push({ path, message: `${label} 的角色不存在，请重新选择。` });
    if (!condition.clueId) errors.push({ path, message: `${label} 缺少 clueId，请选择一个线索。` });
    else if (!ids.clues.has(condition.clueId)) errors.push({ path, message: `${label} 的线索不存在，请重新选择。` });
  }
  if (condition.type === "investigation_completed") {
    if (!condition.investigationPointId) errors.push({ path, message: `${label} 缺少 investigationPointId，请选择一个调查点。` });
    else if (!ids.points.has(condition.investigationPointId)) {
      errors.push({ path, message: `${label} 的调查点不存在，请重新选择。` });
    }
  }
  if (condition.type === "item_owned") {
    if (!condition.roleSlotId) errors.push({ path, message: `${label} 缺少 roleSlotId，请选择一个角色。` });
    else if (!ids.roles.has(condition.roleSlotId)) errors.push({ path, message: `${label} 的角色不存在，请重新选择。` });
    if (!condition.itemId) errors.push({ path, message: `${label} 缺少 itemId，请选择一个物品。` });
    else if (!ids.items.has(condition.itemId)) errors.push({ path, message: `${label} 的物品不存在，请重新选择。` });
  }
  if (condition.type === "variable_compare") {
    if (!condition.roleSlotId) errors.push({ path, message: `${label} 缺少 roleSlotId，请选择一个角色。` });
    else if (!ids.roles.has(condition.roleSlotId)) errors.push({ path, message: `${label} 的角色不存在，请重新选择。` });
    if (!String(condition.key ?? "").trim()) errors.push({ path, message: `${label} 缺少 key，请填写变量名。` });
    if (!VARIABLE_OPERATORS.has(condition.operator)) {
      errors.push({ path, message: `${label} 的 operator 无效，请使用 eq/neq/gt/gte/lt/lte。` });
    }
    if (condition.value === undefined || condition.value === null) {
      errors.push({ path, message: `${label} 缺少 value，请填写比较值。` });
    }
  }
}

function validateConditionsNode(snapshot, node, path, errors, label = "条件") {
  if (!node || typeof node !== "object") {
    errors.push({ path, message: `${label} 结构无效。` });
    return;
  }

  const hasAll = Array.isArray(node.all);
  const hasAny = Array.isArray(node.any);
  const hasNot = node.not != null;
  const hasType = Boolean(node.type);
  const shapeCount = [hasAll, hasAny, hasNot, hasType].filter(Boolean).length;

  if (shapeCount !== 1) {
    errors.push({
      path,
      message: `${label} 必须是单一 leaf（type）、all、any 或 not 组合，不可混用。`
    });
    return;
  }

  if (hasType) {
    validateLeafCondition(snapshot, node, path, errors, label);
    return;
  }

  if (hasNot) {
    validateConditionsNode(snapshot, node.not, `${path}.not`, errors, `${label}（not）`);
    return;
  }

  if (hasAll) {
    if (!node.all.length) {
      errors.push({ path, message: `${label}.all 至少需要一项子条件。` });
      return;
    }
    for (const [index, child] of node.all.entries()) {
      validateConditionsNode(snapshot, child, `${path}.all[${index}]`, errors, `${label} ${index + 1}`);
    }
    return;
  }

  if (hasAny) {
    if (!node.any.length) {
      errors.push({ path, message: `${label}.any 至少需要一项子条件。` });
      return;
    }
    for (const [index, child] of node.any.entries()) {
      validateConditionsNode(snapshot, child, `${path}.any[${index}]`, errors, `${label} ${index + 1}`);
    }
  }
}

export function validateRuleBody(snapshot, { conditions, actions } = {}) {
  const errors = [];
  const add = (path, message) => errors.push({ path, message });

  if (!conditions || typeof conditions !== "object") {
    add("conditions", "缺少检测条件结构。");
    return { ok: false, errors };
  }

  validateConditionsNode(snapshot, conditions, "conditions", errors);

  if (!Array.isArray(actions)) {
    add("actions", "执行动作必须是数组。");
    return { ok: false, errors };
  }
  if (!actions.length) {
    add("actions", "请至少添加一个执行动作。");
  }

  const ids = entityIds(snapshot);

  for (const [index, action] of actions.entries()) {
    const label = `动作 ${index + 1}`;
    const path = `actions[${index}]`;
    if (!action?.type) {
      add(path, `${label} 缺少类型，请选择动作类型。`);
      continue;
    }
    if (!ACTION_TYPES.has(action.type)) {
      add(path, `${label} 的类型「${action.type}」不受支持。`);
      continue;
    }
    if (action.type === "unlock_script_section") {
      if (!action.scriptSectionId) add(path, `${label} 缺少 scriptSectionId，请选择一个分幕。`);
      else if (!ids.sections.has(action.scriptSectionId)) add(path, `${label} 的分幕不存在，请重新选择。`);
    }
    if (action.type === "unlock_scene") {
      if (!action.sceneId) add(path, `${label} 缺少 sceneId，请选择一个场景。`);
      else if (!ids.scenes.has(action.sceneId)) add(path, `${label} 的场景不存在，请重新选择。`);
    }
    if (action.type === "grant_clue") {
      if (!action.roleSlotId) add(path, `${label} 缺少 roleSlotId，请选择一个角色。`);
      else if (!ids.roles.has(action.roleSlotId)) add(path, `${label} 的角色不存在，请重新选择。`);
      if (!action.clueId) add(path, `${label} 缺少 clueId，请选择一个线索。`);
      else if (!ids.clues.has(action.clueId)) add(path, `${label} 的线索不存在，请重新选择。`);
    }
    if (action.type === "grant_item") {
      if (!action.roleSlotId) add(path, `${label} 缺少 roleSlotId，请选择一个角色。`);
      else if (!ids.roles.has(action.roleSlotId)) add(path, `${label} 的角色不存在，请重新选择。`);
      if (!action.itemId) add(path, `${label} 缺少 itemId，请选择一个物品。`);
      else if (!ids.items.has(action.itemId)) add(path, `${label} 的物品不存在，请重新选择。`);
    }
    if (action.type === "timeline_log") {
      if (!String(action.message ?? "").trim()) add(path, `${label} 缺少 message，请填写时间线日志内容。`);
    }
  }

  return { ok: errors.length === 0, errors };
}
