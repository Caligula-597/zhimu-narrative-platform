import { state } from "../state.js";
import { escapeHtml } from "../security.js";

export function renderVerifyBanner() {
  if (!state.user || state.user.isGuest || state.user.emailVerified) return "";
  return `
    <div class="banner verify-banner" role="status">
      <div>
        <strong>请验证邮箱</strong>
        <p>验证后可发帖、加好友与发私信。我们已向 ${escapeHtml(state.user.email || "你的邮箱")} 发送验证链接。</p>
      </div>
      <button class="btn outline compact" type="button" data-action="resend-verification" ${state.busy ? "disabled" : ""}>重发验证邮件</button>
    </div>`;
}
