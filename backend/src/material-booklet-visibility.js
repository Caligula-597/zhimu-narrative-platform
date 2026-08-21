/**
 * Pure visibility + projection for parallel material booklets shown to a player role.
 * host_only → only via explicit room grant; public_table → always; owner_role → owner match;
 * shared_roles → linked role list or grant.
 */

export function materialBookletVisibleToRole(booklet, roleSlotId, grantedBookletIds = new Set()) {
  const id = String(booklet?.id ?? "");
  if (!id) return false;
  if (grantedBookletIds.has(id) || grantedBookletIds.has(booklet.id)) return true;
  const visibility = booklet.visibility || "host_only";
  if (visibility === "public_table") return true;
  const roleId = String(roleSlotId ?? "");
  if (visibility === "owner_role") {
    return String(booklet.ownerRoleSlotId || booklet.owner_role_slot_id || "") === roleId;
  }
  if (visibility === "shared_roles") {
    const linked = booklet.linkedRoleSlotIds || booklet.linked_role_slot_ids || [];
    return linked.some((entry) => String(entry) === roleId);
  }
  return false;
}

export function projectMaterialBookletForPlayer(booklet, { grantedAt = null } = {}) {
  return {
    id: booklet.id,
    title: booklet.title || "",
    kind: booklet.kind || "diary",
    summary: booklet.summary || "",
    pages: Array.isArray(booklet.pages) ? booklet.pages : [],
    phaseLabel: booklet.phaseLabel || booklet.phase_label || "",
    grantedAt: grantedAt ?? booklet.grantedAt ?? booklet.granted_at ?? null
  };
}

export function selectVisibleMaterialBooklets(booklets, roleSlotId, grants = []) {
  const grantedAtById = new Map(
    grants.map((row) => [String(row.bookletId || row.booklet_id), row.grantedAt || row.granted_at || null])
  );
  const grantedIds = new Set(grantedAtById.keys());
  return (booklets || [])
    .filter((booklet) => materialBookletVisibleToRole(booklet, roleSlotId, grantedIds))
    .map((booklet) => projectMaterialBookletForPlayer(booklet, {
      grantedAt: grantedAtById.get(String(booklet.id)) ?? null
    }));
}
