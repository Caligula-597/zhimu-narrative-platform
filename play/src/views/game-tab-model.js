import { state } from "../state.js";

const PRIMARY_TAB_GROUPS = {
  home: ["home", "voice"],
  story: ["sections"],
  investigation: ["explore", "clues", "inventory"],
  play: ["tasks", "suspicions", "social"],
  recap: ["recap", "timeline", "notes"]
};

const PRIMARY_TAB_DEFAULTS = {
  home: "home",
  story: "sections",
  investigation: "explore",
  play: "tasks",
  recap: "recap"
};

const LEGACY_TAB_TO_PRIMARY = Object.entries(PRIMARY_TAB_GROUPS).reduce((acc, [primary, ids]) => {
  for (const id of ids) acc[id] = primary;
  return acc;
}, {});

export function primaryTabFor(tabId = state.tab) {
  return LEGACY_TAB_TO_PRIMARY[tabId] || (PRIMARY_TAB_DEFAULTS[tabId] ? tabId : "home");
}

export function defaultGameTabFor(tabId = "home") {
  return PRIMARY_TAB_DEFAULTS[tabId] || tabId || "home";
}

export function tabGroupFor(tabId = state.tab) {
  const primary = primaryTabFor(tabId);
  return PRIMARY_TAB_GROUPS[primary] || [tabId || "home"];
}

export function gameTabPanelLabelId(tabId = state.tab) {
  return `play-tab-${primaryTabFor(tabId)}`;
}
