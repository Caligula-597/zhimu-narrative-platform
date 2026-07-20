export const BIBLE_ACTIONS = new Set([
  "truth-tab-claims",
  "truth-tab-core-trick",
  "truth-tab-timeline",
  "truth-tab-foreshadow",
  "truth-tab-relations",
  "save-core-trick",
  "add-timeline-event",
  "delete-timeline-event",
  "add-foreshadow-beat",
  "delete-foreshadow-beat",
  "delete-truth-claim",
  "save-role-archive"
]);

export function ownsCreatorCockpitAction(action) {
  return String(action || "").startsWith("cockpit-");
}

export function ownsBibleAction(action) {
  return BIBLE_ACTIONS.has(action);
}
