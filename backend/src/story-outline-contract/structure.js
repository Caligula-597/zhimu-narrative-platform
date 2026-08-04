const assemblyComponentDefinitions = Object.freeze([
  Object.freeze({
    key: "playerActions",
    assemblyField: "playerChapterActions",
    blueprintSlot: "players[].chapterActions"
  }),
  Object.freeze({
    key: "chapterBeats",
    assemblyField: "chapterBeats",
    blueprintSlot: "chapterBeats"
  }),
  Object.freeze({
    key: "styleExpressions",
    assemblyField: "styleChapterExpressions",
    blueprintSlot: "styleContract.chapterExpressions"
  })
]);

const assemblyComponentsByKey = new Map(
  assemblyComponentDefinitions.map((definition) => [definition.key, definition])
);
const assemblyRootFieldSet = new Set(
  assemblyComponentDefinitions.map((definition) => definition.assemblyField)
);

export const OUTLINE_ASSEMBLY_COMPONENTS = assemblyComponentDefinitions;
export const OUTLINE_ASSEMBLY_COMPONENT_KEYS = Object.freeze(
  assemblyComponentDefinitions.map((definition) => definition.key)
);
export const OUTLINE_ASSEMBLY_ROOT_FIELDS = Object.freeze(
  assemblyComponentDefinitions.map((definition) => definition.assemblyField)
);
export const OUTLINE_ASSEMBLY_ROOT_POINTERS = Object.freeze(
  OUTLINE_ASSEMBLY_ROOT_FIELDS.map((field) => `/${field}`)
);
export const OUTLINE_BLUEPRINT_EMPTY_SLOT_PATHS = Object.freeze(
  assemblyComponentDefinitions.map((definition) => definition.blueprintSlot)
);

export function getOutlineAssemblyComponent(componentKey) {
  return assemblyComponentsByKey.get(componentKey) || null;
}

export function getOutlineAssemblyField(componentKey) {
  return getOutlineAssemblyComponent(componentKey)?.assemblyField || null;
}

export function getOutlineBlueprintSlotPath(componentKey, index = null) {
  const path = getOutlineAssemblyComponent(componentKey)?.blueprintSlot || null;
  if (path === null || index === null || index === undefined) return path;
  return path.replace("[]", `[${index}]`);
}

export function findUnexpectedOutlineAssemblyFields(value, allowedFields = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const allowed = allowedFields === null
    ? assemblyRootFieldSet
    : new Set(allowedFields);
  return Object.keys(value).filter((key) => !allowed.has(key));
}

// V2.2 materialization intentionally mutates its cloned draft before validation.
// Newer revisions must validate these slots as empty instead of calling this helper.
export function resetOutlineAssemblyBlueprintSlots(outline) {
  if (!outline || typeof outline !== "object" || Array.isArray(outline)) return outline;
  for (const player of (Array.isArray(outline.players) ? outline.players : [])) {
    if (player && typeof player === "object" && !Array.isArray(player)) player.chapterActions = [];
  }
  outline.chapterBeats = [];
  if (outline.styleContract && typeof outline.styleContract === "object" && !Array.isArray(outline.styleContract)) {
    outline.styleContract.chapterExpressions = [];
  }
  return outline;
}
