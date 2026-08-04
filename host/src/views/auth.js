import { escapeHtml, ALLOWED_OAUTH_PROVIDERS } from "../../../shared/security.js";
import { state } from "../state.js";

export function renderAuth() {
  const oauth = state.authConfig?.oauth || [];
  const mode = state.authMode || "login";
  const isRegister = mode === "register";

  if (state.pendingVerificationEmail) {
    const challenge = state.pendingVerificationChallenge;
    return `
      <section class="host-auth-panel">
        <p class="eyebrow">邮箱验证</p>
        <h2>验证你的邮箱</h2>
        <p class="muted">6 位邮箱验证码已发送至 ${escapeHtml(challenge?.maskedEmail || state.pendingVerificationEmail)}。验证码 10 分钟内有效，请同时检查垃圾箱。</p>
        <form class="auth-form" data-form="verification-code">
          <label>邮箱验证码
            <input class="field verification-code-input" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="请输入 6 位验证码" required />
          </label>
          <button class="primary-btn auth-submit" type="submit" ${state.busy || !challenge?.id ? "disabled" : ""}>验证并进入主持端</button>
        </form>
        <p class="muted verification-help">也可以点击邮件中的“一键验证并登录”链接。邮箱验证码与内测邀请码、房间邀请码互不通用。</p>
        <div class="auth-footer">
          <button class="secondary-btn" type="button" data-action="resend-verification-code">重新发送验证码</button>
          <button class="text-btn" type="button" data-action="verification-back-login">更换邮箱 / 返回登录</button>
        </div>
      </section>`;
  }

  return `
    <section class="host-auth-panel">
      <p class="eyebrow">主持端账号</p>
      <h2>${isRegister ? "注册织幕账号" : "登录织幕账号"}</h2>
      <p class="muted">主持监控台需要已授权的主持或协主持身份；访客账号无法操作运行房。</p>
      <form class="auth-form" data-form="auth">
        ${isRegister
          ? `<label>显示名称<input class="field" name="displayName" type="text" minlength="2" maxlength="40" required /></label>`
          : ""}
        <label>邮箱<input class="field" name="email" type="email" autocomplete="email" required /></label>
        <label>密码<input class="field" name="password" type="password" minlength="8" required /></label>
        ${isRegister && state.authConfig?.requireEmailVerification !== false
          ? `<p class="muted">注册后会收到 6 位邮箱验证码；输入后自动登录，也可使用邮件内的一键验证链接。</p>`
          : ""}
        <button class="primary-btn auth-submit" type="submit" ${state.busy ? "disabled" : ""}>${isRegister ? "注册并发送验证码" : "登录"}</button>
      </form>
      ${oauth.length
        ? `<div class="oauth-row">${oauth
            .filter((p) => ALLOWED_OAUTH_PROVIDERS.has(p.id))
            .map((p) => `<button class="secondary-btn" type="button" data-action="oauth" data-provider="${p.id}">${escapeHtml(p.label)} 登录</button>`)
            .join("")}</div>`
        : ""}
      <div class="auth-footer"><button class="text-btn" type="button" data-action="toggle-auth-mode">${isRegister ? "已有账号？登录" : "没有账号？注册"}</button><button class="text-btn" type="button" data-action="back-landing">返回工作区</button></div>
    </section>`;
}
