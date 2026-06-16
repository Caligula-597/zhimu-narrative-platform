/**
 * World membership roles — API-facing labels and capability flags (Part 1).
 */

export const WORLD_MEMBERSHIP_ROLES = ["owner", "editor", "host", "viewer", "player"];

const ROLE_META = {
  owner: {
    label: "拥有者",
    capabilities: ["delete_world", "manage_members", "edit_content", "manage_catalog", "host_rooms", "view_content"]
  },
  editor: {
    label: "编辑者",
    capabilities: ["edit_content", "host_rooms", "view_content"]
  },
  host: {
    label: "主持人",
    capabilities: ["host_rooms", "view_content"]
  },
  viewer: {
    label: "查看者",
    capabilities: ["view_content"]
  },
  player: {
    label: "玩家",
    capabilities: ["play_in_room"]
  }
};

export function membershipMeta(role) {
  const key = String(role || "").toLowerCase();
  return ROLE_META[key] ?? { label: key || "成员", capabilities: [] };
}

export function enrichWorldMembership(row) {
  if (!row || typeof row !== "object") return row;
  const role = row.membership_role;
  const meta = membershipMeta(role);
  return {
    ...row,
    membership_label: meta.label,
    membership_capabilities: meta.capabilities,
    can_edit_content: meta.capabilities.includes("edit_content"),
    can_manage_world: role === "owner"
  };
}

export function enrichWorldMembershipList(rows) {
  return (rows || []).map(enrichWorldMembership);
}
