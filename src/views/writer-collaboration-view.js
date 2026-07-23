import { escapeHtml, formatTime } from "../utils/format.js";
import {
  COLLABORATION_ROLES,
  COLLABORATION_ROLE_DETAILS,
  MAX_COLLABORATOR_EMAIL_LENGTH,
  collaborationCounts,
  collaborationInvitePending,
  collaborationMemberPending
} from "./writer-collaboration-model.js";

function roleLabel(role) {
  return COLLABORATION_ROLE_DETAILS[role]?.label || role || "未知权限";
}

function roleOptionsHtml(selectedRole) {
  return COLLABORATION_ROLES.map((role) => {
    const detail = COLLABORATION_ROLE_DETAILS[role];
    return `<option value="${escapeHtml(role)}"${role === selectedRole ? " selected" : ""}>${escapeHtml(detail.label)}</option>`;
  }).join("");
}

function workspaceStatusHtml(session) {
  if (session.status === "loading") {
    return `<section class="writer-collaboration-state" aria-live="polite">
      <strong>正在读取协作者与待接受邀请…</strong>
      <p>只发起一次成员查询；切换剧本后旧响应不会覆盖当前页面。</p>
    </section>`;
  }
  if (session.loadError) {
    return `<section class="writer-collaboration-state error" role="alert">
      <strong>协作权限加载失败</strong>
      <p>${escapeHtml(session.loadError)}</p>
      <button type="button" class="secondary-btn" data-action="writer-collaboration-refresh">重新加载</button>
    </section>`;
  }
  return "";
}

function memberRowsHtml(session) {
  if (!session.members.length) return `<div class="empty-state">当前剧本还没有成员记录。</div>`;
  return session.members.map((member) => {
    const userId = String(member.user_id || "");
    const role = String(member.role || "");
    const draftRole = session.roleDrafts[userId] || role;
    const isOwner = role === "owner";
    const busy = collaborationMemberPending(session, userId);
    const changed = draftRole !== role;
    const confirmRemove = session.confirmAction === `remove:${userId}`;
    const error = session.actionErrors[`member:${userId}`];
    return `<article class="writer-collaboration-member" aria-busy="${busy ? "true" : "false"}">
      <div class="writer-collaboration-identity">
        <span class="writer-collaboration-avatar" aria-hidden="true">${escapeHtml(String(member.display_name || member.email || "?").slice(0, 1).toUpperCase())}</span>
        <div>
          <h3>${escapeHtml(member.display_name || "未命名成员")}</h3>
          <p>${escapeHtml(member.email || "未提供邮箱")} · 加入于 ${escapeHtml(formatTime(member.created_at))}</p>
        </div>
      </div>
      ${isOwner
        ? `<div class="writer-collaboration-owner"><span class="cloud-pill">OWNER</span><small>主创作者不可被降级或移除</small></div>`
        : `<div class="writer-collaboration-member-controls">
            <label>
              <span>当前权限</span>
              <select class="field compact-field" data-collaboration-role-draft="${escapeHtml(userId)}"${busy ? " disabled" : ""}>
                ${roleOptionsHtml(draftRole)}
              </select>
            </label>
            <button type="button" class="secondary-btn" data-action="writer-collaboration-role-save" data-member-id="${escapeHtml(userId)}"${busy || !changed ? " disabled" : ""}>${busy ? "正在保存…" : "保存权限"}</button>
            <button type="button" class="${confirmRemove ? "danger-btn" : "text-btn danger-text"}" data-action="writer-collaboration-remove" data-member-id="${escapeHtml(userId)}"${busy ? " disabled" : ""}>${confirmRemove ? "确认移除" : "移除成员"}</button>
          </div>`}
      ${error ? `<div class="workspace-editor-errors show" role="alert">${escapeHtml(error)}</div>` : ""}
    </article>`;
  }).join("");
}

function pendingInviteRowsHtml(session) {
  if (!session.pendingInvites.length) {
    return `<div class="empty-state">没有待接受邀请。新邀请会在这里显示有效期和投递状态。</div>`;
  }
  return session.pendingInvites.map((invite) => {
    const inviteId = String(invite.id || "");
    const busy = collaborationInvitePending(session, inviteId);
    const confirmRevoke = session.confirmAction === `revoke:${inviteId}`;
    const error = session.actionErrors[`invite:${inviteId}`];
    return `<article class="writer-collaboration-pending" aria-busy="${busy ? "true" : "false"}">
      <div>
        <p class="section-kicker">${escapeHtml(roleLabel(invite.role))}</p>
        <h3>${escapeHtml(invite.email || "未知邮箱")}</h3>
        <p>等待对方接受 · 有效期至 ${escapeHtml(formatTime(invite.expires_at || invite.expiresAt))}</p>
      </div>
      <div class="row">
        <button type="button" class="secondary-btn" data-action="writer-collaboration-invite-resend" data-invite-id="${escapeHtml(inviteId)}"${busy ? " disabled" : ""}>${busy ? "正在处理…" : "重新发送"}</button>
        <button type="button" class="${confirmRevoke ? "danger-btn" : "text-btn danger-text"}" data-action="writer-collaboration-invite-revoke" data-invite-id="${escapeHtml(inviteId)}"${busy ? " disabled" : ""}>${confirmRevoke ? "确认撤销" : "撤销邀请"}</button>
      </div>
      ${error ? `<div class="workspace-editor-errors show" role="alert">${escapeHtml(error)}</div>` : ""}
    </article>`;
  }).join("");
}

function roleGuideHtml() {
  return COLLABORATION_ROLES.map((role) => {
    const detail = COLLABORATION_ROLE_DETAILS[role];
    return `<li><span>${escapeHtml(detail.short)}</span><div><strong>${escapeHtml(detail.label)}</strong><p>${escapeHtml(detail.description)}</p></div></li>`;
  }).join("");
}

function inviteEditorHtml(session) {
  const saving = session.savingAction === "invite";
  const inviteLink = session.lastInviteLink
    ? `<section class="writer-collaboration-link">
        <div>
          <strong>邮件未投递，请手动发送邀请链接</strong>
          <p>该链接等同一次性协作凭据，仅发送给上方指定邮箱。</p>
        </div>
        <input class="field" readonly value="${escapeHtml(session.lastInviteLink)}" aria-label="协作者邀请链接">
        <div class="row">
          <button type="button" class="primary-btn" data-action="writer-collaboration-invite-copy">复制邀请链接</button>
          <button type="button" class="text-btn" data-action="writer-collaboration-invite-dismiss">清除链接</button>
        </div>
      </section>`
    : "";
  return `<aside class="workspace-editor-panel writer-collaboration-invite" data-workspace-editor aria-label="邀请协作者" aria-busy="${saving ? "true" : "false"}">
    <header class="workspace-editor-head">
      <div>
        <p class="section-kicker">INVITE COLLABORATOR</p>
        <h2>邀请协作者</h2>
        <p>已注册账号会直接加入；未注册账号会收到七天有效的邀请。</p>
      </div>
    </header>
    <div class="workspace-editor-scroll">
      <div class="form-group workspace-editor-form">
        <label>
          <span>成员邮箱</span>
          <input class="field" type="email" inputmode="email" autocomplete="email" maxlength="${MAX_COLLABORATOR_EMAIL_LENGTH}" data-collaboration-invite-email value="${escapeHtml(session.inviteDraft.email)}" placeholder="author@example.com"${saving ? " disabled" : ""}>
        </label>
        <label>
          <span>协作角色</span>
          <select class="field" data-collaboration-invite-role${saving ? " disabled" : ""}>${roleOptionsHtml(session.inviteDraft.role)}</select>
        </label>
        <ul class="writer-collaboration-role-guide">${roleGuideHtml()}</ul>
        <aside class="tutorial-tip">
          <strong>版权与保密</strong>
          <span>只邀请确需接触稿件的人。移除成员会终止其后续访问，但无法撤回其此前已合法导出的副本。</span>
        </aside>
      </div>
      <div class="workspace-editor-errors${session.inviteError ? " show" : ""}" data-workspace-editor-errors role="alert">${escapeHtml(session.inviteError || "")}</div>
      ${inviteLink}
    </div>
    <footer class="workspace-editor-actions">
      <div></div>
      <div class="workspace-editor-primary-actions">
        <button type="button" class="primary-btn" data-action="writer-collaboration-invite"${saving ? " disabled" : ""}>${saving ? "正在发送…" : "发送邀请"}</button>
      </div>
    </footer>
  </aside>`;
}

export function collaborationWorkspaceHtml(data, session) {
  if (!session) return "";
  const counts = collaborationCounts(session);
  const status = workspaceStatusHtml(session);
  return `<section class="writer-tool-workspace writer-collaboration-workspace" data-writer-tool="collaboration">
    <header class="writer-collaboration-head">
      <div>
        <p class="section-kicker">COLLABORATION ACCESS</p>
        <h1>协作权限中心</h1>
        <p>统一管理谁能编辑、审稿、主持或以玩家身份访问「${escapeHtml(data?.world?.name || "当前剧本")}」。</p>
      </div>
      <div class="row">
        <button type="button" class="secondary-btn" data-action="writer-collaboration-refresh"${session.loading ? " disabled" : ""}>${session.loading ? "正在刷新…" : "刷新成员"}</button>
        <button type="button" class="secondary-btn" data-action="writer-tool-close">返回创作中心</button>
      </div>
    </header>
    <div class="writer-collaboration-facts" aria-label="协作成员概览">
      <span><b>${counts.members}</b>全部成员</span>
      <span><b>${counts.editors}</b>可编辑</span>
      <span><b>${counts.reviewers}</b>审稿人</span>
      <span><b>${counts.pending}</b>待接受</span>
    </div>
    ${status || `<div class="writer-collaboration-grid">
      <main class="writer-collaboration-main">
        <section class="writer-collaboration-section">
          <div class="section-head"><div><p class="section-kicker">CURRENT MEMBERS</p><h2>当前成员</h2><p>权限变更需要明确保存；移除成员需要二次确认。</p></div></div>
          <div class="writer-collaboration-list">${memberRowsHtml(session)}</div>
        </section>
        <section class="writer-collaboration-section">
          <div class="section-head"><div><p class="section-kicker">PENDING INVITES</p><h2>待接受邀请</h2><p>重新发送会旋转旧邀请凭据并刷新七天有效期。</p></div></div>
          <div class="writer-collaboration-list">${pendingInviteRowsHtml(session)}</div>
        </section>
      </main>
      ${inviteEditorHtml(session)}
    </div>`}
  </section>`;
}
