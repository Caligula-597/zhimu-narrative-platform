export const BIBLE_ACTIONS = new Set([
  "truth-tab-claims",
  "truth-tab-core-trick",
  "truth-tab-timeline",
  "truth-tab-foreshadow",
  "truth-tab-materials",
  "truth-tab-relations",
  "save-core-trick",
  "add-timeline-event",
  "delete-timeline-event",
  "add-foreshadow-beat",
  "delete-foreshadow-beat",
  "add-material-booklet",
  "delete-material-booklet",
  "delete-truth-claim",
  "save-role-archive",
  "add-appearance-state"
]);

export function ownsCreatorCockpitAction(action) {
  return String(action || "").startsWith("cockpit-");
}

export function ownsBibleAction(action) {
  return BIBLE_ACTIONS.has(action);
}
