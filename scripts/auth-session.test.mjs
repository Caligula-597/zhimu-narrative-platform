/**
 * auth-session UX — migrated from vm.runInNewContext to dynamic import().
 * auth-session.js now uses `import * as zhimuApi`, which vm cannot handle.
 *
 * Strategy: mock fetch("/api/auth/me") to return a test user, load the module
 * via dynamic import(), then call window.zhimuAuthSession.syncProfile().
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ── Browser global shims ── */
const noop = () => {};

function createNode() {
  return {
    hidden: false,
    textContent: "",
    className: "",
    dataset: {},
    querySelector(selector) {
      return this.children?.[selector] || null;
    },
    children: {}
  };
}

let cookieSessionActive = false;
let renders = 0;
const state = { currentUser: null };

const banner = createNode();
banner.children["[data-session-pill]"] = createNode();
banner.children["[data-session-title]"] = createNode();
banner.children["[data-session-desc]"] = createNode();
banner.children["#auth-banner-login"] = createNode();

const profile = createNode();
profile.children.strong = createNode();
profile.children.small = createNode();
profile.children[".avatar"] = createNode();

globalThis.window = {
  zhimuState: state,
  zhimuSessionAuth: {
    isAuthenticated: () => cookieSessionActive,
    markAuthenticated: () => { cookieSessionActive = true; },
    legacyToken: () => null,
    markLoggedOut: () => { cookieSessionActive = false; }
  },
  zhimuSessionMode: {
    getSessionMode: () => state.currentUser?.id || cookieSessionActive ? "authenticated" : "auth_required",
    getSessionModeMeta: () => ({
      mode: state.currentUser?.id || cookieSessionActive ? "authenticated" : "auth_required",
      showTopBanner: !(state.currentUser?.id || cookieSessionActive),
      showLoginCta: true,
      pill: "未登录",
      pillClass: "session-auth",
      title: "请登录后继续使用",
      description: "登录后可保存剧本",
      profileFallback: { strong: "未登录", small: "点击登录或注册", avatar: "?" }
    })
  },
  zhimuRender: () => { renders += 1; },
  zhimuRuntime: {},
  zhimuConfig: { requireAuth: true },
  localStorage: { getItem: () => null, setItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {} },
  addEventListener: noop,
  removeEventListener: noop
};

globalThis.document = {
  getElementById: (id) => id === "auth-banner" ? banner : null,
  querySelector: (selector) => selector === ".profile" ? profile : null,
  addEventListener: noop,
  removeEventListener: noop
};
globalThis.localStorage = globalThis.window.localStorage;
globalThis.sessionStorage = globalThis.window.sessionStorage;
const navShim = { userAgent: "node-test" };
try { globalThis.navigator = navShim; } catch { Object.defineProperty(globalThis, "navigator", { value: navShim, writable: true, configurable: true }); }

/* ── Fetch mock: /api/auth/me returns test user ── */
const testUser = {
  id: "user-1",
  email: "creator@example.com",
  display_name: "Creator",
  isGuest: false
};
globalThis.fetch = async (url) => {
  const urlStr = String(url);
  if (urlStr === "/api/auth/me" || urlStr.startsWith("/api/auth/me?")) {
    return { ok: true, status: 200, json: async () => testUser };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};

/* ── Module handle ── */
let zhimuAuthSession;

test.before(async () => {
  const fileUrl = (rel) => `file://${path.join(root, rel).replace(/\\/g, "/")}?t=${Date.now()}`;
  await import(fileUrl("src/runtime/auth-session.js"));
  // 等 client.js 的 zhimuSessionReady IIFE 完成，避免干扰测试
  if (globalThis.window.zhimuSessionReady) {
    try { await globalThis.window.zhimuSessionReady; } catch { /* fetch mock 可能被 IIFE 调用 */ }
  }
  zhimuAuthSession = globalThis.window.zhimuAuthSession;
  if (!zhimuAuthSession) throw new Error("zhimuAuthSession bridge not populated");
});

test.beforeEach(() => {
  cookieSessionActive = false;
  renders = 0;
  state.currentUser = null;
  banner.hidden = false;
  for (const n of Object.values(banner.children)) {
    n.textContent = "";
    n.className = "";
    n.hidden = false;
  }
  for (const n of Object.values(profile.children)) {
    n.textContent = "";
  }
});

test("syncProfile upgrades stale unauthenticated UI and rerenders content", async () => {
  await zhimuAuthSession.syncProfile();

  assert.equal(state.currentUser.id, "user-1");
  assert.equal(cookieSessionActive, true);
  assert.equal(profile.children.strong.textContent, "Creator");
  assert.equal(profile.children.small.textContent, "creator@example.com");
  assert.equal(banner.hidden, true);
  assert.equal(renders, 1);
});
