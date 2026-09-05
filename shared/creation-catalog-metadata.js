/**
 * Thin creationMetadata for STORY templates — data only, no family if/else in scorer.
 */

function meta(spec) {
  return Object.freeze({
    intentTags: Object.freeze(spec.intentTags || []),
    experienceProfile: Object.freeze({
      deduction: Number(spec.experienceProfile?.deduction) || 0,
      roleplay: Number(spec.experienceProfile?.roleplay) || 0,
      faction: Number(spec.experienceProfile?.faction) || 0,
      mechanism: Number(spec.experienceProfile?.mechanism) || 0,
      emotional: Number(spec.experienceProfile?.emotional) || 0,
    }),
    softSettingTags: Object.freeze(spec.softSettingTags || []),
    familyId: spec.familyId,
  });
}

const BY_FAMILY = Object.freeze({
  M01: meta({
    familyId: "M01",
    intentTags: ["DEDUCTION", "CRIME", "FALSE_LEAD"],
    experienceProfile: { deduction: 0.9, roleplay: 0.35, faction: 0.05, mechanism: 0.1, emotional: 0.35 },
    softSettingTags: ["MODERN", "CONTEMPORARY", "ANCIENT", "MYSTERY"],
  }),
  M07: meta({
    familyId: "M07",
    intentTags: ["IDENTITY", "DEDUCTION", "ROLEPLAY"],
    experienceProfile: { deduction: 0.65, roleplay: 0.55, faction: 0.1, mechanism: 0.25, emotional: 0.4 },
    softSettingTags: ["SCI_FI", "MODERN", "FANTASY", "ANCIENT"],
  }),
  M08: meta({
    familyId: "M08",
    intentTags: ["FACTION", "ROLEPLAY", "NEGOTIATION"],
    experienceProfile: { deduction: 0.25, roleplay: 0.55, faction: 0.9, mechanism: 0.2, emotional: 0.3 },
    softSettingTags: ["ANCIENT", "SCI_FI", "MODERN", "FANTASY"],
  }),
  M10: meta({
    familyId: "M10",
    intentTags: ["EMOTIONAL", "ROLEPLAY"],
    experienceProfile: { deduction: 0.15, roleplay: 0.7, faction: 0.05, mechanism: 0.05, emotional: 0.85 },
    softSettingTags: ["MODERN", "CONTEMPORARY"],
  }),
});

const BY_TEMPLATE = Object.freeze({
  "M01-FRAMING": BY_FAMILY.M01,
  "M07-2": meta({
    familyId: "M07",
    intentTags: ["IDENTITY", "MECHANISM", "EXTERNAL_TRIGGER"],
    experienceProfile: { deduction: 0.55, roleplay: 0.4, faction: 0.05, mechanism: 0.55, emotional: 0.25 },
    softSettingTags: ["SCI_FI", "MODERN"],
  }),
  "M07-5": meta({
    familyId: "M07",
    intentTags: ["IDENTITY", "MECHANISM", "DEDUCTION"],
    experienceProfile: { deduction: 0.6, roleplay: 0.45, faction: 0.1, mechanism: 0.6, emotional: 0.3 },
    softSettingTags: ["SCI_FI", "FANTASY", "ANCIENT"],
  }),
  "M08-1": BY_FAMILY.M08,
  "M08-2": BY_FAMILY.M08,
  "M08-6": meta({
    familyId: "M08",
    intentTags: ["FACTION", "NEGOTIATION", "ROLEPLAY"],
    experienceProfile: { deduction: 0.2, roleplay: 0.6, faction: 0.75, mechanism: 0.15, emotional: 0.35 },
    softSettingTags: ["ANCIENT", "MODERN"],
  }),
  "M08-7": meta({
    familyId: "M08",
    intentTags: ["FACTION", "TIMED_TASK", "MECHANISM"],
    experienceProfile: { deduction: 0.2, roleplay: 0.4, faction: 0.7, mechanism: 0.55, emotional: 0.2 },
    softSettingTags: ["MODERN", "CONTEMPORARY"],
  }),
});

export function creationMetadataForTemplate(templateId, familyId) {
  if (BY_TEMPLATE[templateId]) return BY_TEMPLATE[templateId];
  const fam = familyId || String(templateId || "").split("-")[0];
  return BY_FAMILY[fam] || meta({ familyId: fam || "UNKNOWN", intentTags: [], experienceProfile: {} });
}

export function attachCreationMetadata(template) {
  if (!template) return template;
  const creationMetadata = creationMetadataForTemplate(template.id, template.familyId);
  return Object.freeze({ ...template, creationMetadata });
}
