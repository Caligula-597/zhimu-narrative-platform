/**
 * BeatSemantics — Goal / Action / Target / Requires / Produces
 * COMPLETE 模板可进入 Integrator 的戏剧行动语义。
 * P8.0.2: requires/produces 使用 scoped SemanticFactRef（type ≠ instance）.
 */

import {
  instantiateFactList,
  normalizeLocationRef,
  normalizeSemanticFactRef,
  normalizeTargetRef,
} from "./semantic-fact.js";

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

/** @deprecated prefer normalizeSemanticFactRef — kept as alias */
export function normalizeStoryFactRef(value = {}, context = {}) {
  return normalizeSemanticFactRef(value, context);
}

export function normalizeBeatSemantics(value, context = {}) {
  if (value == null) return null;
  const src = record(value);
  const independence = BEAT_INDEPENDENCE.includes(src.independence)
    ? src.independence
    : "SHAREABLE";
  const needsDetail = Boolean(src.needsDetail);
  const actorRefs = asArray(src.actorRefs).map(String).filter(Boolean);
  const factCtx = {
    sourceBlockId: context.sourceBlockId,
    sourceBeatId: context.sourceBeatId,
    characterIds: context.characterIds?.length ? context.characterIds : actorRefs,
    ...context,
  };
  return {
    actorRefs,
    actorLabel: cleanText(src.actorLabel, 80) || undefined,
    goal: cleanText(src.goal, 200) || undefined,
    action: cleanText(src.action, 200) || undefined,
    /** Display-only target label — not INTERWOVEN evidence */
    target: cleanText(src.target, 160) || undefined,
    targetRef: normalizeTargetRef(src.targetRef, factCtx) || undefined,
    requires: instantiateFactList(src.requires, factCtx),
    produces: instantiateFactList(src.produces, factCtx),
    opposes: instantiateFactList(src.opposes, factCtx),
    protects: instantiateFactList(src.protects, factCtx),
    locationHint: cleanText(src.locationHint, 120) || undefined,
    locationRef: normalizeLocationRef(src.locationRef, factCtx) || undefined,
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
  sourceBlockId = null,
  sourceBeatId = null,
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

  const factCtx = {
    sourceBlockId,
    sourceBeatId: sourceBeatId || `phase-${phaseBand}`,
    characterIds: actorId ? [actorId] : [],
  };

  const mapFacts = (list) =>
    asArray(list).map((f) => {
      if (typeof f === "string") {
        return normalizeSemanticFactRef(
          { factType: f, kind: f, summary: fill(f, ctx) },
          factCtx,
        );
      }
      return normalizeSemanticFactRef(
        {
          ...f,
          factType: f.factType || f.kind || f.id,
          summary: fill(f.summary || f.id || f.factType, ctx),
        },
        factCtx,
      );
    });

  const sem = normalizeBeatSemantics(
    {
      actorRefs: actorId ? [actorId] : [],
      goal,
      action,
      target,
      requires: mapFacts(phase.requires || bridge.requires || []),
      produces: mapFacts(phase.produces || bridge.produces || []),
      opposes: mapFacts(phase.opposes || []),
      protects: mapFacts(phase.protects || []),
      locationHint,
      locationRef: phase.locationRef || bridge.locationRef || null,
      targetRef: phase.targetRef || null,
      actionKind: phase.actionKind || bridge.defaultActionKind,
      independence: phase.independence || bridge.defaultIndependence || "SHAREABLE",
      needsDetail: Boolean(phase.needsDetail),
    },
    factCtx,
  );

  const check = beatSemanticsCompleteness(sem);
  if (!check.ok) sem.needsDetail = true;
  sem.actorLabel = actorName;
  return sem;
}

/** Re-instantiate facts on already-built semantics (outline flatten safety). */
export function ensureScopedBeatSemantics(sem, { sourceBlockId, sourceBeatId, characterIds } = {}) {
  if (!sem) return null;
  return normalizeBeatSemantics(sem, { sourceBlockId, sourceBeatId, characterIds });
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
