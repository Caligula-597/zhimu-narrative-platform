/**
 * Relationship Arc Editor — shared types.
 *
 * A relationship arc is a multi-stage progression between two characters
 * (e.g. 仇视 → 怀疑 → 谈判 → 合作). Each stage can define a trigger condition
 * and the relationship change it causes.
 */

/**
 * @typedef {Object} RelationshipStage
 * @property {string} id
 * @property {string} label       — stage name, e.g. "仇视"
 * @property {string} description — what happens at this stage
 * @property {string} trigger     — condition that advances into this stage
 * @property {string} change      — the relationship change this stage causes
 */

/**
 * @typedef {Object} RelationshipArc
 * @property {string}  id
 * @property {string}  worldId
 * @property {string}  title       — short label, e.g. "R-01"
 * @property {string}  charAId     — party A (role slot), "" if none
 * @property {string}  charALabel  — persistent display name for A
 * @property {string}  charBId     — party B (role slot), "" if none
 * @property {string}  charBLabel  — persistent display name for B
 * @property {string}  summary     — overview of the arc
 * @property {RelationshipStage[]} stages — ordered progression
 * @property {string}  createdAt
 * @property {string}  updatedAt
 */

export const RELATIONSHIP_ARC_EDITOR_VERSION = 1;

export const RELATIONSHIP_ARC_API_PREFIX = "/api/worlds/:worldId/relationship-arcs";

/** Default empty draft for a new relationship arc */
export function emptyRelationshipArcDraft() {
  return {
    title: "",
    charAId: "",
    charALabel: "",
    charBId: "",
    charBLabel: "",
    summary: "",
    stages: []
  };
}

/** Create an empty stage */
export function createStage(label = "", description = "", trigger = "", change = "") {
  return {
    id: "",
    label,
    description,
    trigger,
    change
  };
}

/**
 * Build a relationship arc for client-side use.
 * @param {Partial<RelationshipArc>} overrides
 */
export function buildRelationshipArc(overrides = {}) {
  return {
    id: overrides.id || "",
    worldId: overrides.worldId || "",
    title: overrides.title || "",
    charAId: overrides.charAId || "",
    charALabel: overrides.charALabel || "",
    charBId: overrides.charBId || "",
    charBLabel: overrides.charBLabel || "",
    summary: overrides.summary || "",
    stages: overrides.stages || [],
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || ""
  };
}