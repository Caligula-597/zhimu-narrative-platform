import { getWorldId } from "../session.js";
import { state } from "../state.js";

const RULE_EDITOR_ROLES = new Set(["owner", "editor"]);

export function resolveHostWorldAccess(worldId = getWorldId()) {
  const targetId = String(worldId || "");
  const studioWorld = state.studio?.world;
  const listWorld = (state.worlds || []).find((world) => String(world.id) === targetId);
  const world = String(studioWorld?.id || "") === targetId
    ? { ...(listWorld || {}), ...studioWorld }
    : listWorld;
  const role = String(world?.membership_role || "").toLowerCase();
  return {
    role,
    label: world?.membership_label || role || "未知角色",
    canEditRules: RULE_EDITOR_ROLES.has(role) || world?.can_edit_content === true
  };
}

export function canEditHostRules(worldId = getWorldId()) {
  return resolveHostWorldAccess(worldId).canEditRules;
}
