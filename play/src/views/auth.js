import { escapeHtml } from "../../../shared/security.js";
import { state } from "../state.js";

export function renderAuth() {
  const oauth = state.authConfig?.oauth || [];
  const mode = state.authMode || "login";

  if (mode === "verify") {
    const challenge = state.pendingVerificationChallenge;
    return `
      <section class="panel narrow card">
        <p class="eyebrow">邮箱验证</p>
        <h2>验证你的邮箱</h2>
        <p class="muted">6 位邮箱验证码已发送至 ${escapeHtml(challenge?.maskedEmail || state.pendingVerificationEmail || "你的邮箱")}。验证码 10 分钟内有效，请同时检查垃圾箱。</p>
        <form class="auth-form" data-form="verification-code">
          <label>邮箱验证码
            <input class="field verification-code-input" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="请输入 6 位验证码" required />
          </label>
          <button class="btn primary" type="submit" ${state.busy || !challenge?.id ? "disabled" : ""}>验证并进入玩家端</button>
        </form>
        <p class="hint">也可以点击邮件中的“一键验证并登录”链接。邮箱验证码与内测邀请码、房间邀请码互不通用。</p>
        <button class="btn outline full" type="button" data-action="resend-verification" ${state.busy ? "disabled" : ""}>重新发送验证码</button>
        <button class="text-btn" type="button" data-action="auth-login">更换邮箱 / 返回登录</button>
      </section>`;
  }

  if (mode === "forgot") {
    return `
      <section class="panel narrow card">
        <p class="eyebrow">找回密码</p>
        <h2>重置织幕账号密码</h2>
        <p class="muted">输入注册邮箱，我们会发送重置链接（若该邮箱已注册）。</p>
        <form class="auth-form" data-form="forgot">
          <label>邮箱
            <input class="field" name="email" type="email" autocomplete="email" required />
          </label>
          <button class="btn primary" type="submit" ${state.busy ? "disabled" : ""}>发送重置邮件</button>
        </form>
        <button class="text-btn" type="button" data-action="auth-login">返回登录</button>
        <button class="text-btn" type="button" data-action="back-landing">返回首页</button>
      </section>`;
  }

  if (mode === "reset") {
    return `
      <section class="panel narrow card">
        <p class="eyebrow">设置新密码</p>
        <h2>重置密码</h2>
        <p class="muted">请设置至少 8 位的新密码。</p>
        <form class="auth-form" data-form="reset">
          <label>新密码
            <input class="field" name="password" type="password" autocomplete="new-password" minlength="8" required />
          </label>
          <button class="btn primary" type="submit" ${state.busy || !state.resetToken ? "disabled" : ""}>更新密码</button>
        </form>
        ${!state.resetToken ? `<p class="hint warn">重置链接无效，请从邮件重新打开或申请新的重置邮件。</p>` : ""}
        <button class="text-btn" type="button" data-action="auth-forgot">重新发送重置邮件</button>
      </section>`;
  }

  const isRegister = mode === "register";
  return `
    <section class="panel narrow card">
      <p class="eyebrow">账号</p>
      <h2>${isRegister ? "注册织幕账号" : "登录织幕账号"}</h2>
      <p class="muted">登录后可跨设备保留进度；广场发帖、好友与私信也需要注册账号。</p>
      <form class="auth-form" data-form="auth">
        ${isRegister
          ? `
          <label>显示名称
            <input class="field" name="displayName" type="text" minlength="2" maxlength="40" required placeholder="你在房间里的称呼" />
          </label>`
          : ""}
        <label>邮箱
          <input class="field" name="email" type="email" autocomplete="email" required />
        </label>
        <label>密码
          <input class="field" name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" minlength="8" required />
        </label>
        ${isRegister && state.authConfig?.requireEmailVerification !== false
          ? `<p class="hint">注册后会收到 6 位邮箱验证码；输入后自动登录，也可使用邮件内的一键验证链接。</p>`
          : ""}
        <button class="btn primary" type="submit" ${state.busy ? "disabled" : ""}>${isRegister ? "注册并发送验证码" : "登录"}</button>
      </form>
      ${oauth.length
        ? `
        <div class="oauth-row">
          ${oauth.map((p) => `<button class="btn outline" type="button" data-action="oauth" data-provider="${p.id}">${escapeHtml(p.label)} 登录</button>`).join("")}
        </div>`
        : ""}
      ${!isRegister
        ? `
        <p class="auth-divider" aria-hidden="true"><span>或</span></p>
        <form class="auth-form auth-guest-form" data-form="guest">
          <label>访客称呼（可选）
            <input class="field" name="displayName" type="text" minlength="2" maxlength="40" placeholder="例如：玩家1234" autocomplete="nickname" />
          </label>
          <button class="btn outline full" type="submit" ${state.busy ? "disabled" : ""}>以访客身份进入</button>
          <p class="hint">无需注册即可加入房间；广场发帖、好友与私信需注册账号。</p>
        </form>`
        : ""}
      ${!isRegister ? `<button class="text-btn" type="button" data-action="auth-forgot">忘记密码？</button>` : ""}
      <button class="text-btn" type="button" data-action="toggle-auth-mode">
        ${isRegister ? "已有账号？去登录" : "没有账号？去注册"}
      </button>
      <button class="text-btn" type="button" data-action="back-landing">返回首页</button>
    </section>`;
}
