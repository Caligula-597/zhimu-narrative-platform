const CREATOR_ROLES = new Set(["owner", "editor"]);

export function activeWorldMembership(worlds = [], worldId = "") {
  if (!worldId || !Array.isArray(worlds)) return null;
  return worlds.find((world) => world?.id === worldId) || null;
}

export function creatorCockpitAccessMode(worlds = [], worldId = "") {
  const world = activeWorldMembership(worlds, worldId);
  const role = String(world?.membership_role || "").trim();
  if (!world || !role || CREATOR_ROLES.has(role)) return "creator";
  if (role === "reviewer") return "reviewer";
  return "runtime";
}

export function canLoadCreatorCockpit(worlds = [], worldId = "") {
  return creatorCockpitAccessMode(worlds, worldId) === "creator";
}
