import * as zhimuApi from "../api/index.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import {
  COLLABORATION_ROLES,
  canManageCollaborators,
  collaborationInvitePending,
  collaborationMemberPending,
  recomputeCollaborationDirty,
  reconcileCollaborationPayload,
  validateCollaboratorInvite
} from "./writer-collaboration-model.js";
import { collaborationWorkspaceHtml } from "./writer-collaboration-view.js";
import {
  beginWriterToolSession,
  getWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import "./writer-collaboration-workspace.css";

export { collaborationWorkspaceHtml } from "./writer-collaboration-view.js";

function currentCollaborationSession() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (!session || session.type !== "collaboration") return null;
  if (!canManageCollaborators(data?.world)) {
    showToast("只有主创作者可以管理协作权限");
    return null;
  }
  return session;
}

function inviteLink(token) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("invite", String(token || ""));
  return url.toString();
}

export function bindCollaborationWorkspace(data, session) {
  const root = document.querySelector('[data-writer-tool="collaboration"]');
  if (!root || root.dataset.bound || !session || !canManageCollaborators(data?.world)) return;
  root.dataset.bound = "1";

  const email = root.querySelector("[data-collaboration-invite-email]");
  const inviteRole = root.querySelector("[data-collaboration-invite-role]");
  const updateInviteDraft = () => {
    if (email) session.inviteDraft.email = email.value;
    if (inviteRole) session.inviteDraft.role = inviteRole.value;
    session.inviteError = "";
    session.confirmAction = "";
    session.discardArmed = false;
    recomputeCollaborationDirty(session);
  };
  email?.addEventListener("input", updateInviteDraft);
  inviteRole?.addEventListener("change", updateInviteDraft);

  root.querySelectorAll("[data-collaboration-role-draft]").forEach((select) => {
    select.addEventListener("change", () => {
      const userId = String(select.dataset.collaborationRoleDraft || "");
      session.roleDrafts[userId] = select.value;
      session.actionErrors[`member:${userId}`] = "";
      session.confirmAction = "";
      session.discardArmed = false;
      recomputeCollaborationDirty(session);
      const save = select.closest(".writer-collaboration-member")
        ?.querySelector('[data-action="writer-collaboration-role-save"]');
      if (save) save.disabled = select.value === session.serverRoles[userId];
    });
  });
}

async function loadCollaborators(session) {
  const sequence = ++session.requestSequence;
  session.loading = true;
  session.loadError = "";
  render();
  try {
    const payload = await zhimuApi.getWorldCollaborators(session.worldId);
    if (!writerToolSessionIsCurrent(session) || sequence !== session.requestSequence) return false;
    reconcileCollaborationPayload(session, payload);
    session.status = "ready";
    return true;
  } catch (error) {
    if (writerToolSessionIsCurrent(session) && sequence === session.requestSequence) {
      session.status = "ready";
      session.loadError = normalizeError(error, "协作权限加载失败");
    }
    return false;
  } finally {
    if (writerToolSessionIsCurrent(session) && sequence === session.requestSequence) {
      session.loading = false;
      render();
    }
  }
}

export async function openCollaborationWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canManageCollaborators(data.world)) return showToast("只有主创作者可以管理协作权限");
  const session = beginWriterToolSession("collaboration", data, {
    status: "loading",
    loading: true,
    loadError: "",
    requestSequence: 0,
    members: [],
    pendingInvites: [],
    roleDrafts: {},
    serverRoles: {},
    inviteDraft: { email: "", role: "editor" },
    inviteError: "",
    pendingActions: new Set(),
    actionErrors: {},
    confirmAction: "",
    lastInviteLink: ""
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  return loadCollaborators(session);
}

export function refreshCollaborationWorkspace() {
  const session = currentCollaborationSession();
  if (session && !session.loading) return loadCollaborators(session);
}

export async function inviteCollaboratorFromWorkspace() {
  const session = currentCollaborationSession();
  if (!session || session.savingAction || session.status !== "ready") return;
  const result = validateCollaboratorInvite(session.inviteDraft);
  if (result.errors.length) {
    session.inviteError = result.errors.join("；");
    render();
    return;
  }
  session.savingAction = "invite";
  session.inviteError = "";
  session.confirmAction = "";
  render();
  try {
    const created = await zhimuApi.addWorldMember({ email: result.email, role: result.role }, session.worldId);
    if (!writerToolSessionIsCurrent(session)) return;
    session.savingAction = "";
    session.inviteDraft.email = "";
    session.lastInviteLink = created?.inviteToken ? inviteLink(created.inviteToken) : "";
    recomputeCollaborationDirty(session);
    if (created?.pendingInvite) {
      showToast(created.emailSent ? "邀请邮件已发送" : "邀请已创建，请手动发送邀请链接");
    } else {
      showToast("协作成员已加入");
    }
    await loadCollaborators(session);
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.savingAction = "";
      session.inviteError = normalizeError(error, "协作者邀请失败");
      render();
    }
  }
}

export async function saveCollaboratorRoleFromWorkspace(userId) {
  const session = currentCollaborationSession();
  const id = String(userId || "");
  if (!session || !id || collaborationMemberPending(session, id)) return;
  const member = session.members.find((item) => String(item.user_id) === id && item.role !== "owner");
  const role = session.roleDrafts[id];
  if (!member || !COLLABORATION_ROLES.includes(role) || role === member.role) return;
  const pendingKey = `member:role:${id}`;
  session.pendingActions.add(pendingKey);
  session.actionErrors[`member:${id}`] = "";
  session.confirmAction = "";
  render();
  try {
    await zhimuApi.updateWorldMember(id, role, session.worldId);
    if (!writerToolSessionIsCurrent(session)) return;
    member.role = role;
    session.serverRoles[id] = role;
    session.roleDrafts[id] = role;
    session.pendingActions.delete(pendingKey);
    recomputeCollaborationDirty(session);
    showToast("成员权限已更新");
    await loadCollaborators(session);
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.pendingActions.delete(pendingKey);
      session.actionErrors[`member:${id}`] = normalizeError(error, "成员权限更新失败");
      render();
    }
  }
}

export async function removeCollaboratorFromWorkspace(userId) {
  const session = currentCollaborationSession();
  const id = String(userId || "");
  if (!session || !id || collaborationMemberPending(session, id)) return;
  const member = session.members.find((item) => String(item.user_id) === id && item.role !== "owner");
  if (!member) return;
  if (session.confirmAction !== `remove:${id}`) {
    session.confirmAction = `remove:${id}`;
    render();
    showToast("再次点击“确认移除”才会终止该成员的剧本访问");
    return;
  }
  const pendingKey = `member:remove:${id}`;
  session.pendingActions.add(pendingKey);
  session.actionErrors[`member:${id}`] = "";
  session.confirmAction = "";
  render();
  try {
    await zhimuApi.deleteWorldMember(id, session.worldId);
    if (!writerToolSessionIsCurrent(session)) return;
    session.members = session.members.filter((item) => String(item.user_id) !== id);
    delete session.roleDrafts[id];
    delete session.serverRoles[id];
    session.pendingActions.delete(pendingKey);
    recomputeCollaborationDirty(session);
    showToast("协作成员已移除");
    await loadCollaborators(session);
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.pendingActions.delete(pendingKey);
      session.actionErrors[`member:${id}`] = normalizeError(error, "协作成员移除失败");
      render();
    }
  }
}

export async function resendCollaboratorInviteFromWorkspace(inviteId) {
  const session = currentCollaborationSession();
  const id = String(inviteId || "");
  if (!session || !id || collaborationInvitePending(session, id)) return;
  const invite = session.pendingInvites.find((item) => String(item.id) === id);
  if (!invite) return;
  const pendingKey = `invite:resend:${id}`;
  session.pendingActions.add(pendingKey);
  session.actionErrors[`invite:${id}`] = "";
  session.confirmAction = "";
  render();
  try {
    const result = await zhimuApi.resendWorldInvite(id, session.worldId);
    if (!writerToolSessionIsCurrent(session)) return;
    invite.expires_at = result.expiresAt || invite.expires_at;
    session.lastInviteLink = result?.inviteToken ? inviteLink(result.inviteToken) : "";
    session.pendingActions.delete(pendingKey);
    showToast(result.emailSent ? "邀请邮件已重新发送" : "邀请已刷新，请手动发送新链接");
    await loadCollaborators(session);
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.pendingActions.delete(pendingKey);
      session.actionErrors[`invite:${id}`] = normalizeError(error, "邀请重新发送失败");
      render();
    }
  }
}

export async function revokeCollaboratorInviteFromWorkspace(inviteId) {
  const session = currentCollaborationSession();
  const id = String(inviteId || "");
  if (!session || !id || collaborationInvitePending(session, id)) return;
  const invite = session.pendingInvites.find((item) => String(item.id) === id);
  if (!invite) return;
  if (session.confirmAction !== `revoke:${id}`) {
    session.confirmAction = `revoke:${id}`;
    render();
    showToast("再次点击“确认撤销”才会使该邀请立即失效");
    return;
  }
  const pendingKey = `invite:revoke:${id}`;
  session.pendingActions.add(pendingKey);
  session.actionErrors[`invite:${id}`] = "";
  session.confirmAction = "";
  render();
  try {
    await zhimuApi.revokeWorldInvite(id, session.worldId);
    if (!writerToolSessionIsCurrent(session)) return;
    session.pendingInvites = session.pendingInvites.filter((item) => String(item.id) !== id);
    session.pendingActions.delete(pendingKey);
    showToast("待接受邀请已撤销");
    await loadCollaborators(session);
  } catch (error) {
    if (writerToolSessionIsCurrent(session)) {
      session.pendingActions.delete(pendingKey);
      session.actionErrors[`invite:${id}`] = normalizeError(error, "邀请撤销失败");
      render();
    }
  }
}

export function copyCollaborationInviteLink() {
  const session = currentCollaborationSession();
  if (!session?.lastInviteLink) return;
  if (window.zhimuInviteLinks?.copyText) {
    void window.zhimuInviteLinks.copyText(session.lastInviteLink, "协作者邀请链接");
  } else {
    showToast("请手动复制输入框中的邀请链接");
  }
}

export function dismissCollaborationInviteLink() {
  const session = currentCollaborationSession();
  if (!session) return;
  session.lastInviteLink = "";
  render();
}
