import { escapeHtml, ALLOWED_OAUTH_PROVIDERS } from "../security.js";
import { state } from "../state.js";

export function renderAuth() {
  const oauth = state.authConfig?.oauth || [];
  const mode = state.authMode || "login";
  const isRegister = mode === "register";

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
        <button class="primary-btn auth-submit" type="submit" ${state.busy ? "disabled" : ""}>${isRegister ? "注册" : "登录"}</button>
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
