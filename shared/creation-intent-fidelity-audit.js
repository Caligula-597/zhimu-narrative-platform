/**
 * P10.2 — Creation Intent Fidelity Audit (read-only).
 * Does not mutate blocks, variants, PMD, or Writer.
 */

import { buildCreationIntentEnvelope, hasConfirmedAnchor } from "./creation-intent-envelope.js";
import {
  getStoryExperienceProfile,
  unionProfileFields,
  STRONG_AGENCY_ACTION_KINDS,
  WEAK_AGENCY_ACTION_KINDS,
} from "./story-experience-profile.js";
import { COMMITMENT_TO_SPEC_KEY } from "./story-experience-constants.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function commitmentUnwanted(commitment, intent) {
  const key = COMMITMENT_TO_SPEC_KEY[commitment];
  if (!key) return false;
  return (Number(intent.experienceWeights?.[key]) || 0) < 0.45;
}

/**
 * Early agency from Complete Beat / role bindings — not template marketing copy.
 * Strong agency = actor role has phase-band actionKind in STRONG set for act1-ish phases.
 */
export function computeEarlyAgencyRoleCoverage({ acceptedBlocks, roleAssignments, playerRoleIds }) {
  const players = asArray(playerRoleIds).length
    ? asArray(playerRoleIds)
    : [...new Set(asArray(roleAssignments).map((r) => r.characterId || r.roleId).filter(Boolean))];

  const agencyByRole = new Map(players.map((id) => [id, { strong: false, weak: false, actions: [] }]));

  for (const block of asArray(acceptedBlocks)) {
    const bindings = record(block.roleBindings || block.boundRoles);
    const phases = record(block.completeBeat?.phases || block.semantics?.phases);
    // Prefer phase keys that look early: p0 / setup / prepare / act1
    const earlyKeys = Object.keys(phases).filter((k) =>
      /^(p0|phase0|setup|prepare|act1|opening)/i.test(k) || k === "0",
    );
    const keys = earlyKeys.length ? earlyKeys : Object.keys(phases).slice(0, 1);

    for (const pk of keys) {
      const phase = record(phases[pk]);
      const actionKind = String(phase.actionKind || "");
      const primaryRole = phase.primaryRole;
      const bound = primaryRole ? bindings[primaryRole] || bindings[String(primaryRole)] : null;
      const charId = bound?.characterId || bound?.id || (typeof bound === "string" ? bound : null);
      if (!charId || !agencyByRole.has(charId)) continue;
      const row = agencyByRole.get(charId);
      row.actions.push({ blockId: block.id || block.templateId, actionKind, primaryRole });
      if (STRONG_AGENCY_ACTION_KINDS.includes(actionKind)) row.strong = true;
      else if (WEAK_AGENCY_ACTION_KINDS.includes(actionKind)) row.weak = true;
      else if (actionKind) row.weak = true;
    }
  }

  const strongCount = [...agencyByRole.values()].filter((r) => r.strong).length;
  const total = players.length || 1;
  return {
    totalPlayerRoles: total,
    strongAgencyRoles: strongCount,
    ratio: strongCount / total,
    meetsRpt1Bar: total > 0 && strongCount / total >= 5 / 6,
    byRole: Object.fromEntries(agencyByRole),
  };
}

function ownershipShiftFromProfiles(profiles) {
  const moments = [];
  for (const p of profiles) {
    for (const m of asArray(p.experienceMoments)) {
      if (m.kind === "OWNERSHIP_SHIFT") moments.push(m);
    }
  }
  const playerCaused = moments.some((m) => m.playerCaused === true && m.strength !== "WEAK");
  const narratedOnly = moments.length > 0 && !playerCaused;
  return {
    declared: moments.length > 0,
    playerCaused,
    narratedOnly,
    moments,
    status: playerCaused ? "PLAYER_CAUSED" : narratedOnly ? "NARRATION_ONLY" : "ABSENT",
  };
}

function reinterpretationFromProfiles(profiles) {
  const moments = [];
  for (const p of profiles) {
    for (const m of asArray(p.experienceMoments)) {
      if (m.kind === "LATE_REINTERPRETATION") moments.push(m);
    }
  }
  // Must reframe prior fact — STRONG/PARTIAL with explicit note counts; mere "later reveal" WEAK does not
  const ok = moments.some((m) => m.strength === "STRONG" || m.strength === "PARTIAL");
  return {
    declared: moments.length > 0,
    status: ok ? "REFRAMES_PRIOR" : moments.length ? "REVEAL_ONLY" : "ABSENT",
    moments,
  };
}

/**
 * @param {{
 *   creationSpec: object,
 *   authorConfirmedExperienceAnchors?: object[],
 *   acceptedBlocks: object[],
 *   roleAssignments?: object[],
 *   playerRoleIds?: string[],
 * }} input
 */
export function auditCreationIntentFidelity(input) {
  const intent = buildCreationIntentEnvelope(input.creationSpec, {
    authorConfirmedExperienceAnchors: input.authorConfirmedExperienceAnchors,
  });
  if (!intent) {
    return { status: "BLOCKED", message: "invalid_creation_spec" };
  }

  const blocks = asArray(input.acceptedBlocks);
  const templateIds = blocks.map((b) => b.templateId).filter(Boolean);
  const profiles = templateIds.map((id) => getStoryExperienceProfile(id));

  const primaryUnion = new Set(unionProfileFields(profiles, "primaryAxes"));
  const secondaryUnion = new Set(unionProfileFields(profiles, "secondaryAxes"));
  const modeUnion = new Set(unionProfileFields(profiles, "interactionModes"));
  const commitUnion = [...new Set(unionProfileFields(profiles, "structuralCommitments"))];

  const desiredPrimaries = asArray(intent.desiredPrimaryAxes).map((d) => d.axis);
  const desiredModes = asArray(intent.desiredInteractionModes).map((d) => d.mode);

  const primaryIntentCoverage = {
    desired: desiredPrimaries,
    coveredPrimary: desiredPrimaries.filter((a) => primaryUnion.has(a)),
    coveredSecondaryOnly: desiredPrimaries.filter((a) => !primaryUnion.has(a) && secondaryUnion.has(a)),
    missing: desiredPrimaries.filter((a) => !primaryUnion.has(a) && !secondaryUnion.has(a)),
  };

  const interactionCoverage = {
    desired: desiredModes,
    covered: desiredModes.filter((m) => modeUnion.has(m)),
    missing: desiredModes.filter((m) => !modeUnion.has(m)),
  };

  const unwantedCommitments = commitUnion.filter((c) => commitmentUnwanted(c, intent));
  const earlyAgency = computeEarlyAgencyRoleCoverage({
    acceptedBlocks: blocks,
    roleAssignments: input.roleAssignments,
    playerRoleIds: input.playerRoleIds,
  });
  const ownership = ownershipShiftFromProfiles(profiles);
  const reinterpretation = reinterpretationFromProfiles(profiles);

  const anchorCoverage = asArray(intent.confirmedAnchors).map((row) => {
    if (row.anchor === "EARLY_AGENCY") {
      return {
        anchor: row.anchor,
        status: earlyAgency.meetsRpt1Bar ? "PASS" : "FAIL",
        detail: earlyAgency,
      };
    }
    if (row.anchor === "OWNERSHIP_SHIFT") {
      return {
        anchor: row.anchor,
        status: ownership.status === "PLAYER_CAUSED" ? "PASS" : "FAIL",
        detail: ownership,
      };
    }
    if (row.anchor === "LATE_REINTERPRETATION") {
      return {
        anchor: row.anchor,
        status: reinterpretation.status === "REFRAMES_PRIOR" ? "PASS" : "FAIL",
        detail: reinterpretation,
      };
    }
    if (row.anchor === "FLEXIBLE_RESOLUTION") {
      const captured =
        commitUnion.includes("CRIME_FRAMING") &&
        profiles.every((p) => p.resolutionPressure === "CULPRIT_CENTRIC_HIGH") &&
        templateIds.length >= 1 &&
        templateIds.every((id) => id.startsWith("M01"));
      const risk =
        commitUnion.includes("CRIME_FRAMING") &&
        profiles.some((p) => p.resolutionPressure === "CULPRIT_CENTRIC_HIGH") &&
        unwantedCommitments.length + (interactionCoverage.missing.length > 0 ? 1 : 0) >= 0;
      return {
        anchor: row.anchor,
        status: captured ? "FAIL" : "REVIEW",
        code: risk ? "RESOLUTION_MODE_CAPTURE" : null,
        detail: { commitments: commitUnion, pressures: profiles.map((p) => p.resolutionPressure) },
      };
    }
    return { anchor: row.anchor, status: "UNKNOWN" };
  });

  const missingIntents = [
    ...primaryIntentCoverage.missing,
    ...interactionCoverage.missing.map((m) => `INTERACTION:${m}`),
  ];

  let status = "PASS";
  if (asArray(intent.unresolvedExplicitIntents).length) status = "REVIEW_REQUIRED";
  if (unwantedCommitments.length) status = "REVIEW_REQUIRED";
  if (interactionCoverage.missing.length) status = "REVIEW_REQUIRED";
  if (anchorCoverage.some((a) => a.status === "FAIL")) status = "REVIEW_REQUIRED";
  if (hasConfirmedAnchor(intent, "EARLY_AGENCY") && !earlyAgency.meetsRpt1Bar) {
    status = "REVIEW_REQUIRED";
  }
  // Secondary ROLEPLAY used to justify FACTION when faction low
  if (
    (Number(intent.experienceWeights?.faction) || 0) < 0.45 &&
    commitUnion.includes("FACTION_STRUCTURE") &&
    primaryIntentCoverage.coveredSecondaryOnly.includes("ROLEPLAY") &&
    !primaryIntentCoverage.coveredPrimary.includes("ROLEPLAY")
  ) {
    status = "REVIEW_REQUIRED";
  }

  return {
    version: 1,
    status,
    readOnly: true,
    templateIds,
    primaryIntentCoverage,
    interactionCoverage,
    anchorCoverage,
    structuralCommitments: commitUnion,
    unwantedCommitments,
    missingIntents,
    earlyAgency,
    ownershipShift: ownership,
    lateReinterpretation: reinterpretation,
    unresolvedExplicitIntents: intent.unresolvedExplicitIntents,
    notes: [
      "audit 只读：不改 block / variant / Writer",
      "OWNERSHIP_SHIFT 旁白不算；须 playerCaused",
      "LATE_REINTERPRETATION 须 reframes prior，而非仅后知",
    ],
  };
}
