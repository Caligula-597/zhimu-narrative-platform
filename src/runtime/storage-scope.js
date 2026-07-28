/**
 * Browser-only state must be scoped to the signed-in account.
 *
 * World ids are globally unique, but two collaborators can open the same world
 * from the same shared browser. Including the account id prevents one person's
 * unsaved drafts and dismissed onboarding state from appearing for another.
 */
function segment(value, fallback) {
  return encodeURIComponent(String(value || fallback));
}

export function accountScopedStorageKey(prefix, {
  userId = "",
  worldId = "",
  scope = ""
} = {}) {
  const parts = [prefix, "user", segment(userId, "__anonymous__")];
  if (worldId) parts.push("world", segment(worldId, "__none__"));
  if (scope) parts.push("scope", segment(scope, "__default__"));
  return parts.join(":");
}

export function currentStorageUserId() {
  return globalThis.window?.zhimuAuthSession?.getAuthStatus?.()?.user?.id
    || globalThis.window?.zhimuSessionAuth?.getUserId?.()
    || "";
}
