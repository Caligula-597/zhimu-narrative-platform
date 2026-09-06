/**
 * P10.2 — Creation Intent Envelope.
 * Deterministic projection of Spec + author-confirmed experience anchors.
 * Never NLP-parses mustKeep prose; unmapped text → UNRESOLVED_EXPLICIT_INTENT.
 */

import { EXPERIENCE_KEYS, normalizePlayableCreationSpec } from "./playable-creation-spec.js";
import {
  SPEC_EXPERIENCE_TO_AXIS,
  GAMEPLAY_TO_INTERACTION,
  EXPERIENCE_ANCHORS,
} from "./story-experience-constants.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const PRIMARY_WEIGHT = 0.55;
const LOW_WEIGHT = 0.45;

/**
 * @param {object} specInput
 * @param {{
 *   authorConfirmedExperienceAnchors?: Array<{ sourceText?: string, anchor: string }>,
 * }} [opts]
 */
export function buildCreationIntentEnvelope(specInput, opts = {}) {
  const spec = normalizePlayableCreationSpec(specInput);
  if (!spec) return null;

  const experienceWeights = Object.fromEntries(
    EXPERIENCE_KEYS.map((k) => [k, Number(spec.experience?.[k]) || 0]),
  );

  const desiredPrimaryAxes = [];
  const lowInterestAxes = [];
  for (const [key, axis] of Object.entries(SPEC_EXPERIENCE_TO_AXIS)) {
    const w = experienceWeights[key] || 0;
    if (w >= PRIMARY_WEIGHT) desiredPrimaryAxes.push({ axis, weight: w, source: key });
    if (w < LOW_WEIGHT) lowInterestAxes.push({ axis, weight: w, source: key });
  }
  desiredPrimaryAxes.sort((a, b) => b.weight - a.weight);
  const dominantAxis = desiredPrimaryAxes[0]?.axis || null;

  const desiredInteractionModes = [];
  for (const tag of asArray(spec.gameplayPreferences?.preferred)) {
    const mode = GAMEPLAY_TO_INTERACTION[tag];
    if (mode) desiredInteractionModes.push({ mode, sourceGameplay: tag });
  }

  const confirmed = [];
  const invalidAnchors = [];
  for (const row of asArray(opts.authorConfirmedExperienceAnchors)) {
    const anchor = String(row?.anchor || "");
    if (!EXPERIENCE_ANCHORS.includes(anchor)) {
      invalidAnchors.push(row);
      continue;
    }
    confirmed.push({
      anchor,
      sourceText: row.sourceText != null ? String(row.sourceText) : null,
      status: "CONFIRMED",
    });
  }

  const confirmedSet = new Set(confirmed.map((c) => c.anchor));
  const mustKeepTexts = asArray(spec.premise?.mustKeep).map(String);
  const unresolvedExplicitIntents = [];
  for (const text of mustKeepTexts) {
    const mapped = confirmed.some((c) => c.sourceText && c.sourceText === text);
    if (!mapped) {
      unresolvedExplicitIntents.push({
        kind: "UNRESOLVED_EXPLICIT_INTENT",
        text,
        message: "mustKeep 原文尚未映射到 ExperienceAnchor；不得宣称 INTENT_FIDELITY_PASS",
      });
    }
  }

  // avoid items that look like flexible resolution signals stay as text; FLEXIBLE_RESOLUTION is author-confirmed
  const avoidTexts = asArray(spec.premise?.avoid).map(String);

  let fidelityStatus = "READY";
  if (unresolvedExplicitIntents.length || invalidAnchors.length) {
    fidelityStatus = "REVIEW_REQUIRED";
  }

  return {
    version: 1,
    sourceSpecId: spec.id,
    sourceSpecRevision: spec.revision,
    experienceWeights,
    desiredPrimaryAxes,
    lowInterestAxes,
    dominantAxis,
    desiredInteractionModes,
    confirmedAnchors: confirmed,
    unresolvedExplicitIntents,
    avoidTexts,
    fidelityGateHint: fidelityStatus,
    notes: [
      "mustKeep 原文不自动 NLP 映射；须作者确认 ExperienceAnchor",
      "ROLEPLAY 高 ≠ 自动接受 FACTION_STRUCTURE",
    ],
  };
}

export function hasConfirmedAnchor(envelope, anchor) {
  return asArray(envelope?.confirmedAnchors).some((c) => c.anchor === anchor);
}
