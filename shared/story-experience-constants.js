/**
 * P10.2 — StoryExperienceProfile closed sets (data contract only).
 * Not a runtime contract; declares what selecting a STORY commits to.
 */

export const EXPERIENCE_AXES = Object.freeze([
  "DEDUCTION",
  "MISDIRECTION",
  "IDENTITY",
  "SECRECY",
  "FACTION",
  "ROLEPLAY",
  "MECHANISM",
  "EMOTIONAL",
  "SUSPICION",
]);

export const STRUCTURAL_COMMITMENTS = Object.freeze([
  "CRIME_FRAMING",
  "HIDDEN_IDENTITY",
  "FACTION_STRUCTURE",
  "PUBLIC_ACCUSATION",
  "RESOURCE_CONTEST",
  "RELATIONSHIP_BARGAIN",
]);

export const INTERACTION_MODES = Object.freeze([
  "PROBE",
  "CONCEAL",
  "NEGOTIATE",
  "EXCHANGE",
  "SUSPECT",
  "PUBLIC_CHOICE",
]);

export const EXPERIENCE_ANCHORS = Object.freeze([
  "EARLY_AGENCY",
  "OWNERSHIP_SHIFT",
  "LATE_REINTERPRETATION",
  "FLEXIBLE_RESOLUTION",
]);

export const RESOLUTION_PRESSURES = Object.freeze([
  "OPEN",
  "CULPRIT_CENTRIC_HIGH",
  "IDENTITY_REVEAL",
  "FACTION_SETTLE",
]);

/** Spec experience key → ExperienceAxis (primary mapping). */
export const SPEC_EXPERIENCE_TO_AXIS = Object.freeze({
  deduction: "DEDUCTION",
  roleplay: "ROLEPLAY",
  faction: "FACTION",
  mechanism: "MECHANISM",
  emotional: "EMOTIONAL",
});

/** Spec gameplay preference → InteractionMode. */
export const GAMEPLAY_TO_INTERACTION = Object.freeze({
  NEGOTIATION: "NEGOTIATE",
  TRANSFER: "EXCHANGE",
  RESOURCE_COMPETITION: "EXCHANGE",
  BIDDING: "EXCHANGE",
  SEALED_CHOICE: "PUBLIC_CHOICE",
  VOTING: "PUBLIC_CHOICE",
  TIMED_TASK: "PROBE",
});

/** Structural commitment ↔ Spec experience key for “do you want this?”. */
export const COMMITMENT_TO_SPEC_KEY = Object.freeze({
  CRIME_FRAMING: "deduction",
  HIDDEN_IDENTITY: "roleplay",
  FACTION_STRUCTURE: "faction",
  PUBLIC_ACCUSATION: "deduction",
  RESOURCE_CONTEST: "mechanism",
  RELATIONSHIP_BARGAIN: "roleplay",
});

export const WEAK_AGENCY_ACTION_KINDS = Object.freeze([
  "MISREAD",
  "CONSEQUENCE",
  "SETTLE",
  "RECEIVE",
]);

export const STRONG_AGENCY_ACTION_KINDS = Object.freeze([
  "PREPARE",
  "COMMIT",
  "ORGANIZE",
  "SECURE",
  "CONCEAL",
  "PROBE",
  "SEARCH",
  "CONFIRM",
  "REVEAL",
  "SHIFT",
]);
