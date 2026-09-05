/**
 * P9.1 ProjectContextProfile — project-level context bindings.
 * Priority: Explicit Project Binding > Context Preset > Template fallback
 */

import {
  CONTEXT_PRESETS,
  getContextPreset,
  listContextPresets,
} from "./context-preset-data.js";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 160) {
  return String(value ?? "").trim().slice(0, maximum);
}

function cleanId(value) {
  return cleanText(value, 120).replace(/[^a-zA-Z0-9_\-.:]/g, "_");
}

export const CONTEXT_BINDING_KINDS = Object.freeze([
  "LOCATION",
  "OBJECT",
  "RECORD",
  "CREDENTIAL",
  "RESOURCE",
  "TASK",
  "TRIGGER",
  "INSTITUTION",
]);

export function normalizeContextBinding(value = {}, { slotKey = "slot", source = "PRESET" } = {}) {
  const src = record(value);
  const kind = CONTEXT_BINDING_KINDS.includes(src.kind) ? src.kind : "OBJECT";
  const label = cleanText(src.label, 120);
  if (!label && !src.entityId) return null;
  return {
    entityId: cleanId(src.entityId) || `ctx:${slotKey}`,
    kind,
    label: label || cleanText(src.fallbackLabel, 120) || slotKey,
    source: cleanText(src.source, 40) || source,
  };
}

export function normalizeProjectContextProfile(value = {}) {
  const src = record(value);
  const bindingsIn = record(src.bindings);
  const bindings = {};
  for (const [key, raw] of Object.entries(bindingsIn)) {
    const normalized = normalizeContextBinding(raw, {
      slotKey: key,
      source: raw?.source || "PROJECT_EXPLICIT",
    });
    if (normalized) bindings[cleanId(key) || key] = normalized;
  }
  const explicitKeys = asArray(src.explicitBindingKeys).map(String);
  for (const [key, b] of Object.entries(bindings)) {
    if (b.source === "PROJECT_EXPLICIT" && !explicitKeys.includes(key)) explicitKeys.push(key);
  }
  return {
    version: 1,
    revision: Math.max(0, Math.trunc(Number(src.revision) || 0)),
    presetId: cleanId(src.presetId) || null,
    bindings,
    explicitBindingKeys: [...new Set(explicitKeys)],
    updatedAt: src.updatedAt != null ? String(src.updatedAt) : null,
  };
}

/**
 * Score preset against CreationSpec / premise tags (data-driven, no caseId).
 */
export function scoreContextPreset(preset, { settingEra, genreTags = [], premiseEra = "" } = {}) {
  if (!preset) return 0;
  const tags = new Set(
    [...asArray(genreTags), settingEra, premiseEra]
      .filter(Boolean)
      .map((t) => String(t).toUpperCase()),
  );
  const rawTags = [...asArray(genreTags), settingEra, premiseEra].filter(Boolean).map(String);
  let score = 0;
  for (const t of asArray(preset.settingTags)) {
    const tu = String(t).toUpperCase();
    if (tags.has(tu) || rawTags.some((g) => String(g).toUpperCase().includes(tu) || tu.includes(String(g).toUpperCase()))) {
      score += 3;
    }
  }
  for (const t of asArray(preset.genreAffinity)) {
    if (rawTags.some((g) => String(g).includes(t) || t.includes(String(g)))) score += 2;
  }
  return score;
}

export function selectContextPresetId({
  settingEra = null,
  genreTags = [],
  premiseEra = "",
  preferredPresetId = null,
} = {}) {
  if (preferredPresetId && getContextPreset(preferredPresetId)) return preferredPresetId;
  let best = "GENERIC_FANTASY";
  let bestScore = -1;
  for (const preset of listContextPresets()) {
    const s = scoreContextPreset(preset, { settingEra, genreTags, premiseEra });
    if (s > bestScore) {
      bestScore = s;
      best = preset.id;
    }
  }
  return best;
}

/**
 * Build profile: explicit > preset > (template fallback applied later at resolve).
 */
export function buildProjectContextProfile({
  creationSpec = null,
  premise = null,
  explicitBindings = {},
  preferredPresetId = null,
  previous = null,
  now = () => new Date().toISOString(),
} = {}) {
  const spec = record(creationSpec);
  const settingEra = spec.setting?.era || null;
  const genreTags = asArray(spec.genreTags);
  const premiseEra = record(premise).era || "";
  const presetId = selectContextPresetId({
    settingEra,
    genreTags,
    premiseEra,
    preferredPresetId,
  });
  const preset = getContextPreset(presetId) || CONTEXT_PRESETS.GENERIC_FANTASY;
  const bindings = {};
  for (const [key, b] of Object.entries(record(preset.bindings))) {
    bindings[key] = normalizeContextBinding({ ...b, source: "PRESET" }, { slotKey: key, source: "PRESET" });
  }
  const explicitKeys = [];
  for (const [key, raw] of Object.entries(record(explicitBindings))) {
    const label = typeof raw === "string" ? raw : raw?.label;
    if (!label) continue;
    bindings[key] = normalizeContextBinding(
      {
        ...(typeof raw === "object" ? raw : {}),
        label,
        kind: (typeof raw === "object" && raw.kind) || bindings[key]?.kind || "OBJECT",
        entityId: (typeof raw === "object" && raw.entityId) || bindings[key]?.entityId || `ctx:${key}`,
        source: "PROJECT_EXPLICIT",
      },
      { slotKey: key, source: "PROJECT_EXPLICIT" },
    );
    explicitKeys.push(key);
  }
  const prev = previous ? normalizeProjectContextProfile(previous) : null;
  const revision = prev ? prev.revision + 1 : 1;
  return normalizeProjectContextProfile({
    revision,
    presetId: preset.id,
    bindings,
    explicitBindingKeys: explicitKeys,
    updatedAt: typeof now === "function" ? now() : now,
  });
}

/**
 * Resolve slot map for a template: profile binding > slot fallbackLabel.
 */
export function resolveContextBindingsForSlots({
  contextProfile = null,
  contextSlots = {},
} = {}) {
  const profile = contextProfile ? normalizeProjectContextProfile(contextProfile) : null;
  const slots = record(contextSlots);
  const out = {};
  const missingRequired = [];
  for (const [key, slotDef] of Object.entries(slots)) {
    const def = record(slotDef);
    const fromProfile = profile?.bindings?.[key];
    if (fromProfile) {
      out[key] = fromProfile;
      continue;
    }
    const fallback = cleanText(def.fallbackLabel, 120);
    if (!fallback && def.required) {
      missingRequired.push(key);
    }
    out[key] = normalizeContextBinding(
      {
        entityId: `ctx:${key}`,
        kind: def.kind || "OBJECT",
        label: fallback || key,
        source: "TEMPLATE_FALLBACK",
      },
      { slotKey: key, source: "TEMPLATE_FALLBACK" },
    );
  }
  return { bindings: out, missingRequired, profile };
}

export function labelMapFromBindings(bindings = {}) {
  const out = {};
  for (const [key, b] of Object.entries(record(bindings))) {
    if (b?.label) out[key] = b.label;
  }
  return out;
}
