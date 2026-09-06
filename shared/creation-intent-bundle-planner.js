/**
 * P10.2 — Creation Intent Fidelity V1 planner helpers + bundle scoring.
 * Family diversity is tie-breaker only. May recommend 2 blocks.
 */

import { creationMetadataForTemplate } from "./creation-catalog-metadata.js";
import { buildCreationIntentEnvelope, hasConfirmedAnchor } from "./creation-intent-envelope.js";
import {
  getStoryExperienceProfile,
  isExperienceProfileReady,
  unionProfileFields,
} from "./story-experience-profile.js";
import { COMMITMENT_TO_SPEC_KEY, SPEC_EXPERIENCE_TO_AXIS } from "./story-experience-constants.js";
import { EXPERIENCE_KEYS, normalizePlayableCreationSpec } from "./playable-creation-spec.js";
import { buildCreationConstraintEnvelope } from "./creation-constraint-envelope.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function experienceDot(specExp, metaExp) {
  let score = 0;
  let weight = 0;
  for (const k of EXPERIENCE_KEYS) {
    const s = Number(specExp?.[k]) || 0;
    const m = Number(metaExp?.[k]) || 0;
    score += s * m;
    weight += s;
  }
  if (weight <= 0) return 0.15;
  return score / Math.max(weight, 0.01);
}

function softSettingBoost(envelope, meta) {
  const tags = new Set([...(envelope.genreTags || []), ...(envelope.settingTags || [])].map(String));
  const soft = asArray(meta?.softSettingTags);
  if (!soft.length || !tags.size) return 0;
  let hit = 0;
  for (const t of soft) if (tags.has(t)) hit += 1;
  return Math.min(0.15, hit * 0.05);
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function commitmentUnwanted(commitment, intent) {
  const key = COMMITMENT_TO_SPEC_KEY[commitment];
  if (!key) return false;
  const w = Number(intent.experienceWeights?.[key]) || 0;
  return w < 0.45;
}

/**
 * Score one COMPLETE template against Creation Intent (primary/secondary hierarchy).
 * ROLEPLAY as secondary never substitutes for FACTION when faction is low-interest.
 */
export function scoreTemplateAgainstIntent(templateId, familyId, intent, maturity, meta, softBoost) {
  const profile = getStoryExperienceProfile(templateId);
  const warnings = [];
  const reasons = [];
  const mismatchPenalties = [];

  if (profile.status !== "READY") {
    return {
      templateId,
      familyId,
      fidelityScore: 0,
      legacyScore: 0,
      profileStatus: profile.status,
      reasons: ["EXPERIENCE_PROFILE_INCOMPLETE — 不参与 fidelity-complete 推荐"],
      warnings: ["EXPERIENCE_PROFILE_INCOMPLETE"],
      mismatchPenalties: [],
      provides: { primaryAxes: [], secondaryAxes: [], interactionModes: [], commitments: [], anchors: [] },
      eligibleForBundle: false,
    };
  }

  let fidelity = 0.35 + softBoost;

  // Primary axis coverage: user desired primaries hit by template primaries
  const desiredPrimaries = asArray(intent.desiredPrimaryAxes).map((d) => d.axis);
  const tplPrimary = new Set(profile.primaryAxes);
  const tplSecondary = new Set(profile.secondaryAxes);
  let primaryHits = 0;
  for (const axis of desiredPrimaries) {
    if (tplPrimary.has(axis)) {
      primaryHits += 1;
      fidelity += 0.22;
      reasons.push(`主轴命中 ${axis}`);
    } else if (tplSecondary.has(axis)) {
      fidelity += 0.06;
      reasons.push(`次轴提供 ${axis}（非主轴）`);
      // ROLEPLAY-only secondary on FACTION-primary is the RPT1 failure mode
      if (axis === "ROLEPLAY" && tplPrimary.has("FACTION")) {
        const factionW = Number(intent.experienceWeights?.faction) || 0;
        if (factionW < 0.45) {
          fidelity -= 0.28;
          mismatchPenalties.push({
            code: "SECONDARY_ROLEPLAY_ON_FACTION_PRIMARY",
            message: "ROLEPLAY 仅为次轴，主轴是 FACTION；faction 权重低时不应当 ROLEPLAY 优选",
          });
          warnings.push("UNWANTED_STRUCTURAL_COMMITMENT:FACTION_STRUCTURE");
        }
      }
    }
  }
  if (desiredPrimaries.length && primaryHits === 0) {
    fidelity -= 0.12;
    mismatchPenalties.push({
      code: "DOMINANT_AXIS_MISMATCH",
      message: `模板主轴 ${[...tplPrimary].join("/")} 未覆盖用户主意图 ${desiredPrimaries.join("/")}`,
    });
  }

  // Interaction modes
  const desiredModes = asArray(intent.desiredInteractionModes).map((d) => d.mode);
  const tplModes = new Set(profile.interactionModes);
  for (const mode of desiredModes) {
    if (tplModes.has(mode)) {
      fidelity += 0.1;
      reasons.push(`互动模式 ${mode}`);
    }
  }

  // Anchors claimed by template
  const supported = new Set(profile.supportedAnchors);
  for (const row of asArray(intent.confirmedAnchors)) {
    if (supported.has(row.anchor)) {
      fidelity += 0.08;
      reasons.push(`锚点候选 ${row.anchor}`);
    }
  }

  // Unwanted structural commitments
  for (const c of profile.structuralCommitments) {
    if (commitmentUnwanted(c, intent)) {
      fidelity -= 0.25;
      mismatchPenalties.push({
        code: "UNWANTED_STRUCTURAL_COMMITMENT",
        commitment: c,
        message: `引入 ${c}，但用户对应体验权重偏低`,
      });
      warnings.push(`UNWANTED_STRUCTURAL_COMMITMENT:${c}`);
      reasons.push(`同时引入 − ${c}`);
    } else {
      reasons.push(`结构承诺 ${c}`);
    }
  }

  // FLEXIBLE_RESOLUTION vs culprit-centric
  if (
    hasConfirmedAnchor(intent, "FLEXIBLE_RESOLUTION") &&
    profile.resolutionPressure === "CULPRIT_CENTRIC_HIGH"
  ) {
    fidelity -= 0.18;
    mismatchPenalties.push({
      code: "RESOLUTION_MODE_CAPTURE_RISK",
      message: "CULPRIT_CENTRIC_HIGH 与 FLEXIBLE_RESOLUTION 张力；不可静默吞掉",
    });
    warnings.push("RESOLUTION_MODE_CAPTURE_RISK");
  }

  // Legacy soft score (kept for diagnostics)
  const legacyScore = experienceDot(
    Object.fromEntries(EXPERIENCE_KEYS.map((k) => [k, intent.experienceWeights?.[k] || 0])),
    meta.experienceProfile,
  ) + softBoost + (maturity === "COMPLETE" ? 0.2 : -0.05);

  return {
    templateId,
    familyId,
    fidelityScore: round3(Math.max(0, fidelity)),
    legacyScore: round3(legacyScore),
    profileStatus: profile.status,
    reasons,
    warnings,
    mismatchPenalties,
    provides: {
      primaryAxes: [...profile.primaryAxes],
      secondaryAxes: [...profile.secondaryAxes],
      interactionModes: [...profile.interactionModes],
      commitments: [...profile.structuralCommitments],
      anchors: [...profile.supportedAnchors],
      resolutionPressure: profile.resolutionPressure,
    },
    eligibleForBundle: maturity === "COMPLETE" && profile.status === "READY",
  };
}

function combinations(arr, size) {
  if (size === 1) return arr.map((x) => [x]);
  const out = [];
  for (let i = 0; i <= arr.length - size; i += 1) {
    for (const rest of combinations(arr.slice(i + 1), size - 1)) {
      out.push([arr[i], ...rest]);
    }
  }
  return out;
}

function scoreBundle(blockIds, byId, intent) {
  const blocks = blockIds.map((id) => byId.get(id)).filter(Boolean);
  const profiles = blocks.map((b) => getStoryExperienceProfile(b.templateId));
  const primaryUnion = new Set(unionProfileFields(profiles, "primaryAxes"));
  const secondaryUnion = new Set(unionProfileFields(profiles, "secondaryAxes"));
  const modeUnion = new Set(unionProfileFields(profiles, "interactionModes"));
  const commitUnion = new Set(unionProfileFields(profiles, "structuralCommitments"));
  const anchorUnion = new Set(unionProfileFields(profiles, "supportedAnchors"));

  const desiredPrimaries = asArray(intent.desiredPrimaryAxes).map((d) => d.axis);
  const desiredModes = asArray(intent.desiredInteractionModes).map((d) => d.mode);
  const confirmedAnchors = asArray(intent.confirmedAnchors).map((c) => c.anchor);

  let primaryCoverage = 0;
  if (desiredPrimaries.length) {
    let hits = 0;
    for (const a of desiredPrimaries) {
      if (primaryUnion.has(a) || secondaryUnion.has(a)) hits += 1;
    }
    // Prefer primary over secondary: weight primary hits higher in score later
    primaryCoverage = hits / desiredPrimaries.length;
  } else primaryCoverage = 1;

  let primaryStrict = 0;
  if (desiredPrimaries.length) {
    let hits = 0;
    for (const a of desiredPrimaries) if (primaryUnion.has(a)) hits += 1;
    primaryStrict = hits / desiredPrimaries.length;
  } else primaryStrict = 1;

  const interactionCoverage = desiredModes.length
    ? desiredModes.filter((m) => modeUnion.has(m)).length / desiredModes.length
    : 1;

  const anchorStates = confirmedAnchors.map((a) => ({
    anchor: a,
    status: anchorUnion.has(a) ? "COVERED_BY_PROFILE" : "UNCOVERED",
  }));
  const anchorCoverage = confirmedAnchors.length
    ? anchorStates.filter((s) => s.status === "COVERED_BY_PROFILE").length / confirmedAnchors.length
    : 1;

  const introducedCommitments = [...commitUnion];
  const unwanted = introducedCommitments.filter((c) => commitmentUnwanted(c, intent));
  const missingIntents = [];
  for (const a of desiredPrimaries) {
    if (!primaryUnion.has(a) && !secondaryUnion.has(a)) missingIntents.push(a);
  }
  const missingModes = desiredModes.filter((m) => !modeUnion.has(m));

  let fidelityScore =
    0.15 +
    primaryStrict * 0.35 +
    primaryCoverage * 0.1 +
    interactionCoverage * 0.2 +
    anchorCoverage * 0.2;

  fidelityScore -= unwanted.length * 0.22;

  // Dominant axis mismatch: bundle primaries ignore user's top axis
  const dominant = intent.dominantAxis;
  if (dominant && !primaryUnion.has(dominant) && secondaryUnion.has(dominant)) {
    fidelityScore -= 0.12;
  }
  if (dominant && !primaryUnion.has(dominant) && !secondaryUnion.has(dominant)) {
    fidelityScore -= 0.2;
  }

  // Redundant experience: same family twice is not “more complete”
  if (blockIds.length >= 2) {
    const fams = blocks.map((b) => b.familyId);
    if (new Set(fams).size < fams.length) fidelityScore -= 0.2;
  }
  if (blockIds.length === 3) {
    const fams = new Set(blocks.map((b) => b.familyId));
    if (fams.size === 1) fidelityScore -= 0.05;
  }

  // Prefer fewer blocks when fidelity similar — applied at sort via size tie-break after score
  // Resolution capture
  const hasCrime = commitUnion.has("CRIME_FRAMING");
  const hasFlex = hasConfirmedAnchor(intent, "FLEXIBLE_RESOLUTION");
  const pressures = profiles.map((p) => p.resolutionPressure);
  let resolutionWarning = null;
  if (hasCrime && hasFlex && pressures.every((p) => p === "CULPRIT_CENTRIC_HIGH" || p === "IDENTITY_REVEAL" || p === "FACTION_SETTLE")) {
    // M01 alone or M01+others all closing hard → capture risk if crime is sole strong commitment
    if (commitUnion.size <= 2 && hasCrime) {
      fidelityScore -= 0.15;
      resolutionWarning = "RESOLUTION_MODE_CAPTURE";
    }
  }

  const reasons = [
    `主轴严格覆盖 ${round3(primaryStrict)}`,
    `互动覆盖 ${round3(interactionCoverage)}`,
    `锚点覆盖 ${round3(anchorCoverage)}`,
    blockIds.length === 2 ? "2-block bundle（允许）" : `${blockIds.length}-block bundle`,
  ];
  for (const c of introducedCommitments) {
    reasons.push(unwanted.includes(c) ? `引入承诺 − ${c}` : `引入承诺 ${c}`);
  }
  for (const m of missingModes) reasons.push(`缺失互动 ${m}`);

  const warnings = [];
  for (const c of unwanted) warnings.push(`UNWANTED_STRUCTURAL_COMMITMENT:${c}`);
  for (const m of missingModes) warnings.push(`BUNDLE_COVERAGE_GAP:${m}`);
  for (const a of anchorStates.filter((s) => s.status === "UNCOVERED")) {
    warnings.push(`ANCHOR_UNCOVERED:${a.anchor}`);
  }
  if (resolutionWarning) warnings.push(resolutionWarning);
  for (const u of asArray(intent.unresolvedExplicitIntents)) {
    warnings.push("UNRESOLVED_EXPLICIT_INTENT");
  }

  const familyIds = [...new Set(blocks.map((b) => b.familyId))];

  return {
    blockTemplateIds: blockIds,
    familyIds,
    fidelityScore: round3(Math.max(0, fidelityScore)),
    primaryCoverage: round3(primaryCoverage),
    primaryStrictCoverage: round3(primaryStrict),
    interactionCoverage: round3(interactionCoverage),
    anchorCoverage: round3(anchorCoverage),
    anchorStates,
    introducedCommitments,
    unwantedCommitments: unwanted,
    missingIntents,
    missingInteractionModes: missingModes,
    mismatchPenalties: blocks.flatMap((b) => b.mismatchPenalties || []),
    reasons,
    warnings: [...new Set(warnings)],
    familyDiversity: familyIds.length,
  };
}

/**
 * Build P10.2 story plan: individual candidates + fidelity bundles.
 */
export function planCreationIntentStoryBundles(specInput, templates = [], opts = {}) {
  const spec = normalizePlayableCreationSpec(specInput);
  if (!spec) return null;
  const intent = buildCreationIntentEnvelope(spec, {
    authorConfirmedExperienceAnchors: opts.authorConfirmedExperienceAnchors,
  });
  const constraint = buildCreationConstraintEnvelope(spec);

  const scored = [];
  for (const tpl of templates) {
    if (!tpl?.id) continue;
    const meta = creationMetadataForTemplate(tpl.id, tpl.familyId);
    const maturity = tpl.contentMaturity || "FOUNDATION";
    const soft = softSettingBoost(constraint, meta);
    const row = scoreTemplateAgainstIntent(
      tpl.id,
      tpl.familyId || meta.familyId,
      intent,
      maturity,
      meta,
      soft,
    );
    // legacy matchedIntents for UI compatibility — primary-axis aware
    const matchedIntents = [];
    const profile = getStoryExperienceProfile(tpl.id);
    if (profile.status === "READY") {
      for (const axis of profile.primaryAxes) {
        const key = Object.entries(SPEC_EXPERIENCE_TO_AXIS).find(([, a]) => a === axis)?.[0];
        if (key && (intent.experienceWeights?.[key] || 0) >= 0.55) matchedIntents.push(axis);
      }
      for (const axis of profile.secondaryAxes) {
        const key = Object.entries(SPEC_EXPERIENCE_TO_AXIS).find(([, a]) => a === axis)?.[0];
        if (key && (intent.experienceWeights?.[key] || 0) >= 0.55) {
          matchedIntents.push(`${axis}_SECONDARY`);
        }
      }
    }
    scored.push({
      ...row,
      score: row.fidelityScore,
      matchedIntents,
      maturity,
    });
  }

  scored.sort(
    (a, b) =>
      b.fidelityScore - a.fidelityScore ||
      a.templateId.localeCompare(b.templateId),
  );

  // Top fidelity candidates + ensure FACTION-primary templates remain visible for reject reasons
  const top = scored.slice(0, 12);
  const seen = new Set(top.map((c) => c.templateId));
  for (const c of scored) {
    if (seen.has(c.templateId)) continue;
    if (c.provides?.primaryAxes?.includes("FACTION") && c.warnings?.length) {
      top.push(c);
      seen.add(c.templateId);
      if (top.length >= 16) break;
    }
  }
  const candidates = top;
  const pool = scored.filter((c) => c.eligibleForBundle).slice(0, 6);
  const byId = new Map(pool.map((c) => [c.templateId, c]));

  const bundleRows = [];
  for (const size of [2, 3]) {
    if (pool.length < size) continue;
    for (const combo of combinations(pool.map((c) => c.templateId), size)) {
      bundleRows.push(scoreBundle(combo, byId, intent));
    }
  }

  // Sort: fidelity desc; fewer blocks win ties; family diversity only as last tie-breaker
  bundleRows.sort((a, b) => {
    if (Math.abs(a.fidelityScore - b.fidelityScore) > 0.02) return b.fidelityScore - a.fidelityScore;
    if (a.blockTemplateIds.length !== b.blockTemplateIds.length) {
      return a.blockTemplateIds.length - b.blockTemplateIds.length;
    }
    return b.familyDiversity - a.familyDiversity;
  });

  const topBundles = bundleRows.slice(0, 8);
  const best = topBundles[0] || null;

  let recommendationStatus = "OK";
  if (asArray(intent.unresolvedExplicitIntents).length) recommendationStatus = "REVIEW_REQUIRED";
  if (!best) recommendationStatus = "REVIEW_REQUIRED";
  else if (best.fidelityScore < 0.42 || best.unwantedCommitments.length >= 2) {
    recommendationStatus = "REVIEW_REQUIRED";
  } else if (best.missingInteractionModes.length || best.anchorStates.some((s) => s.status === "UNCOVERED")) {
    recommendationStatus = "REVIEW_REQUIRED";
  }

  // RPT1 hard probe: never present M08 as ROLEPLAY-primary pick in reasons
  for (const c of candidates) {
    if (c.provides?.primaryAxes?.includes("FACTION") && (intent.experienceWeights?.faction || 0) < 0.45) {
      if (!c.warnings.includes("NOT_ROLEPLAY_PRIMARY")) {
        c.warnings.push("NOT_ROLEPLAY_PRIMARY");
        c.reasons.push("结论：不以 ROLEPLAY 作为首选理由；阵营线需作者显式接受");
      }
    }
  }

  return {
    sourceSpecRevision: spec.revision,
    intentEnvelope: intent,
    candidates,
    bundles: topBundles,
    recommendedBundle: best,
    recommendationStatus,
    coverageGaps: best
      ? {
          missingInteractionModes: best.missingInteractionModes,
          uncoveredAnchors: best.anchorStates.filter((s) => s.status === "UNCOVERED").map((s) => s.anchor),
          unwantedCommitments: best.unwantedCommitments,
        }
      : { missingInteractionModes: asArray(intent.desiredInteractionModes).map((d) => d.mode), uncoveredAnchors: [], unwantedCommitments: [] },
  };
}

export { isExperienceProfileReady };
