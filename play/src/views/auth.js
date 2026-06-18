import { escapeHtml } from "../security.js";
import { state } from "../state.js";

export function renderAuth() {
  const oauth = state.authConfig?.oauth || [];
  const isRegister = state.authMode === "register";
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
        <button class="btn primary" type="submit" ${state.busy ? "disabled" : ""}>${isRegister ? "注册" : "登录"}</button>
      </form>
      ${oauth.length
        ? `
        <div class="oauth-row">
          ${oauth.map((p) => `<button class="btn outline" type="button" data-action="oauth" data-provider="${p.id}">${escapeHtml(p.label)} 登录</button>`).join("")}
        </div>`
        : ""}
      <button class="text-btn" type="button" data-action="toggle-auth-mode">
        ${isRegister ? "已有账号？去登录" : "没有账号？去注册"}
      </button>
      <button class="text-btn" type="button" data-action="back-landing">返回首页</button>
    </section>`;
}
