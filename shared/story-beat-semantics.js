/**
 * BeatSemantics — Goal / Action / Target / Requires / Produces
 * COMPLETE 模板可进入 Integrator 的戏剧行动语义。
 */

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 400) {
  return String(value ?? "").trim().slice(0, maximum);
}

export const BEAT_INDEPENDENCE = Object.freeze(["DEPENDENT", "SHAREABLE", "INDEPENDENT"]);

export function normalizeStoryFactRef(value = {}) {
  if (typeof value === "string") {
    const id = cleanText(value, 120);
    return id ? { id, kind: id, summary: id } : null;
  }
  const src = record(value);
  const id = cleanText(src.id || src.kind, 120);
  if (!id) return null;
  return {
    id,
    kind: cleanText(src.kind, 80) || id,
    summary: cleanText(src.summary, 200) || id,
  };
}

export function normalizeBeatSemantics(value) {
  if (value == null) return null;
  const src = record(value);
  const independence = BEAT_INDEPENDENCE.includes(src.independence)
    ? src.independence
    : "SHAREABLE";
  const needsDetail = Boolean(src.needsDetail);
  return {
    actorRefs: asArray(src.actorRefs).map(String).filter(Boolean),
    actorLabel: cleanText(src.actorLabel, 80) || undefined,
    goal: cleanText(src.goal, 200) || undefined,
    action: cleanText(src.action, 200) || undefined,
    target: cleanText(src.target, 160) || undefined,
    requires: asArray(src.requires).map(normalizeStoryFactRef).filter(Boolean),
    produces: asArray(src.produces).map(normalizeStoryFactRef).filter(Boolean),
    opposes: asArray(src.opposes).map(normalizeStoryFactRef).filter(Boolean),
    protects: asArray(src.protects).map(normalizeStoryFactRef).filter(Boolean),
    locationHint: cleanText(src.locationHint, 120) || undefined,
    actionKind: cleanText(src.actionKind, 80) || undefined,
    independence,
    needsDetail,
  };
}

/** actor + goal + action 至少具备一组可叙述组合 */
export function beatSemanticsCompleteness(sem) {
  if (!sem) return { ok: false, needsDetail: true, missing: ["semantics"] };
  const missing = [];
  if (!sem.actorRefs?.length) missing.push("actorRefs");
  if (!sem.goal) missing.push("goal");
  if (!sem.action) missing.push("action");
  const ok = missing.length === 0;
  return { ok, needsDetail: !ok || sem.needsDetail, missing };
}

function nameOf(roleBindings, key) {
  return roleBindings?.[key]?.name || roleBindings?.[key]?.id || key;
}

function fill(template, ctx) {
  if (!template) return undefined;
  return String(template).replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);
}

/**
 * 从 template.semanticsBridge + 角色绑定生成某 phase 的 BeatSemantics。
 * bridge 形状见 complete-beat-semantics-data.js
 */
export function resolveBeatSemantics({
  bridge,
  phaseBand = 0,
  roleBindings = {},
  plot = {},
  involvedRoleKeys = [],
  variant = null,
} = {}) {
  if (!bridge) return null;
  const phases = bridge.phases || {};
  const phase = phases[String(phaseBand)] || phases[phaseBand] || phases.default || {};
  const roleGoals = { ...(bridge.roleGoals || {}), ...(variant?.roleGoals || {}) };
  const primaryRole =
    phase.primaryRole ||
    involvedRoleKeys[0] ||
    bridge.defaultActorRole ||
    Object.keys(roleBindings)[0];
  const actorId = roleBindings[primaryRole]?.id;
  const actorName = nameOf(roleBindings, primaryRole);
  const goalFromRole = roleGoals[primaryRole];
  const ctx = {
    actor: actorName,
    culprit: nameOf(roleBindings, "culprit"),
    framed: nameOf(roleBindings, "framedCharacter"),
    bearer: nameOf(roleBindings, "bearer"),
    factionLead: nameOf(roleBindings, "factionLead"),
    member: nameOf(roleBindings, "memberA") || nameOf(roleBindings, "member"),
    evidence: plot.plantedEvidence || plot.decisiveEvidence || plot.target || "关键证物",
    motive: plot.trueMotive || "隐藏动机",
    factionGoal: plot.factionGoal || plot.hiddenGoal || "阵营目标",
    location: phase.locationHint || bridge.defaultLocation || "关键场所",
    target: phase.target || plot.plantedEvidence || plot.hiddenContent || "关键物证",
  };

  const goal = fill(phase.goal || goalFromRole || bridge.defaultGoal, ctx);
  const action = fill(phase.action || bridge.defaultAction, ctx);
  const target = fill(phase.target || bridge.defaultTarget, ctx);
  const locationHint = fill(phase.locationHint || bridge.defaultLocation, ctx);

  const mapFacts = (list) =>
    asArray(list).map((f) => {
      if (typeof f === "string") return normalizeStoryFactRef({ id: f, kind: f, summary: fill(f, ctx) });
      return normalizeStoryFactRef({
        ...f,
        summary: fill(f.summary || f.id, ctx),
      });
    });

  const sem = normalizeBeatSemantics({
    actorRefs: actorId ? [actorId] : [],
    goal,
    action,
    target,
    requires: mapFacts(phase.requires || bridge.requires || []),
    produces: mapFacts(phase.produces || bridge.produces || []),
    opposes: mapFacts(phase.opposes || []),
    protects: mapFacts(phase.protects || []),
    locationHint,
    actionKind: phase.actionKind || bridge.defaultActionKind,
    independence: phase.independence || bridge.defaultIndependence || "SHAREABLE",
    needsDetail: Boolean(phase.needsDetail),
  });

  const check = beatSemanticsCompleteness(sem);
  if (!check.ok) sem.needsDetail = true;
  sem.actorLabel = actorName;
  return sem;
}

/** 用户可见剧情句：Actor 为了 Goal 去做 Action */
export function formatAgencySummary(sem, fallback = "") {
  if (!sem) return fallback;
  if (sem.needsDetail && (!sem.goal || !sem.action)) {
    return `NEEDS_DETAIL：${fallback || "缺角色目标或行动"}`;
  }
  const actor = sem.actorLabel || sem.actorRefs?.[0] || "某人";
  if (sem.goal && sem.action) {
    return `${actor}为了${sem.goal}，${sem.action}${sem.target ? `（目标：${sem.target}）` : ""}`;
  }
  return fallback || sem.action || sem.goal || "NEEDS_DETAIL";
}

export function isInternalCompletionSummary(summary) {
  const s = String(summary || "");
  return /阶段完成|收束。?$|阶段完成。/.test(s) || /机制阶段完成/.test(s);
}
