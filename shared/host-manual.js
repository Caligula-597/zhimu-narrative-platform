/**
 * Host Manual Compiler — shared constants & factories.
 *
 * A host manual (主持手册) is compiled deterministically from every preceding
 * locked内容 module and stored in versioned rows. Each version carries ordered
 * sections (chapters). Sections tagged "system" are derived by compile; creators
 * may edit them (unlocking) or append custom sections in editor mode.
 */

export const HOST_MANUAL_VERSION = 1;

export const HOST_MANUAL_API_PREFIX = "/api/worlds/:worldId/host-manual";

/**
 * Ordered list of system-derived sections produced by the deterministic
 * compiler, mapping section_key -> default title. Used by the front-end to
 * render the整册 skeleton and by tests to assert coverage.
 */
export const HOST_MANUAL_SECTION_TEMPLATES = [
  { key: "overview", title: "作品概览" },
  { key: "acts", title: "剧情幕次" },
  { key: "characters", title: "角色总览" },
  { key: "character_scripts", title: "角色私人剧本" },
  { key: "timeline", title: "行动时间线" },
  { key: "scenes", title: "场景总览" },
  { key: "clues", title: "线索清单" },
  { key: "items", title: "物件总览" },
  { key: "rules", title: "世界规则" },
  { key: "runbook", title: "主持阶段脚本" },
  { key: "misidentifications", title: "误认登记" },
  { key: "relationships", title: "关系过程" },
  { key: "endings", title: "结局分支" }
];

/** Default empty version draft for a fresh manual. */
export function emptyHostManualDraft() {
  return {
    id: "",
    worldId: "",
    version: 0,
    title: "主持手册",
    sourceFingerprint: "",
    compiledBy: "system",
    createdAt: "",
    updatedAt: "",
    sections: []
  };
}

/** Build a host manual object for client-side use. */
export function buildHostManual(overrides = {}) {
  return {
    id: overrides.id || "",
    worldId: overrides.worldId || "",
    version: overrides.version ?? 0,
    title: overrides.title || "主持手册",
    sourceFingerprint: overrides.sourceFingerprint || "",
    compiledBy: overrides.compiledBy || "system",
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || "",
    sections: overrides.sections || []
  };
}

/** Build a single manual section object. */
export function buildManualSection(overrides = {}) {
  return {
    id: overrides.id || "",
    manualId: overrides.manualId || "",
    worldId: overrides.worldId || "",
    sectionKey: overrides.sectionKey || "",
    title: overrides.title || "",
    body: overrides.body || "",
    locked: overrides.locked ?? true,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || ""
  };
}