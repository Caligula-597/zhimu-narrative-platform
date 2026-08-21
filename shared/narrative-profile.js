/**
 * Canonical narrative product profile shared by Creator, Host, Player and backend.
 *
 * `worldMode` is a legacy onboarding hint. New code should persist and consume
 * `settings.narrativeProfile`, while keeping `worldMode` in sync until every
 * legacy caller has migrated.
 */

import {
  PRODUCT_DOMAINS,
  PRODUCT_DOMAIN_TYPES,
  normalizeProductDomainType,
  productDomainDefinition
} from "./product-domains/registry.js";

export const NARRATIVE_PROFILE_VERSION = 1;
export const CREATION_TYPES = PRODUCT_DOMAIN_TYPES;
export const RUN_FORMATS = Object.freeze(["single_session", "campaign"]);
export const ROLE_MODES = Object.freeze(["fixed", "player_created", "mixed"]);
export const RULESET_MODES = Object.freeze(["none", "system_neutral", "custom"]);
export const LEGACY_WORLD_MODES = Object.freeze(["scripted", "campaign", "hybrid"]);

export const CREATOR_TERMINOLOGY = Object.freeze(Object.fromEntries(
  Object.entries(PRODUCT_DOMAINS).map(([key, domain]) => [key, domain.terminology])
));

export const NARRATIVE_MODE_PROFILES = PRODUCT_DOMAINS;

const LEGACY_DEFAULTS = Object.freeze({
  scripted: Object.freeze({
    creationType: "murder_mystery",
    runFormat: "single_session",
    roleMode: "fixed"
  }),
  campaign: Object.freeze({
    creationType: "tabletop_rpg",
    runFormat: "campaign",
    roleMode: "mixed"
  }),
  hybrid: Object.freeze({
    creationType: "murder_mystery",
    runFormat: "campaign",
    roleMode: "fixed"
  })
});

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function enumValue(value, allowed, fallback) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function optionalText(value, maxLength = 120) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function normalizeCreationType(value) {
  return normalizeProductDomainType(value);
}

export function normalizeNarrativeProfile(value = {}, options = {}) {
  const source = record(value);
  const legacyMode = enumValue(
    source.worldMode ?? options.legacyWorldMode,
    LEGACY_WORLD_MODES,
    ""
  );
  const legacyDefaults = LEGACY_DEFAULTS[legacyMode] || {};
  const fallbackCreationType = options.fallbackCreationType || legacyDefaults.creationType || "murder_mystery";
  const creationType = enumValue(source.creationType, CREATION_TYPES, normalizeCreationType(fallbackCreationType));
  const modeDefaults = productDomainDefinition(creationType);
  const runFormat = enumValue(
    source.runFormat,
    RUN_FORMATS,
    legacyDefaults.runFormat || modeDefaults.defaultRunFormat
  );
  const roleMode = enumValue(
    source.roleMode,
    ROLE_MODES,
    legacyDefaults.roleMode || modeDefaults.defaultRoleMode
  );
  const rulesetSource = record(source.ruleset);
  const rulesetMode = enumValue(
    rulesetSource.mode,
    RULESET_MODES,
    modeDefaults.defaultRulesetMode
  );

  return {
    version: NARRATIVE_PROFILE_VERSION,
    creationType,
    runFormat,
    roleMode,
    ruleset: {
      mode: rulesetMode,
      key: optionalText(rulesetSource.key, 80),
      diceNotation: optionalText(rulesetSource.diceNotation, 80)
    }
  };
}

export function narrativeProfileFromSettings(settings = {}) {
  const source = record(settings);
  return normalizeNarrativeProfile(source.narrativeProfile, {
    legacyWorldMode: source.worldMode,
    fallbackCreationType: source.creationType
  });
}

/**
 * Resolve a product profile from either a full world snapshot or a lightweight
 * world-list row. List APIs intentionally expose only `creation_type` instead
 * of the complete settings document, so shell routing must not assume settings
 * are always present.
 */
export function narrativeProfileFromWorld(world = {}) {
  const source = record(world);
  const settings = record(source.settings);
  return normalizeNarrativeProfile(settings.narrativeProfile, {
    legacyWorldMode: settings.worldMode,
    fallbackCreationType: source.creation_type ?? source.creationType ?? settings.creationType
  });
}

export function legacyWorldModeForNarrativeProfile(value = {}) {
  const profile = normalizeNarrativeProfile(value);
  if (profile.creationType === "tabletop_rpg") return "campaign";
  if (profile.creationType === "board_game") return "campaign";
  if (profile.runFormat === "campaign") return "hybrid";
  return "scripted";
}

export function normalizeNarrativeSettings(settings = {}) {
  const source = record(settings);
  const narrativeProfile = narrativeProfileFromSettings(source);
  return {
    ...source,
    creationType: narrativeProfile.creationType,
    worldMode: legacyWorldModeForNarrativeProfile(narrativeProfile),
    narrativeProfile
  };
}

export function normalizeNarrativeSettingsPatch(settings = {}) {
  const source = record(settings);
  const hasNarrativeField = ["narrativeProfile", "creationType", "worldMode"]
    .some((key) => Object.hasOwn(source, key));
  return hasNarrativeField ? normalizeNarrativeSettings(source) : { ...source };
}

export function narrativeModeDefinition(value) {
  return NARRATIVE_MODE_PROFILES[normalizeCreationType(value)];
}

export function creatorTerms(value) {
  return CREATOR_TERMINOLOGY[normalizeCreationType(value)];
}
