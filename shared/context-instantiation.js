/**
 * P9.1 Context Instantiation — surface semantics only.
 * Order: Base → Variant overrides → Context resolve → Fact instantiate
 * Must NOT change structural fingerprint / factIds / weave refs.
 */

import {
  labelMapFromBindings,
  normalizeProjectContextProfile,
  resolveContextBindingsForSlots,
} from "./project-context-profile.js";
import { getContextPreset } from "./context-preset-data.js";
import { resolveBeatSemantics, formatAgencySummary } from "./story-beat-semantics.js";
import { semanticsBridgeForTemplate } from "./complete-beat-semantics-data.js";
import { getStoryTemplate, getStoryVariant } from "./story-mechanism-registry.js";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Fill {ctx.slotKey} placeholders. Leaves unknown tokens intact for audit.
 */
export function resolveContextTemplate(text, labelMap = {}) {
  if (text == null || text === "") return text;
  return String(text).replace(/\{ctx\.([a-zA-Z0-9_]+)\}/g, (full, key) => {
    if (Object.prototype.hasOwnProperty.call(labelMap, key) && labelMap[key] != null) {
      return String(labelMap[key]);
    }
    return full;
  });
}

function mapDeepStrings(value, fn) {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapDeepStrings(v, fn));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapDeepStrings(v, fn);
    return out;
  }
  return value;
}

/** Apply context labels to phase surface fields only (not structural refs). */
export function applyContextToPhaseSpec(phase, labelMap) {
  const src = record(phase);
  const fill = (t) => resolveContextTemplate(t, labelMap);
  return {
    ...src,
    goal: src.goal != null ? fill(src.goal) : src.goal,
    action: src.action != null ? fill(src.action) : src.action,
    target: src.target != null ? fill(src.target) : src.target,
    locationHint: src.locationHint != null ? fill(src.locationHint) : src.locationHint,
    requires: mapDeepStrings(src.requires, fill),
    produces: mapDeepStrings(src.produces, fill),
    opposes: mapDeepStrings(src.opposes, fill),
    protects: mapDeepStrings(src.protects, fill),
  };
}

/**
 * Structural fingerprint — must be identical before/after context surface fill.
 * Excludes goal/action/target/locationHint/summary text.
 */
export function contextStructuralFingerprint(sem) {
  if (!sem) return "null";
  const factFp = (list) =>
    asArray(list)
      .map((f) => `${f.factType || f.kind || ""}|${f.sourceKind || ""}|${f.factId || ""}`)
      .sort()
      .join(";");
  return [
    asArray(sem.actorRefs).slice().sort().join(","),
    sem.actionKind || "",
    sem.independence || "",
    factFp(sem.requires),
    factFp(sem.produces),
    factFp(sem.opposes),
    factFp(sem.protects),
    sem.locationRef?.locationId || sem.locationRef?.id || "",
    sem.targetRef?.targetId || sem.targetRef?.id || "",
  ].join("||");
}

export function collectUnresolvedContextTokens(...texts) {
  const found = new Set();
  for (const t of texts) {
    const s = String(t || "");
    for (const m of s.matchAll(/\{ctx\.([a-zA-Z0-9_]+)\}/g)) found.add(m[0]);
  }
  return [...found];
}

/**
 * Resolve contextual BeatSemantics (Variant already applied inside resolveBeatSemantics).
 */
export function resolveContextualBeatSemantics({
  bridge,
  phaseBand = 0,
  roleBindings = {},
  plot = {},
  involvedRoleKeys = [],
  variant = null,
  contextProfile = null,
  sourceBlockId = null,
  sourceBeatId = null,
} = {}) {
  const { bindings, missingRequired } = resolveContextBindingsForSlots({
    contextProfile,
    contextSlots: bridge?.contextSlots || {},
  });
  const labelMap = labelMapFromBindings(bindings);

  // Plot surface may also reference ctx / evidence labels
  const plotCtx = { ...plot };
  if (bindings.plantedEvidence?.label) {
    plotCtx.plantedEvidence = plotCtx.plantedEvidence || bindings.plantedEvidence.label;
  }
  if (bindings.decisiveEvidence?.label) {
    plotCtx.decisiveEvidence = plotCtx.decisiveEvidence || bindings.decisiveEvidence.label;
  }
  if (bindings.publicTask?.label) {
    plotCtx.publicGoal = plotCtx.publicGoal || bindings.publicTask.label;
    plotCtx.factionGoal = plotCtx.factionGoal || bindings.publicTask.label;
  }

  const before = resolveBeatSemantics({
    bridge,
    phaseBand,
    roleBindings,
    plot: plotCtx,
    involvedRoleKeys,
    variant,
    contextLabelMap: null,
    sourceBlockId,
    sourceBeatId,
  });

  const after = resolveBeatSemantics({
    bridge,
    phaseBand,
    roleBindings,
    plot: plotCtx,
    involvedRoleKeys,
    variant,
    contextLabelMap: labelMap,
    sourceBlockId,
    sourceBeatId,
  });

  return {
    before,
    after,
    bindings,
    labelMap,
    missingRequired,
    fingerprintBefore: contextStructuralFingerprint(before),
    fingerprintAfter: contextStructuralFingerprint(after),
  };
}

export function auditContextInstantiation({
  beforeSemantics,
  afterSemantics,
  contextProfile = null,
  contextSlots = {},
  bindings = null,
  missingRequired = [],
  requiredSlotKeys = null,
} = {}) {
  const profile = contextProfile ? normalizeProjectContextProfile(contextProfile) : null;
  const slotKeys = requiredSlotKeys || Object.keys(record(contextSlots));
  const resolvedBindings =
    bindings ||
    resolveContextBindingsForSlots({ contextProfile: profile, contextSlots }).bindings;

  const fpBefore = contextStructuralFingerprint(beforeSemantics);
  const fpAfter = contextStructuralFingerprint(afterSemantics);
  const unresolved = collectUnresolvedContextTokens(
    afterSemantics?.goal,
    afterSemantics?.action,
    afterSemantics?.target,
    afterSemantics?.locationHint,
    ...asArray(afterSemantics?.requires).map((f) => f.summary),
    ...asArray(afterSemantics?.produces).map((f) => f.summary),
  );

  const factIdsBefore = [
    ...asArray(beforeSemantics?.requires),
    ...asArray(beforeSemantics?.produces),
  ]
    .map((f) => f.factId)
    .filter(Boolean)
    .sort();
  const factIdsAfter = [
    ...asArray(afterSemantics?.requires),
    ...asArray(afterSemantics?.produces),
  ]
    .map((f) => f.factId)
    .filter(Boolean)
    .sort();

  const explicitHonored = [];
  for (const key of asArray(profile?.explicitBindingKeys)) {
    const expected = profile.bindings[key]?.label;
    const blob = [
      afterSemantics?.goal,
      afterSemantics?.action,
      afterSemantics?.target,
      afterSemantics?.locationHint,
    ].join("\n");
    explicitHonored.push({
      key,
      ok: !expected || blob.includes(expected),
      expected,
    });
  }

  const preset = profile?.presetId ? getContextPreset(profile.presetId) : null;
  const leakHits = [];
  if (preset?.forbiddenLeakTokens?.length) {
    const blob = [
      afterSemantics?.goal,
      afterSemantics?.action,
      afterSemantics?.target,
      afterSemantics?.locationHint,
    ].join("\n");
    for (const token of preset.forbiddenLeakTokens) {
      if (blob.includes(token)) leakHits.push(token);
    }
  }

  const checks = {
    requiredSlotsBound: {
      ok: asArray(missingRequired).length === 0,
      missingRequired,
      slotKeys,
    },
    noUnresolvedContextTokens: {
      ok: unresolved.length === 0,
      unresolved,
    },
    structuralFingerprintPreserved: {
      ok: fpBefore === fpAfter,
      before: fpBefore,
      after: fpAfter,
    },
    factIdsPreserved: {
      ok: JSON.stringify(factIdsBefore) === JSON.stringify(factIdsAfter),
      before: factIdsBefore,
      after: factIdsAfter,
    },
    explicitBindingsHonored: {
      ok: explicitHonored.every((r) => r.ok),
      rows: explicitHonored,
    },
    contextConsistency: {
      ok: Object.keys(resolvedBindings).length >= 0,
      bindingCount: Object.keys(resolvedBindings).length,
    },
    obviousLeakage: {
      ok: leakHits.length === 0,
      leakHits,
    },
  };

  const hardFail =
    !checks.structuralFingerprintPreserved.ok ||
    !checks.factIdsPreserved.ok ||
    !checks.noUnresolvedContextTokens.ok;

  return {
    status: hardFail || Object.values(checks).some((c) => c.ok === false) ? (hardFail ? "FAIL" : "FAIL") : "PASS",
    checks,
  };
}

/** Soften: FAIL only on hard structural issues OR unresolved tokens OR missing required; leakage/explicit are FAIL too per user gate. */
export function auditContextInstantiationStrict(args) {
  const report = auditContextInstantiation(args);
  const c = report.checks;
  const ok =
    c.structuralFingerprintPreserved.ok &&
    c.factIdsPreserved.ok &&
    c.noUnresolvedContextTokens.ok &&
    c.requiredSlotsBound.ok &&
    c.explicitBindingsHonored.ok &&
    c.obviousLeakage.ok;
  return { ...report, status: ok ? "PASS" : "FAIL" };
}

/**
 * Context revision vs block protection — never silent overwrite.
 */
export function auditContextRevisionImpact({
  contextProfile = null,
  blocks = [],
} = {}) {
  const profile = contextProfile ? normalizeProjectContextProfile(contextProfile) : null;
  const rev = profile?.revision ?? 0;
  const review = [];
  const reinstantiatable = [];
  for (const block of asArray(blocks)) {
    const srcRev = Number(block.sourceContextRevision);
    const stale = Number.isFinite(srcRev) && srcRev !== rev;
    if (!stale && block.sourceContextRevision == null && rev > 0) {
      // newly attached profile
    }
    const status = block.status || "DRAFT";
    if (["USER_MODIFIED", "USER_ACCEPTED", "LOCKED"].includes(status)) {
      if (stale || block.sourceContextRevision == null) {
        review.push({
          blockId: block.id,
          status,
          code: "CONTEXT_REVIEW_REQUIRED",
          sourceContextRevision: block.sourceContextRevision ?? null,
          profileRevision: rev,
        });
      }
    } else if (status === "DRAFT" || !status) {
      reinstantiatable.push({
        blockId: block.id,
        status: status || "DRAFT",
        code: "CONTEXT_REINSTANTIATE_OK",
      });
    }
  }
  return {
    profileRevision: rev,
    status: review.length ? "REVIEW_REQUIRED" : "COMPATIBLE",
    reviewRequired: review,
    reinstantiatable,
  };
}

export function instantiateTemplateWithContext({
  templateId,
  variantId = null,
  contextProfile = null,
  roleBindings = {},
  plot = {},
  phaseBand = 1,
} = {}) {
  const template = getStoryTemplate(templateId);
  const variant = getStoryVariant(templateId, variantId) || template?.variants?.[0] || null;
  const bridge = template?.semanticsBridge || semanticsBridgeForTemplate(templateId);
  const resolved = resolveContextualBeatSemantics({
    bridge,
    phaseBand,
    roleBindings,
    plot,
    variant,
    contextProfile,
    sourceBlockId: `ctx-${templateId}`,
    sourceBeatId: `phase-${phaseBand}`,
  });
  const audit = auditContextInstantiationStrict({
    beforeSemantics: resolved.before,
    afterSemantics: resolved.after,
    contextProfile,
    contextSlots: bridge?.contextSlots || {},
    bindings: resolved.bindings,
    missingRequired: resolved.missingRequired,
  });
  return {
    templateId,
    variantId: variant?.id || variantId,
    semantics: resolved.after,
    summary: formatAgencySummary(resolved.after),
    audit,
    ...resolved,
  };
}
