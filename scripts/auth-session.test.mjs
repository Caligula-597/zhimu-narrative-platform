import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function stripEsmExport(source) {
  return source.replace(/\nexport\s*\{\s*\}\s*;?\s*$/, "");
}

function readModule(rel) {
  return stripEsmExport(fs.readFileSync(path.join(root, rel), "utf8"));
}

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

test("syncProfile upgrades stale unauthenticated UI and rerenders content", async () => {
  const banner = createNode();
  banner.children["[data-session-pill]"] = createNode();
  banner.children["[data-session-title]"] = createNode();
  banner.children["[data-session-desc]"] = createNode();
  banner.children["#auth-banner-login"] = createNode();

  const profile = createNode();
  profile.children.strong = createNode();
  profile.children.small = createNode();
  profile.children[".avatar"] = createNode();

  let cookieSessionActive = false;
  let renders = 0;
  const state = { currentUser: null };
  const sandbox = {
    window: {
      zhimuState: state,
      zhimuApi: {
        me: async () => ({
          id: "user-1",
          email: "creator@example.com",
          display_name: "Creator",
          isGuest: false
        })
      },
      zhimuSessionAuth: {
        isAuthenticated: () => cookieSessionActive,
        markAuthenticated: () => {
          cookieSessionActive = true;
        },
        legacyToken: () => null,
        markLoggedOut: () => {
          cookieSessionActive = false;
        }
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
      zhimuRender: () => {
        renders += 1;
      },
      zhimuRuntime: {},
      zhimuConfig: { requireAuth: true }
    },
    document: {
      getElementById: (id) => id === "auth-banner" ? banner : null,
      querySelector: (selector) => selector === ".profile" ? profile : null
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {}
    }
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.sessionStorage = sandbox.sessionStorage;

  vm.runInNewContext(readModule("src/runtime/auth-session.js"), sandbox);
  await sandbox.window.zhimuAuthSession.syncProfile();

  assert.equal(state.currentUser.id, "user-1");
  assert.equal(cookieSessionActive, true);
  assert.equal(profile.children.strong.textContent, "Creator");
  assert.equal(profile.children.small.textContent, "creator@example.com");
  assert.equal(banner.hidden, true);
  assert.equal(renders, 1);
});
