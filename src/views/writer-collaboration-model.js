export const COLLABORATION_ROLES = ["editor", "reviewer", "host", "viewer"];
export const MAX_COLLABORATOR_EMAIL_LENGTH = 254;

export const COLLABORATION_ROLE_DETAILS = {
  owner: {
    label: "主创作者",
    short: "OWNER",
    description: "拥有剧本、成员管理、创作、审稿和运行权限。"
  },
  editor: {
    label: "编辑协作者",
    short: "编辑",
    description: "可以修改创作内容、参与审稿和版本整理，不能管理成员。"
  },
  reviewer: {
    label: "只读审稿人",
    short: "审稿",
    description: "可以查看私有创作材料并提交审稿意见，不能修改正文。"
  },
  host: {
    label: "主持人",
    short: "主持",
    description: "可以进入主持端运行场次，不能修改创作内容。"
  },
  viewer: {
    label: "只读玩家",
    short: "玩家",
    description: "仅保留玩家侧访问能力，不可查看完整创作材料。"
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function canManageCollaborators(world) {
  return world?.membership_role === "owner";
}

export function normalizeCollaboratorEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export function validateCollaboratorInvite({ email, role } = {}) {
  const normalizedEmail = normalizeCollaboratorEmail(email);
  const errors = [];
  if (!normalizedEmail) errors.push("请填写协作者邮箱");
  else if (normalizedEmail.length > MAX_COLLABORATOR_EMAIL_LENGTH || !EMAIL_RE.test(normalizedEmail)) {
    errors.push("请填写有效的邮箱地址");
  }
  if (!COLLABORATION_ROLES.includes(role)) errors.push("请选择有效的协作角色");
  return { email: normalizedEmail, role, errors };
}

export function collaborationPayload(payload = {}) {
  return {
    members: Array.isArray(payload?.members) ? payload.members : [],
    pendingInvites: Array.isArray(payload?.pendingInvites) ? payload.pendingInvites : []
  };
}

export function reconcileCollaborationPayload(session, payload = {}) {
  const next = collaborationPayload(payload);
  const previousServerRoles = session.serverRoles || {};
  const previousDrafts = session.roleDrafts || {};
  const roleDrafts = {};
  const serverRoles = {};

  for (const member of next.members) {
    const userId = String(member?.user_id || "");
    if (!userId) continue;
    const serverRole = String(member.role || "");
    const previousServerRole = previousServerRoles[userId];
    const previousDraft = previousDrafts[userId];
    const hasUnsavedChange = previousServerRole && previousDraft && previousDraft !== previousServerRole;
    roleDrafts[userId] = hasUnsavedChange ? previousDraft : serverRole;
    serverRoles[userId] = serverRole;
  }

  session.members = next.members;
  session.pendingInvites = next.pendingInvites;
  session.roleDrafts = roleDrafts;
  session.serverRoles = serverRoles;
  recomputeCollaborationDirty(session);
}

export function collaborationMemberPending(session, userId) {
  const id = String(userId || "");
  return [...(session?.pendingActions || [])].some((key) => key.endsWith(`:${id}`) && key.startsWith("member:"));
}

export function collaborationInvitePending(session, inviteId) {
  const id = String(inviteId || "");
  return [...(session?.pendingActions || [])].some((key) => key.endsWith(`:${id}`) && key.startsWith("invite:"));
}

export function recomputeCollaborationDirty(session) {
  const inviteDirty = Boolean(normalizeCollaboratorEmail(session?.inviteDraft?.email));
  const roleDirty = Object.entries(session?.roleDrafts || {}).some(
    ([userId, role]) => role !== session?.serverRoles?.[userId]
  );
  session.dirty = inviteDirty || roleDirty;
}

export function collaborationCounts(session) {
  const members = Array.isArray(session?.members) ? session.members : [];
  const pendingInvites = Array.isArray(session?.pendingInvites) ? session.pendingInvites : [];
  return {
    members: members.length,
    editors: members.filter((member) => ["owner", "editor"].includes(member.role)).length,
    reviewers: members.filter((member) => member.role === "reviewer").length,
    pending: pendingInvites.length
  };
}
