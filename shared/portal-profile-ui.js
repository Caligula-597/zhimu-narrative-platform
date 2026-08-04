import { escapeHtml } from "./security.js";

export const PORTAL_PROFILE_META = Object.freeze({
  creator: { label: "创作者端", hint: "用于剧本署名、协作与创作者社区" },
  host: { label: "主持人端", hint: "用于主持控制台与玩家看到的主持身份" },
  player: { label: "玩家端", hint: "用于房间、广场、好友和消息中的玩家身份" }
});

export function portalProfileInitial(profile) {
  return String(profile?.displayName || "?").trim().slice(0, 1).toUpperCase() || "?";
}

export function formatPortalProfileDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function renderPortalAvatar(profile, className = "") {
  const label = profile?.displayName || "账号头像";
  if (profile?.avatarUrl) {
    return `<img class="portal-profile-avatar ${escapeHtml(className)}" src="${escapeHtml(profile.avatarUrl)}" alt="${escapeHtml(label)}的头像">`;
  }
  return `<span class="portal-profile-avatar portal-profile-avatar-fallback ${escapeHtml(className)}" aria-hidden="true">${escapeHtml(portalProfileInitial(profile))}</span>`;
}

export function renderPortalProfileEditor(profile, {
  portal,
  busy = false,
  loading = false,
  status = "",
  closeAction = "",
  localActions = false
} = {}) {
  const meta = PORTAL_PROFILE_META[portal] || PORTAL_PROFILE_META.player;
  const command = (name) => localActions
    ? `data-profile-command="${name}"`
    : `data-action="${name}"`;
  if (loading && !profile) {
    return `<section class="portal-profile-card is-loading" aria-busy="true">
      <div class="portal-profile-skeleton"></div>
      <p>正在加载${escapeHtml(meta.label)}资料…</p>
    </section>`;
  }

  const nextDate = formatPortalProfileDate(profile?.nextNameChangeAt);
  const canRename = profile?.canChangeName !== false;
  const cooldownText = canRename
    ? "保存新昵称后，30 天内不能再次修改；其他两端不受影响。"
    : `本端昵称将在 ${escapeHtml(nextDate || "冷却结束后")} 可再次修改。`;

  return `<section class="portal-profile-card" data-portal-profile="${escapeHtml(portal)}">
    <header class="portal-profile-heading">
      <div>
        <span class="portal-profile-eyebrow">PORTAL IDENTITY</span>
        <h3>${escapeHtml(meta.label)}身份资料</h3>
        <p>${escapeHtml(meta.hint)}。登录账号三端通用，昵称与头像仅在本端生效。</p>
      </div>
      ${closeAction ? `<button class="portal-profile-close" type="button" data-action="${escapeHtml(closeAction)}" aria-label="关闭">×</button>` : ""}
    </header>
    <div class="portal-profile-body">
      <div class="portal-profile-avatar-column">
        ${renderPortalAvatar(profile)}
        <label class="portal-profile-file-button ${busy ? "is-disabled" : ""}">
          <input type="file" accept="image/jpeg,image/png,image/webp" data-profile-avatar-file ${busy ? "disabled" : ""}>
          更换头像
        </label>
        ${profile?.hasCustomAvatar
          ? `<button class="portal-profile-link" type="button" ${command("profile-remove-avatar")} ${busy ? "disabled" : ""}>恢复默认头像</button>`
          : ""}
        <small>JPEG / PNG / WebP，最大 2 MB</small>
      </div>
      <div class="portal-profile-name-column">
        <label for="portal-profile-name-${escapeHtml(portal)}">本端昵称</label>
        <div class="portal-profile-name-row">
          <input id="portal-profile-name-${escapeHtml(portal)}" class="portal-profile-name-input" type="text"
            minlength="2" maxlength="24" autocomplete="nickname"
            value="${escapeHtml(profile?.displayName || "")}" data-profile-name ${busy || !canRename ? "disabled" : ""}>
          <button class="portal-profile-secondary" type="button" ${command("profile-check-name")} ${busy || !canRename ? "disabled" : ""}>检查重名</button>
          <button class="portal-profile-primary" type="button" ${command("profile-save-name")} ${busy || !canRename ? "disabled" : ""}>保存昵称</button>
        </div>
        <p class="portal-profile-help">${cooldownText}</p>
        <p class="portal-profile-status" data-profile-status role="status">${escapeHtml(status)}</p>
      </div>
    </div>
  </section>`;
}

export function mergePortalProfileIntoUser(user, profile) {
  if (!user || !profile) return user;
  return {
    ...user,
    displayName: profile.displayName,
    display_name: profile.displayName,
    avatarUrl: profile.avatarUrl,
    avatar_url: profile.avatarUrl
  };
}
