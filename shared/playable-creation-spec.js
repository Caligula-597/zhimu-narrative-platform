/**
 * P8.1 PlayableCreationSpec V1 — user intent contract (not a production pipeline).
 * No LLM. No auto STORY accept. No Runtime coupling.
 */

export const PLAYABLE_CREATION_SPEC_VERSION = 1;

export const SUPPORTED_PLAYER_COUNTS = Object.freeze([5, 6, 7, 8]);
export const SUPPORTED_STAGE_COUNTS = Object.freeze([3, 4, 5]);

export const GENDER_POLICIES = Object.freeze(["ANY", "FIXED_COUNTS", "AUTHOR_DEFINED"]);
export const SLOT_GENDERS = Object.freeze(["MALE", "FEMALE", "ANY"]);

export const SETTING_ERAS = Object.freeze([
  "MODERN",
  "ANCIENT",
  "CONTEMPORARY",
  "SCI_FI",
  "FANTASY",
  "CUSTOM",
]);

/** User-facing gameplay intents — never expose M03/M09 here. */
export const GAMEPLAY_INTENT_TAGS = Object.freeze([
  "BIDDING",
  "VOTING",
  "TRANSFER",
  "TIMED_TASK",
  "SEALED_CHOICE",
  "RESOURCE_COMPETITION",
  "NEGOTIATION",
]);

export const EXPERIENCE_KEYS = Object.freeze([
  "deduction",
  "roleplay",
  "faction",
  "mechanism",
  "emotional",
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 200) {
  return String(value ?? "").trim().slice(0, maximum);
}

function cleanId(value) {
  return cleanText(value, 120).replace(/[^a-zA-Z0-9_\-.:]/g, "_");
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function newSpecId() {
  return `pcs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @returns {{ ok: true, value: object } | { ok: false, errors: Array<{ code: string, message: string }> }}
 */
export function validatePlayableCreationSpec(input = {}) {
  const src = record(input);
  const errors = [];

  const playerCount = Math.trunc(Number(src.playerCount));
  if (!SUPPORTED_PLAYER_COUNTS.includes(playerCount)) {
    errors.push({
      code: "UNSUPPORTED_PLAYER_COUNT",
      message: `playerCount 仅支持 ${SUPPORTED_PLAYER_COUNTS.join("/")}，收到 ${src.playerCount}`,
    });
  }

  const roleConfiguration = record(src.roleConfiguration);
  const genderPolicy = String(roleConfiguration.genderPolicy || "ANY").toUpperCase();
  if (!GENDER_POLICIES.includes(genderPolicy)) {
    errors.push({
      code: "INVALID_GENDER_POLICY",
      message: `genderPolicy 必须是 ${GENDER_POLICIES.join(" / ")}`,
    });
  }

  if (genderPolicy === "FIXED_COUNTS" && SUPPORTED_PLAYER_COUNTS.includes(playerCount)) {
    const fc = record(roleConfiguration.fixedCounts);
    const male = Math.max(0, Math.trunc(Number(fc.male) || 0));
    const female = Math.max(0, Math.trunc(Number(fc.female) || 0));
    const any = Math.max(0, Math.trunc(Number(fc.any) || 0));
    if (male + female + any !== playerCount) {
      errors.push({
        code: "SPEC_INVALID_ROLE_COUNT",
        message: `fixedCounts 之和必须等于 playerCount（${male}+${female}+${any} ≠ ${playerCount}）；禁止静默补 ANY`,
      });
    }
  }

  if (genderPolicy === "AUTHOR_DEFINED" && SUPPORTED_PLAYER_COUNTS.includes(playerCount)) {
    const slots = asArray(roleConfiguration.authorDefinedSlots);
    if (slots.length !== playerCount) {
      errors.push({
        code: "SPEC_INVALID_SLOT_COUNT",
        message: `AUTHOR_DEFINED 槽位数必须等于 playerCount（${slots.length} ≠ ${playerCount}）`,
      });
    }
    for (const slot of slots) {
      const g = String(record(slot).gender || "").toUpperCase();
      if (!SLOT_GENDERS.includes(g)) {
        errors.push({
          code: "INVALID_SLOT_GENDER",
          message: `slot ${record(slot).slotId || "?"} gender 无效`,
        });
      }
    }
  }

  const stagePreference = record(src.stagePreference);
  const stageMode = String(stagePreference.mode || "AUTO").toUpperCase();
  if (stageMode !== "AUTO" && stageMode !== "EXACT") {
    errors.push({ code: "INVALID_STAGE_MODE", message: "stagePreference.mode 必须是 AUTO 或 EXACT" });
  }
  if (stageMode === "EXACT") {
    const count = Math.trunc(Number(stagePreference.count));
    if (!SUPPORTED_STAGE_COUNTS.includes(count)) {
      errors.push({
        code: "UNSUPPORTED_STAGE_COUNT",
        message: `EXACT 幕数仅支持 ${SUPPORTED_STAGE_COUNTS.join("/")}，收到 ${stagePreference.count}`,
      });
    }
  }

  const setting = record(src.setting);
  const era = String(setting.era || "MODERN").toUpperCase();
  if (!SETTING_ERAS.includes(era)) {
    errors.push({ code: "INVALID_SETTING_ERA", message: `setting.era 无效：${setting.era}` });
  }

  const preferred = asArray(record(src.gameplayPreferences).preferred);
  const avoid = asArray(record(src.gameplayPreferences).avoid);
  for (const tag of [...preferred, ...avoid]) {
    if (!GAMEPLAY_INTENT_TAGS.includes(String(tag))) {
      errors.push({
        code: "INVALID_GAMEPLAY_INTENT",
        message: `未知玩法意图标签：${tag}（勿使用 M 编号）`,
      });
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: src };
}

/**
 * Deterministic normalize. Invalid input → null (caller may keep previous / LEGACY).
 * Does not invent defaults that change meaning (e.g. silent ANY pad).
 */
export function normalizePlayableCreationSpec(input, { preserveId = null, bumpRevision = false } = {}) {
  if (input == null) return null;
  const check = validatePlayableCreationSpec(input);
  if (!check.ok) return null;

  const src = record(input);
  const playerCount = Math.trunc(Number(src.playerCount));
  const roleConfiguration = record(src.roleConfiguration);
  const genderPolicy = String(roleConfiguration.genderPolicy || "ANY").toUpperCase();

  let fixedCounts;
  let authorDefinedSlots;
  if (genderPolicy === "FIXED_COUNTS") {
    const fc = record(roleConfiguration.fixedCounts);
    fixedCounts = {
      male: Math.max(0, Math.trunc(Number(fc.male) || 0)),
      female: Math.max(0, Math.trunc(Number(fc.female) || 0)),
      any: Math.max(0, Math.trunc(Number(fc.any) || 0)),
    };
  } else if (genderPolicy === "AUTHOR_DEFINED") {
    authorDefinedSlots = asArray(roleConfiguration.authorDefinedSlots).map((s, i) => {
      const row = record(s);
      return {
        slotId: cleanId(row.slotId) || `role-${i + 1}`,
        gender: String(row.gender || "ANY").toUpperCase(),
        label: cleanText(row.label, 80) || undefined,
      };
    });
  }

  const stagePreference = record(src.stagePreference);
  const stageMode = String(stagePreference.mode || "AUTO").toUpperCase();
  const setting = record(src.setting);
  const era = String(setting.era || "MODERN").toUpperCase();
  const experience = record(src.experience);
  const gameplay = record(src.gameplayPreferences);
  const premise = record(src.premise);

  const prevRevision = Math.max(0, Math.trunc(Number(src.revision) || 0));
  const revision = bumpRevision ? prevRevision + 1 : Math.max(1, prevRevision || 1);

  return {
    version: PLAYABLE_CREATION_SPEC_VERSION,
    id: cleanId(preserveId || src.id) || newSpecId(),
    revision,
    playerCount,
    roleConfiguration: {
      genderPolicy,
      ...(fixedCounts ? { fixedCounts } : {}),
      ...(authorDefinedSlots ? { authorDefinedSlots } : {}),
    },
    setting: {
      era,
      customLabel: era === "CUSTOM" ? cleanText(setting.customLabel, 80) || undefined : undefined,
    },
    genreTags: asArray(src.genreTags)
      .map((t) => cleanText(t, 40))
      .filter(Boolean)
      .slice(0, 24),
    durationMinutes: Math.max(30, Math.trunc(Number(src.durationMinutes) || 180)),
    stagePreference: {
      mode: stageMode,
      ...(stageMode === "EXACT"
        ? { count: Math.trunc(Number(stagePreference.count)) }
        : {}),
    },
    experience: Object.fromEntries(EXPERIENCE_KEYS.map((k) => [k, clamp01(experience[k])])),
    gameplayPreferences: {
      preferred: asArray(gameplay.preferred)
        .map(String)
        .filter((t) => GAMEPLAY_INTENT_TAGS.includes(t)),
      avoid: asArray(gameplay.avoid)
        .map(String)
        .filter((t) => GAMEPLAY_INTENT_TAGS.includes(t)),
    },
    premise: {
      shortIdea: cleanText(premise.shortIdea, 400) || undefined,
      mustKeep: asArray(premise.mustKeep)
        .map((t) => cleanText(t, 120))
        .filter(Boolean)
        .slice(0, 20),
      avoid: asArray(premise.avoid)
        .map((t) => cleanText(t, 120))
        .filter(Boolean)
        .slice(0, 20),
    },
  };
}

/** Apply a patch and bump revision; returns { spec, errors }. */
export function updatePlayableCreationSpec(previous, patch = {}) {
  const base = previous ? normalizePlayableCreationSpec(previous) : null;
  const merged = {
    ...(base || {}),
    ...record(patch),
    roleConfiguration: {
      ...(base?.roleConfiguration || {}),
      ...record(patch.roleConfiguration),
    },
    setting: { ...(base?.setting || {}), ...record(patch.setting) },
    stagePreference: {
      ...(base?.stagePreference || {}),
      ...record(patch.stagePreference),
    },
    experience: { ...(base?.experience || {}), ...record(patch.experience) },
    gameplayPreferences: {
      preferred: patch.gameplayPreferences?.preferred ?? base?.gameplayPreferences?.preferred,
      avoid: patch.gameplayPreferences?.avoid ?? base?.gameplayPreferences?.avoid,
    },
    premise: { ...(base?.premise || {}), ...record(patch.premise) },
    id: base?.id,
    revision: base?.revision || 0,
  };
  const check = validatePlayableCreationSpec(merged);
  if (!check.ok) return { spec: base, errors: check.errors };
  return {
    spec: normalizePlayableCreationSpec(merged, {
      preserveId: base?.id,
      bumpRevision: Boolean(base),
    }),
    errors: [],
  };
}
