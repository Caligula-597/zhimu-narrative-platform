/**
 * P10.2 — StoryExperienceProfile data for COMPLETE STORY templates only.
 * FOUNDATION templates stay EXPERIENCE_PROFILE_INCOMPLETE.
 */

function profile(spec) {
  return Object.freeze({
    status: "READY",
    primaryAxes: Object.freeze([...(spec.primaryAxes || [])]),
    secondaryAxes: Object.freeze([...(spec.secondaryAxes || [])]),
    structuralCommitments: Object.freeze([...(spec.structuralCommitments || [])]),
    interactionModes: Object.freeze([...(spec.interactionModes || [])]),
    experienceMoments: Object.freeze(
      (spec.experienceMoments || []).map((m) => Object.freeze({ ...m })),
    ),
    resolutionPressure: spec.resolutionPressure || "OPEN",
    supportedAnchors: Object.freeze([...(spec.supportedAnchors || [])]),
  });
}

const INCOMPLETE = Object.freeze({
  status: "EXPERIENCE_PROFILE_INCOMPLETE",
  primaryAxes: Object.freeze([]),
  secondaryAxes: Object.freeze([]),
  structuralCommitments: Object.freeze([]),
  interactionModes: Object.freeze([]),
  experienceMoments: Object.freeze([]),
  resolutionPressure: "OPEN",
  supportedAnchors: Object.freeze([]),
});

/** M01 family — crime framing / misdirection. */
const M01_FRAMING = profile({
  primaryAxes: ["DEDUCTION", "MISDIRECTION"],
  secondaryAxes: ["SUSPICION", "ROLEPLAY"],
  structuralCommitments: ["CRIME_FRAMING"],
  interactionModes: ["PROBE", "CONCEAL", "SUSPECT"],
  experienceMoments: [
    { kind: "EARLY_AGENCY", strength: "PARTIAL", note: "culprit prepare only" },
    { kind: "LATE_REINTERPRETATION", strength: "STRONG", playerCaused: false, note: "false-lead → reveal" },
  ],
  resolutionPressure: "CULPRIT_CENTRIC_HIGH",
  supportedAnchors: ["EARLY_AGENCY", "LATE_REINTERPRETATION"],
});

/** M07 — hidden identity. */
const M07_BASE = profile({
  primaryAxes: ["IDENTITY", "SECRECY"],
  secondaryAxes: ["ROLEPLAY", "DEDUCTION", "SUSPICION"],
  structuralCommitments: ["HIDDEN_IDENTITY"],
  interactionModes: ["CONCEAL", "PROBE", "SUSPECT"],
  experienceMoments: [
    { kind: "EARLY_AGENCY", strength: "PARTIAL", note: "bearer conceal / search" },
    { kind: "LATE_REINTERPRETATION", strength: "PARTIAL", note: "identity confirm reframes prior acts" },
  ],
  resolutionPressure: "IDENTITY_REVEAL",
  supportedAnchors: ["EARLY_AGENCY", "LATE_REINTERPRETATION"],
});

const M07_MECH = profile({
  primaryAxes: ["IDENTITY", "MECHANISM"],
  secondaryAxes: ["SECRECY", "DEDUCTION"],
  structuralCommitments: ["HIDDEN_IDENTITY"],
  interactionModes: ["PROBE", "CONCEAL", "SUSPECT"],
  experienceMoments: [
    { kind: "EARLY_AGENCY", strength: "PARTIAL", note: "external trigger / search" },
  ],
  resolutionPressure: "IDENTITY_REVEAL",
  supportedAnchors: ["EARLY_AGENCY"],
});

/** M08 — faction structure first; ROLEPLAY is secondary only. */
const M08_BASE = profile({
  primaryAxes: ["FACTION"],
  secondaryAxes: ["ROLEPLAY", "SUSPICION"],
  structuralCommitments: ["FACTION_STRUCTURE"],
  interactionModes: ["CONCEAL", "SUSPECT", "NEGOTIATE"],
  experienceMoments: [
    { kind: "EARLY_AGENCY", strength: "PARTIAL", note: "faction lead organize" },
    {
      kind: "OWNERSHIP_SHIFT",
      strength: "WEAK",
      playerCaused: false,
      note: "SECURE narrates resource move; not full player exchange loop",
    },
  ],
  resolutionPressure: "FACTION_SETTLE",
  supportedAnchors: ["EARLY_AGENCY"],
});

const M08_NEGOTIATE = profile({
  primaryAxes: ["FACTION"],
  secondaryAxes: ["ROLEPLAY", "SUSPICION"],
  structuralCommitments: ["FACTION_STRUCTURE", "RESOURCE_CONTEST"],
  interactionModes: ["NEGOTIATE", "CONCEAL", "SUSPECT", "PUBLIC_CHOICE"],
  experienceMoments: [
    { kind: "EARLY_AGENCY", strength: "PARTIAL", note: "organize / secure" },
    {
      kind: "OWNERSHIP_SHIFT",
      strength: "PARTIAL",
      playerCaused: true,
      note: "SECURE can be player-caused resource contest inside faction",
    },
  ],
  resolutionPressure: "FACTION_SETTLE",
  supportedAnchors: ["EARLY_AGENCY", "OWNERSHIP_SHIFT"],
});

const M08_MECH = profile({
  primaryAxes: ["FACTION", "MECHANISM"],
  secondaryAxes: ["ROLEPLAY"],
  structuralCommitments: ["FACTION_STRUCTURE"],
  interactionModes: ["PROBE", "CONCEAL", "SUSPECT"],
  experienceMoments: [{ kind: "EARLY_AGENCY", strength: "WEAK" }],
  resolutionPressure: "FACTION_SETTLE",
  supportedAnchors: ["EARLY_AGENCY"],
});

/**
 * COMPLETE templates only. Missing id → INCOMPLETE.
 * Intentionally: no COMPLETE template claims EXCHANGE + RELATIONSHIP_BARGAIN as primary —
 * planner must report coverage gaps instead of inventing fidelity.
 */
export const STORY_EXPERIENCE_PROFILES = Object.freeze({
  "M01-FRAMING": M01_FRAMING,
  "M07-1": M07_BASE,
  "M07-2": M07_MECH,
  "M07-3": M07_BASE,
  "M07-4": M07_BASE,
  "M07-5": M07_MECH,
  "M07-6": M07_BASE,
  "M07-7": M07_BASE,
  "M07-8": M07_BASE,
  "M08-1": M08_BASE,
  "M08-2": M08_BASE,
  "M08-3": M08_BASE,
  "M08-4": M08_BASE,
  "M08-5": M08_BASE,
  "M08-6": M08_NEGOTIATE,
  "M08-7": M08_MECH,
  "M08-8": M08_BASE,
});

export function lookupStoryExperienceProfile(templateId) {
  return STORY_EXPERIENCE_PROFILES[templateId] || INCOMPLETE;
}
