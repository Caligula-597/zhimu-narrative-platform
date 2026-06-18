export function clueIsRead(clue, { owned = true } = {}) {
  if (!clue) return false;
  if (owned) return Boolean(clue.read_at);
  return Boolean(clue.read_by_me || clue.read_at);
}

export function clueShareRoleCount(clue) {
  const roles = clue?.shared_with_roles;
  return Array.isArray(roles) ? roles.length : 0;
}

export function clueOwnerLabel(clue) {
  return clue?.owner_player_name || clue?.owner_role_name || "玩家";
}
