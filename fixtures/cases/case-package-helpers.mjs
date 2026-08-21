/** Shared builders for structured murder-mystery case fixtures. */

export function caseId(namespace, n) {
  const hex = String(n).padStart(12, "0");
  return `${namespace}-${hex.slice(0, 4)}-4${hex.slice(4, 7)}-8${hex.slice(7, 10)}-${hex.slice(0, 12)}`;
}

export function role(id, name, publicProfile, privateProfile, sequence) {
  return {
    id,
    name,
    public_profile: publicProfile,
    private_profile: privateProfile,
    sequence,
  };
}

export function chapter(id, title, summary, sequence) {
  return {
    id,
    title,
    summary,
    sequence,
    publication_status: "testing",
    unlock_rules: {},
  };
}

export function section(id, roleId, chapterId, title, body, sequence) {
  return {
    id,
    role_slot_id: roleId,
    chapter_id: chapterId,
    title,
    body,
    sequence,
    publication_status: "testing",
  };
}

export function scene(id, chapterId, name, publicText, hostText = "") {
  return {
    id,
    chapter_id: chapterId,
    name,
    public_text: publicText,
    host_text: hostText,
    metadata: {},
  };
}

export function clue(id, name, publicText, hostText = "", visibility = "role") {
  return {
    id,
    name,
    public_text: publicText,
    host_text: hostText,
    visibility,
    metadata: {},
  };
}

export function point(id, sceneId, clueId, name, description, resultText, sequence, extras = {}) {
  return {
    id,
    scene_id: sceneId,
    clue_id: clueId,
    name,
    description,
    interaction_text: description,
    result_text: resultText,
    sequence,
    metadata: {
      maxUses: extras.maxUses ?? 2,
      costResourceKey: extras.costResourceKey ?? "search-token",
      costAmount: extras.costAmount ?? 1,
      ...(extras.metadata || {}),
    },
  };
}

export function edge(fromType, fromId, toType, toId, relationType = "extension", label = "") {
  return {
    from_type: fromType,
    from_id: fromId,
    to_type: toType,
    to_id: toId,
    relation_type: relationType,
    label,
  };
}

export function wrapPackage(data, meta = {}) {
  return {
    format: "zhimu-world-package",
    version: 1,
    meta: {
      caseKey: meta.caseKey || "",
      title: meta.title || data.world?.name || "",
      notes:
        meta.notes ||
        "结构化案例包：扫描件留作线下物料；本包提供可导入、可主持、可游玩的结构化正文。",
      ...meta,
    },
    data,
  };
}
