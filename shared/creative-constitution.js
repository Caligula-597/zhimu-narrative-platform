/**
 * Canonical creative constitution shared by Creator UI and backend diagnostics.
 *
 * The constitution records author intent. It is deliberately structured and
 * bounded so downstream checks can cite it without pretending to infer intent
 * from prose.
 */

export const CREATIVE_CONSTITUTION_VERSION = 1;
export const SUPERNATURAL_POLICIES = Object.freeze(["forbidden", "ambiguous", "allowed"]);

const CORE_FIELD_DEFS = Object.freeze([
  ["theme", "核心主题"],
  ["intendedEmotion", "最终感受"],
  ["experiencePromise", "体验承诺"],
  ["revealEmotion", "揭晓情绪"],
  ["inviolablePrinciples", "不可破坏原则"],
  ["fairPuzzlePromises", "必须公平的谜题"],
  ["pacingPrinciples", "节奏原则"],
  ["voicePrinciples", "文风原则"],
  ["forbiddenTropes", "禁用套路"],
  ["supernaturalRules", "超自然解释边界"],
  ["desiredDebates", "希望玩家争论什么"],
  ["avoidMisunderstandings", "不希望玩家误解什么"]
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function boundedText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function boundedList(value, { maxItems = 20, maxLength = 600 } = {}) {
  const source = Array.isArray(value)
    ? value
    : String(value ?? "").split(/\r?\n/);
  return [...new Set(
    source
      .map((item) => boundedText(item, maxLength))
      .filter(Boolean)
  )].slice(0, maxItems);
}

function normalizeMinimumEvidence(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 2;
  return Math.max(1, Math.min(5, parsed));
}

function normalizeRoleHighlights(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  return source.flatMap((item) => {
    const roleId = boundedText(item?.roleId ?? item?.role_id, 120);
    const promise = boundedText(item?.promise, 1200);
    if (!roleId || seen.has(roleId)) return [];
    seen.add(roleId);
    return [{ roleId, promise }];
  }).slice(0, 60);
}

export function normalizeCreativeConstitution(value = {}) {
  const source = record(value);
  const fairness = record(source.fairness);
  const supernaturalPolicy = SUPERNATURAL_POLICIES.includes(source.supernaturalPolicy)
    ? source.supernaturalPolicy
    : "forbidden";
  return {
    version: CREATIVE_CONSTITUTION_VERSION,
    theme: boundedText(source.theme, 1200),
    intendedEmotion: boundedText(source.intendedEmotion, 1200),
    experiencePromise: boundedText(source.experiencePromise, 4000),
    revealEmotion: boundedText(source.revealEmotion, 1200),
    inviolablePrinciples: boundedList(source.inviolablePrinciples),
    fairPuzzlePromises: boundedList(source.fairPuzzlePromises),
    pacingPrinciples: boundedList(source.pacingPrinciples),
    voicePrinciples: boundedList(source.voicePrinciples),
    forbiddenTropes: boundedList(source.forbiddenTropes),
    supernaturalPolicy,
    supernaturalRules: boundedText(source.supernaturalRules, 2400),
    desiredDebates: boundedText(source.desiredDebates, 2400),
    avoidMisunderstandings: boundedText(source.avoidMisunderstandings, 2400),
    roleHighlights: normalizeRoleHighlights(source.roleHighlights),
    fairness: {
      minimumEvidence: normalizeMinimumEvidence(fairness.minimumEvidence),
      requireIndependentPaths: fairness.requireIndependentPaths !== false
    }
  };
}

export function creativeConstitutionCoverage(value = {}, roles = []) {
  const constitution = normalizeCreativeConstitution(value);
  const missing = [];
  let filled = 0;

  for (const [key, label] of CORE_FIELD_DEFS) {
    const fieldValue = constitution[key];
    const present = Array.isArray(fieldValue) ? fieldValue.length > 0 : Boolean(fieldValue);
    if (present) filled += 1;
    else missing.push({ key, label });
  }

  const roleRows = Array.isArray(roles) ? roles.filter((role) => role?.id) : [];
  const promisedRoleIds = new Set(
    constitution.roleHighlights
      .filter((item) => item.promise)
      .map((item) => item.roleId)
  );
  const missingRoles = roleRows
    .filter((role) => !promisedRoleIds.has(String(role.id)))
    .map((role) => ({
      id: String(role.id),
      label: String(role.name || role.title || "未命名角色")
    }));
  const roleFilled = Math.max(0, roleRows.length - missingRoles.length);
  const total = CORE_FIELD_DEFS.length + roleRows.length;
  const totalFilled = filled + roleFilled;

  return {
    score: total ? Math.round((totalFilled / total) * 100) : 0,
    filled: totalFilled,
    total,
    missing,
    roles: {
      filled: roleFilled,
      total: roleRows.length,
      missing: missingRoles
    }
  };
}

export function isCreativeConstitutionEmpty(value = {}) {
  const constitution = normalizeCreativeConstitution(value);
  return !CORE_FIELD_DEFS.some(([key]) => {
    const fieldValue = constitution[key];
    return Array.isArray(fieldValue) ? fieldValue.length > 0 : Boolean(fieldValue);
  }) && !constitution.roleHighlights.some((item) => item.promise);
}
