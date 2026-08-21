const CONDITION_OPERATORS = new Set([">=", "<=", ">", "<", "==", "!="]);

function text(value, fallback = "", max = 300) {
  const result = String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  return (result || fallback).slice(0, max);
}

function integer(value, min, max, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.round(Math.max(min, Math.min(max, parsed)))
    : fallback;
}

function cleanId(value, fallback = "item") {
  return text(value, fallback, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function normalizeOverrideLookup(value) {
  const entries = Array.isArray(value)
    ? value.map((item) => [item?.id, item?.value])
    : value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value)
      : [];
  return new Map(entries.map(([id, current]) => [cleanId(id, ""), current]).filter(([id]) => id));
}

export function normalizeTabletopVariables(value, overrides = []) {
  const overrideLookup = normalizeOverrideLookup(overrides);
  const used = new Set();
  return (Array.isArray(value) ? value : []).slice(0, 8).map((source = {}, index) => {
    let id = cleanId(source.id, `variable-${index + 1}`);
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    const min = integer(source.min, -9999, 9998, 0);
    const max = integer(source.max, min + 1, 9999, Math.max(min + 1, 100));
    const authoredValue = integer(source.value, min, max, min);
    return {
      id,
      label: text(source.label ?? source.name, `变量 ${index + 1}`, 40),
      color: /^#[0-9a-f]{6}$/i.test(String(source.color || "")) ? String(source.color) : "#3d8b6d",
      min,
      max,
      value: integer(overrideLookup.get(id), min, max, authoredValue)
    };
  });
}

export function normalizeTabletopEffectMap(value, variables = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const known = Array.isArray(variables) ? new Map(variables.map((variable) => [variable.id, variable])) : null;
  const entries = Object.entries(source).slice(0, 8).map(([rawId, rawDelta]) => {
    const id = cleanId(rawId, "");
    const variable = known?.get(id);
    const span = variable ? Math.max(1, variable.max - variable.min) : 9999;
    return [id, integer(rawDelta, -span, span, 0)];
  }).filter(([id]) => id && (!known || known.has(id)));
  return Object.fromEntries(entries);
}

export function applyTabletopEffects(variables, effects) {
  const normalizedVariables = normalizeTabletopVariables(variables);
  const normalizedEffects = normalizeTabletopEffectMap(effects, normalizedVariables);
  const changes = [];
  const nextVariables = normalizedVariables.map((variable) => {
    const requestedDelta = normalizedEffects[variable.id] || 0;
    const value = integer(variable.value + requestedDelta, variable.min, variable.max, variable.value);
    const delta = value - variable.value;
    if (delta) {
      changes.push({
        id: variable.id,
        label: variable.label,
        previous: variable.value,
        value,
        delta
      });
    }
    return { ...variable, value };
  });
  return { variables: nextVariables, changes };
}

function conditionResult(condition, variable) {
  const threshold = integer(condition.value, variable.min, variable.max, variable.min);
  const current = variable.value;
  const span = Math.max(1, variable.max - variable.min);
  let matched = false;
  let progress = 0;
  if (condition.operator === ">=" || condition.operator === ">") {
    matched = condition.operator === ">" ? current > threshold : current >= threshold;
    progress = matched ? 1 : Math.max(0, Math.min(1, (current - variable.min) / Math.max(1, threshold - variable.min)));
  } else if (condition.operator === "<=" || condition.operator === "<") {
    matched = condition.operator === "<" ? current < threshold : current <= threshold;
    progress = matched ? 1 : Math.max(0, Math.min(1, (variable.max - current) / Math.max(1, variable.max - threshold)));
  } else if (condition.operator === "==") {
    matched = current === threshold;
    progress = matched ? 1 : Math.max(0, Math.min(1, 1 - Math.abs(current - threshold) / span));
  } else {
    matched = current !== threshold;
    progress = matched ? 1 : 0;
  }
  return { current, threshold, matched, progress };
}

export function evaluateTabletopEndingRules(endings, variables) {
  const normalizedVariables = normalizeTabletopVariables(variables);
  const variableLookup = new Map(normalizedVariables.map((variable) => [variable.id, variable]));
  const results = (Array.isArray(endings) ? endings : []).slice(0, 12).map((source = {}, index) => {
    const conditions = (Array.isArray(source.conditions)
      ? source.conditions
      : Array.isArray(source.requirements) ? source.requirements : [])
      .slice(0, 8)
      .map((raw = {}, conditionIndex) => {
        const variableId = cleanId(raw.variableId || raw.key, "");
        const variable = variableLookup.get(variableId);
        if (!variable) return null;
        const operator = CONDITION_OPERATORS.has(raw.operator) ? raw.operator : ">=";
        return {
          id: cleanId(raw.id, `condition-${conditionIndex + 1}`),
          variableId,
          variableLabel: variable.label,
          operator,
          value: integer(raw.value, variable.min, variable.max, variable.min),
          ...conditionResult({ operator, value: raw.value }, variable)
        };
      })
      .filter(Boolean);
    const logic = source.logic === "any" ? "any" : "all";
    const progress = conditions.map((condition) => condition.progress);
    const eligible = conditions.length > 0 && (logic === "any"
      ? conditions.some((condition) => condition.matched)
      : conditions.every((condition) => condition.matched));
    const readiness = conditions.length
      ? logic === "any" ? Math.max(...progress) : progress.reduce((sum, item) => sum + item, 0) / progress.length
      : 0;
    return {
      id: cleanId(source.id, `ending-${index + 1}`),
      name: text(source.name, `结局 ${index + 1}`, 60),
      summary: text(source.summary, "由主持人结合现场发展补充这个结局。", 300),
      tone: ["resolve", "cost", "danger", "neutral"].includes(source.tone) ? source.tone : "neutral",
      priority: integer(source.priority, -99, 99, 0),
      logic,
      index,
      conditions,
      eligible,
      readiness: Math.round(readiness * 100)
    };
  });
  const compare = (a, b) => b.priority - a.priority || b.readiness - a.readiness || a.index - b.index;
  const candidates = results.filter((ending) => ending.eligible).sort(compare);
  const closest = candidates[0] || [...results].sort((a, b) => b.readiness - a.readiness || compare(a, b))[0] || null;
  return { variables: normalizedVariables, results, candidates, closest };
}

export function projectTabletopEnding(ending, publishedAt = "") {
  if (!ending) return null;
  return {
    id: ending.id,
    name: ending.name,
    summary: ending.summary,
    tone: ending.tone,
    publishedAt: text(publishedAt, "", 40)
  };
}
