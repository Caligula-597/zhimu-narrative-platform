const CONDITION_TYPES = new Set([
  "reading_completed",
  "clue_owned",
  "investigation_completed",
  "item_owned"
]);

const ACTION_TYPES = new Set([
  "unlock_script_section",
  "unlock_scene",
  "grant_clue",
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

export function validateRuleBody(snapshot, { conditions, actions } = {}) {
  const errors = [];
  const add = (path, message) => errors.push({ path, message });
  const ids = entityIds(snapshot);

  if (!conditions || typeof conditions !== "object") {
    add("conditions", "缺少检测条件结构。");
    return { ok: false, errors };
  }

  if (!Array.isArray(conditions.all)) {
    add("conditions", "第一版仅支持 conditions.all（全部条件同时满足）。请使用可视化编辑，或把条件放入 all 数组。");
    return { ok: false, errors };
  }

  if (!conditions.all.length) {
    add("conditions", "请至少添加一个触发条件。");
  }

  for (const [index, condition] of conditions.all.entries()) {
    const label = `条件 ${index + 1}`;
    const path = `conditions[${index}]`;
    if (!condition?.type) {
      add(path, `${label} 缺少类型，请选择条件类型。`);
      continue;
    }
    if (!CONDITION_TYPES.has(condition.type)) {
      add(path, `${label} 的类型「${condition.type}」不受支持。`);
      continue;
    }
    if (condition.type === "reading_completed") {
      if (!condition.roleSlotId) add(path, `${label} 缺少 roleSlotId，请选择一个角色。`);
      else if (!ids.roles.has(condition.roleSlotId)) add(path, `${label} 的角色不存在，请重新选择。`);
      if (!condition.scriptSectionId) add(path, `${label} 缺少 scriptSectionId，请选择一个分幕。`);
      else if (!ids.sections.has(condition.scriptSectionId)) add(path, `${label} 的分幕不存在，请重新选择。`);
    }
    if (condition.type === "clue_owned") {
      if (!condition.roleSlotId) add(path, `${label} 缺少 roleSlotId，请选择一个角色。`);
      else if (!ids.roles.has(condition.roleSlotId)) add(path, `${label} 的角色不存在，请重新选择。`);
      if (!condition.clueId) add(path, `${label} 缺少 clueId，请选择一个线索。`);
      else if (!ids.clues.has(condition.clueId)) add(path, `${label} 的线索不存在，请重新选择。`);
    }
    if (condition.type === "investigation_completed") {
      if (!condition.investigationPointId) add(path, `${label} 缺少 investigationPointId，请选择一个调查点。`);
      else if (!ids.points.has(condition.investigationPointId)) {
        add(path, `${label} 的调查点不存在，请重新选择。`);
      }
    }
    if (condition.type === "item_owned") {
      if (!condition.roleSlotId) add(path, `${label} 缺少 roleSlotId，请选择一个角色。`);
      else if (!ids.roles.has(condition.roleSlotId)) add(path, `${label} 的角色不存在，请重新选择。`);
      if (!condition.itemId) add(path, `${label} 缺少 itemId，请选择一个物品。`);
      else if (!ids.items.has(condition.itemId)) add(path, `${label} 的物品不存在，请重新选择。`);
    }
  }

  if (!Array.isArray(actions)) {
    add("actions", "执行动作必须是数组。");
    return { ok: false, errors };
  }
  if (!actions.length) {
    add("actions", "请至少添加一个执行动作。");
  }

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
    if (action.type === "timeline_log") {
      if (!String(action.message ?? "").trim()) add(path, `${label} 缺少 message，请填写时间线日志内容。`);
    }
  }

  return { ok: errors.length === 0, errors };
}
