import "./styles.css";
import {
  api,
  clearSession,
  getAppOrigin,
  getPlayOrigin,
  getSessionToken,
  setSessionToken
} from "./api.js";
import {
  ALLOWED_OAUTH_PROVIDERS,
  escapeHtml,
  isSafeOAuthRedirectUrl,
  isUuid,
  normalizeInviteCode,
  sanitizeImageUrl,
  asArray
} from "./security.js";
const ROOM_KEY = "zhimuPlayActiveRoomId";

const state = {
  user: null,
  authConfig: null,
  roomId: localStorage.getItem(ROOM_KEY) || "",
  home: null,
  exploration: null,
  tab: "sections",
  sectionId: "",
  clueId: "",
  inviteCode: "",
  joinPreview: null,
  selectedRoleId: "",
  view: "landing",
  authMode: "login",
  busy: false,
  toast: "",
  error: ""
};

const app = document.getElementById("app");

function setToast(message) {  state.toast = message;
  render();
  if (message) {
    window.clearTimeout(setToast._timer);
    setToast._timer = window.setTimeout(() => {
      state.toast = "";
      render();
    }, 3200);
  }
}

function setBusy(busy) {
  state.busy = busy;
  render();
}

function persistRoom(roomId) {
  const next = roomId && isUuid(roomId) ? roomId : "";
  state.roomId = next;
  if (next) localStorage.setItem(ROOM_KEY, next);
  else localStorage.removeItem(ROOM_KEY);
}
function cleanUrl() {
  const url = new URL(window.location.href);
  ["oauth_code", "oauth_error", "auth", "join", "invite"].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

async function ensureSession() {
  if (getSessionToken()) return;
  const guestName = `玩家${Math.floor(Math.random() * 9000 + 1000)}`;
  const result = await api.guest(guestName);
  setSessionToken(result.token);
  state.user = result.user;
}

async function loadAuthConfig() {
  state.authConfig = await api.authConfig();
}

async function refreshHome() {
  if (!state.roomId) {
    state.home = null;
    state.view = "landing";
    return;
  }
  if (!isUuid(state.roomId)) {
    persistRoom("");
    state.home = null;
    state.view = "landing";
    return;
  }
  try {
    state.home = await api.playerHome(state.roomId);
    state.exploration = await api.exploration(state.roomId).catch(() => ({ scenes: [] }));
    const sections = state.home.sections || [];
    if (!state.sectionId && sections.length) {
      state.sectionId = sections.find((s) => !s.completed)?.id || sections[0].id;
    }
    state.view = "game";
  } catch (error) {
    if (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 409) {
      persistRoom("");
      state.home = null;
      state.view = "landing";
      throw error;
    }
    throw error;
  }
}
async function bootstrap() {
  setBusy(true);
  try {
    await loadAuthConfig();
    const params = new URLSearchParams(window.location.search);
    const oauthCode = params.get("oauth_code");
    const oauthError = params.get("oauth_error");
    if (oauthError) {
      state.error = `OAuth 登录失败：${oauthError}`;
    } else if (oauthCode) {
      const result = await api.oauthComplete(oauthCode);
      setSessionToken(result.token);
      state.user = result.user;
      setToast(`欢迎，${result.user.displayName || "玩家"}`);
      cleanUrl();
    }
    if (params.get("auth") === "login") state.view = "auth";
    const joinCode = normalizeInviteCode(params.get("join") || params.get("invite") || "");
    if (joinCode) {
      state.inviteCode = joinCode;
      state.view = "join";
    }
    if (state.roomId && !isUuid(state.roomId)) persistRoom("");
    await ensureSession();
    if (joinCode) {
      await handleLookupInvite({ silent: true });
    } else if (state.roomId) {
      await refreshHome();
    }  } catch (error) {
    state.error = error.message || "加载失败";
    if (error.status === 401 || error.status === 403) {
      clearSession();
      persistRoom("");
    }
  } finally {
    setBusy(false);
    render();
  }
}

async function handleLookupInvite({ silent = false } = {}) {
  const code = normalizeInviteCode(state.inviteCode);
  if (!code) return silent ? undefined : setToast("请输入邀请码");
  setBusy(true);
  try {
    await ensureSession();
    state.joinPreview = await api.lookupInvite(code);
    state.inviteCode = code;
    state.selectedRoleId =
      state.joinPreview.roles.find((r) => !r.occupied || r.occupied_by_current)?.id || "";
    state.view = "join";
    render();
  } catch (error) {
    state.joinPreview = null;
    if (!silent) setToast(error.message || "邀请码无效");
    else state.error = error.message || "邀请码无效";
  } finally {
    setBusy(false);
  }
}
async function handleJoinRoom() {
  const code = normalizeInviteCode(state.inviteCode);
  if (!code || !state.selectedRoleId) return setToast("请选择角色");  setBusy(true);
  try {
    await ensureSession();
    const result = await api.joinRoom(code, state.selectedRoleId);
    persistRoom(result.roomId);
    state.joinPreview = null;
    cleanUrl();
    await refreshHome();
    setToast("已加入房间");
  } catch (error) {
    setToast(error.message || "加入失败");
  } finally {
    setBusy(false);
    render();
  }
}

async function handleCompleteSection(sectionId) {
  setBusy(true);
  try {
    await api.completeSection(state.roomId, sectionId);
    await refreshHome();
    setToast("已标记阅读完成");
  } catch (error) {
    setToast(error.message || "操作失败");
  } finally {
    setBusy(false);
  }
}

async function handleInvestigate(pointId) {
  setBusy(true);
  try {
    const result = await api.investigate(state.roomId, pointId);
    await refreshHome();
    state.exploration = await api.exploration(state.roomId);
    setToast(result.clue ? `获得线索：${result.clue.name}` : "调查完成");
    render();
  } catch (error) {
    setToast(error.message || "调查失败");
  } finally {
    setBusy(false);
  }
}

async function handleReadClue(clueId) {
  setBusy(true);
  try {
    await api.readClue(state.roomId, clueId);
    await refreshHome();
    state.clueId = clueId;
    render();
  } catch (error) {
    setToast(error.message || "无法阅读线索");
  } finally {
    setBusy(false);
  }
}

async function handleAuthSubmit(form) {
  const email = form.email.value.trim();
  const password = form.password.value;
  const displayName = form.displayName?.value?.trim() || "";
  setBusy(true);
  try {
    let result;
    if (state.authMode === "register") {
      result = await api.register(email, displayName, password);
      if (result.pendingEmailVerification && !result.token) {
        setToast(result.message || "注册成功，请先验证邮箱后再登录");
        state.authMode = "login";
        render();
        return;
      }
    } else {      result = await api.login(email, password);
    }
    setSessionToken(result.token);
    state.user = result.user;
    state.view = state.roomId ? "game" : "landing";
    cleanUrl();
    if (state.roomId) await refreshHome();
    setToast(`欢迎，${result.user.displayName || result.user.email || "玩家"}`);
  } catch (error) {
    setToast(error.message || "登录失败");
  } finally {
    setBusy(false);
  }
}

async function handleOAuth(provider) {
  if (!ALLOWED_OAUTH_PROVIDERS.has(provider)) {
    setToast("不支持的登录方式");
    return;
  }
  setBusy(true);
  try {
    await ensureSession();
    const { url } = await api.oauthStartUrl(provider, getPlayOrigin());
    if (!isSafeOAuthRedirectUrl(url)) {
      throw new Error("OAuth 跳转地址无效");
    }
    window.location.assign(url);
  } catch (error) {
    setToast(error.message || "OAuth 暂不可用");
    setBusy(false);
  }
}
function handleLogout() {
  clearSession();
  persistRoom("");
  state.home = null;
  state.user = null;
  state.view = "landing";
  render();
  ensureSession().catch(() => {});
}

function renderHeader() {
  const appOrigin = getAppOrigin();
  const roleName = state.home?.role?.name || "";
  const roomName = state.home?.room?.name || "";
  return `
    <header class="play-header">
      <a class="brand" href="/">
        <span class="brand-mark">织</span>
        <span><strong>织幕</strong><small>玩家端</small></span>
      </a>
      <div class="header-meta">
        ${roomName ? `<span class="pill">${escapeHtml(roomName)}</span>` : ""}
        ${roleName ? `<span class="pill accent">${escapeHtml(roleName)}</span>` : ""}
      </div>
      <div class="header-actions">
        <a class="link-btn quiet" href="${appOrigin}/" target="_blank" rel="noopener">创作者入口</a>
        ${getSessionToken() ? `<button class="link-btn quiet" type="button" data-action="logout">退出</button>` : ""}
      </div>
    </header>`;
}

function renderLanding() {
  return `
    <section class="hero-panel">
      <p class="eyebrow">PLAYER · 纯玩家视角</p>
      <h1>输入邀请码，进入你的角色世界</h1>
      <p class="lede">无需创作台与主持工具。加入平行房后，在这里阅读分幕、探索场景、查看线索与背包。</p>
      <div class="join-card">
        <label class="field-label" for="invite-input">房间邀请码</label>
        <div class="join-row">
          <input id="invite-input" class="field" type="text" placeholder="例如：ABC123" value="${escapeHtml(state.inviteCode)}" data-bind="inviteCode" autocomplete="off" />
          <button class="btn primary" type="button" data-action="lookup-invite" ${state.busy ? "disabled" : ""}>查找房间</button>
        </div>
        <p class="hint">主持人会在开团前分享邀请码。你也可以通过链接直接进入：<code>?join=邀请码</code></p>
      </div>
      <div class="hero-actions">
        <button class="btn outline" type="button" data-action="show-auth">登录 / 注册</button>
        <button class="btn quiet" type="button" data-action="guest-continue" ${state.busy ? "disabled" : ""}>以访客继续</button>
      </div>
    </section>`;
}

function renderJoin() {
  const preview = state.joinPreview;
  if (!preview) {
    return renderLanding();
  }
  const roles = preview.roles || [];
  return `
    <section class="panel">
      <p class="eyebrow">加入房间</p>
      <h2>${escapeHtml(preview.room.name)}</h2>
      <p class="muted">世界 · ${escapeHtml(preview.world.name)}</p>
      <div class="role-grid">
        ${roles.map((role) => {
          const disabled = role.occupied && !role.occupied_by_current;
          const selected = state.selectedRoleId === role.id;
          return `
            <button type="button" class="role-card ${selected ? "is-selected" : ""}" data-action="pick-role" data-role-id="${role.id}" ${disabled ? "disabled" : ""}>
              <strong>${escapeHtml(role.name)}</strong>
              <span>${disabled ? "已被占用" : role.occupied_by_current ? "你的当前角色" : "可选"}</span>
              ${role.public_profile ? `<p>${escapeHtml(role.public_profile)}</p>` : ""}
            </button>`;
        }).join("")}
      </div>
      <div class="row-actions">
        <button class="btn primary" type="button" data-action="confirm-join" ${state.busy ? "disabled" : ""}>确认加入</button>
        <button class="btn quiet" type="button" data-action="back-landing">返回</button>
      </div>
    </section>`;
}

function renderAuth() {
  const oauth = state.authConfig?.oauth || [];
  const isRegister = state.authMode === "register";
  return `
    <section class="panel narrow">
      <p class="eyebrow">账号</p>
      <h2>${isRegister ? "注册织幕账号" : "登录织幕账号"}</h2>
      <form class="auth-form" data-form="auth">
        ${isRegister ? `
          <label>显示名称
            <input class="field" name="displayName" type="text" minlength="2" maxlength="40" required placeholder="你在房间里的称呼" />
          </label>` : ""}
        <label>邮箱
          <input class="field" name="email" type="email" autocomplete="email" required />
        </label>
        <label>密码
          <input class="field" name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" minlength="8" required />
        </label>
        <button class="btn primary" type="submit" ${state.busy ? "disabled" : ""}>${isRegister ? "注册" : "登录"}</button>
      </form>
      ${oauth.length ? `
        <div class="oauth-row">
          ${oauth.map((p) => `<button class="btn outline" type="button" data-action="oauth" data-provider="${p.id}">${escapeHtml(p.label)} 登录</button>`).join("")}
        </div>` : ""}
      <button class="text-btn" type="button" data-action="toggle-auth-mode">
        ${isRegister ? "已有账号？去登录" : "没有账号？去注册"}
      </button>
      <button class="text-btn" type="button" data-action="back-landing">返回首页</button>
    </section>`;
}

function renderSections() {
  const sections = state.home?.sections || [];
  const active = sections.find((s) => s.id === state.sectionId) || sections[0];
  if (!sections.length) {
    return `<div class="empty">主持人尚未向你的角色发放可读分幕。</div>`;
  }
  const nav = sections.map((section) => `
    <button type="button" class="section-tab ${section.id === active?.id ? "is-active" : ""} ${section.completed ? "is-done" : ""}" data-action="pick-section" data-section-id="${section.id}">
      <span>${section.sequence}. ${escapeHtml(section.title)}</span>
      ${section.completed ? "<em>已完成</em>" : ""}
    </button>`).join("");
  const body = active?.body || "";
  const pages = active?.pages || [];
  return `
    <div class="sections-layout">
      <nav class="section-nav">${nav}</nav>
      <article class="reader card">
        <header>
          <p class="eyebrow">分幕 ${active?.sequence ?? ""}</p>
          <h3>${escapeHtml(active?.title || "")}</h3>
        </header>
        <div class="story-body">${escapeHtml(body).replace(/\n/g, "<br>")}</div>
        ${pages.length ? `<div class="story-pages">${pages.map((page) => {
          const src = sanitizeImageUrl(page.url);
          if (!src) return "";
          return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(page.filename || page.caption || active.title)}" loading="lazy" referrerpolicy="no-referrer" /><figcaption>${escapeHtml(page.filename || page.caption || "")}</figcaption></figure>`;
        }).filter(Boolean).join("")}</div>` : ""}
        ${active && !active.completed ? `<button class="btn primary" type="button" data-action="complete-section" data-section-id="${active.id}" ${state.busy ? "disabled" : ""}>标记阅读完成</button>` : active?.completed ? `<p class="done-note">✓ 已完成阅读</p>` : ""}
      </article>
    </div>`;
}

function renderClues() {
  const owned = state.home?.clues || [];
  const shared = state.home?.sharedClues || [];
  const all = [...owned, ...shared.filter((c) => !owned.some((o) => o.id === c.id))];
  if (!all.length) return `<div class="empty">还没有获得线索。完成阅读或探索场景后，线索会出现在这里。</div>`;
  const active = all.find((c) => c.id === state.clueId) || all[0];
  const list = all.map((clue) => `
    <button type="button" class="list-item ${clue.id === active?.id ? "is-active" : ""}" data-action="pick-clue" data-clue-id="${clue.id}">
      <strong>${escapeHtml(clue.name)}</strong>
      ${clue.read_at ? "<span>已读</span>" : '<span class="tag">未读</span>'}
    </button>`).join("");
  return `
    <div class="split-layout">
      <div class="list">${list}</div>
      <article class="card detail">
        <h3>${escapeHtml(active?.name || "")}</h3>
        <p>${escapeHtml(active?.public_text || active?.private_text || "加载中…")}</p>
        ${active && !active.read_at ? `<button class="btn outline" type="button" data-action="read-clue" data-clue-id="${active.id}" ${state.busy ? "disabled" : ""}>标记已读</button>` : ""}
      </article>
    </div>`;
}

function renderExploration() {
  const scenes = state.exploration?.scenes || [];
  if (!scenes.length) {
    return `<div class="empty">当前还没有开放探索场景。完成分幕阅读后，主持人可能会解锁新地点。</div>`;
  }
  return scenes.map((scene) => `
    <article class="card scene-card">
      <header>
        <p class="eyebrow">场景</p>
        <h3>${escapeHtml(scene.name)}</h3>
      </header>
      <p>${escapeHtml(scene.public_text || "")}</p>
      <div class="point-list">
        ${asArray(scene.investigation_points).map((point) => `
          <div class="point-row">
            <div>
              <strong>${escapeHtml(point.name)}</strong>
              <p>${escapeHtml(point.description || "")}</p>
              ${point.requiredItemName ? `<span class="tag">需要：${escapeHtml(point.requiredItemName)}</span>` : ""}
            </div>
            <button class="btn ${point.investigated ? "quiet" : "outline"}" type="button"
              data-action="investigate" data-point-id="${point.id}"
              ${point.investigated || !point.hasRequiredItem || state.busy ? "disabled" : ""}>
              ${point.investigated ? "已调查" : "调查"}
            </button>
          </div>`).join("")}
      </div>
    </article>`).join("");
}

function renderInventory() {
  const items = state.home?.inventory || [];
  if (!items.length) return `<div class="empty">背包是空的。</div>`;
  return `
    <div class="inventory-grid">
      ${items.map((item) => `
        <article class="card inventory-item">
          <strong>${escapeHtml(item.name)}</strong>
          <span>× ${item.quantity}</span>
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
        </article>`).join("")}
    </div>`;
}

function renderGame() {
  const role = state.home?.role;
  const tabs = [
    ["sections", "分幕"],
    ["explore", "探索"],
    ["clues", "线索"],
    ["inventory", "背包"]
  ];
  let body = "";
  if (state.tab === "sections") body = renderSections();
  else if (state.tab === "explore") body = renderExploration();
  else if (state.tab === "clues") body = renderClues();
  else body = renderInventory();

  return `
    <section class="game-shell">
      <aside class="role-card-side card">
        <p class="eyebrow">你的角色</p>
        <h2>${escapeHtml(role?.name || "未选择")}</h2>
        <p>${escapeHtml(role?.private_profile || role?.public_profile || "暂无角色资料")}</p>
        <button class="btn quiet full" type="button" data-action="leave-room">离开房间</button>
      </aside>
      <div class="game-main">
        <nav class="tab-bar">
          ${tabs.map(([id, label]) => `<button type="button" class="tab ${state.tab === id ? "is-active" : ""}" data-action="switch-tab" data-tab="${id}">${label}</button>`).join("")}
        </nav>
        <div class="tab-body">${body}</div>
      </div>
    </section>`;
}

function render() {
  let main = "";
  if (state.view === "auth") main = renderAuth();
  else if (state.view === "join") main = renderJoin();
  else if (state.view === "game" && state.home) main = renderGame();
  else main = renderLanding();

  app.innerHTML = `
    ${renderHeader()}
    <main class="play-main">
      ${state.error ? `<div class="banner error">${escapeHtml(state.error)}<button type="button" data-action="dismiss-error">×</button></div>` : ""}
      ${state.busy && state.view === "game" ? `<div class="loading-bar" aria-hidden="true"></div>` : ""}
      ${main}
    </main>
    ${state.toast ? `<div class="toast" role="status">${escapeHtml(state.toast)}</div>` : ""}
  `;
}

app.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset.bind === "inviteCode") state.inviteCode = target.value;
});

app.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-form='auth']");
  if (!form) return;
  event.preventDefault();
  handleAuthSubmit(form);
});

app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (state.busy && button.dataset.action !== "dismiss-error") return;
  const action = button.dataset.action;
  switch (action) {
    case "lookup-invite":
      await handleLookupInvite();
      break;
    case "confirm-join":
      await handleJoinRoom();
      break;
    case "pick-role":
      state.selectedRoleId = button.dataset.roleId;
      render();
      break;
    case "pick-section":
      state.sectionId = button.dataset.sectionId;
      render();
      break;
    case "pick-clue":
      state.clueId = button.dataset.clueId;
      render();
      break;
    case "complete-section":
      await handleCompleteSection(button.dataset.sectionId);
      break;
    case "read-clue":
      await handleReadClue(button.dataset.clueId);
      break;
    case "investigate":
      await handleInvestigate(button.dataset.pointId);
      break;
    case "switch-tab":
      state.tab = button.dataset.tab;
      render();
      break;
    case "show-auth":
      state.view = "auth";
      render();
      break;
    case "toggle-auth-mode":
      state.authMode = state.authMode === "login" ? "register" : "login";
      render();
      break;
    case "back-landing":
      state.view = "landing";
      state.joinPreview = null;
      render();
      break;
    case "guest-continue":
      await ensureSession();
      setToast("已以访客身份就绪，输入邀请码即可加入");
      break;
    case "oauth":
      await handleOAuth(button.dataset.provider);
      break;
    case "logout":
      handleLogout();
      break;
    case "leave-room":
      persistRoom("");
      state.home = null;
      state.view = "landing";
      render();
      break;
    case "dismiss-error":
      state.error = "";
      render();
      break;
    default:
      break;
  }
});

bootstrap();
