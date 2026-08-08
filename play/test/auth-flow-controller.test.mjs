import assert from "node:assert/strict";
import test from "node:test";
import { createAuthFlowController } from "../src/runtime/auth-flow-controller.js";

function setup(api, overrides = {}) {
  const calls = [];
  const state = { authMode: "login" };
  const controller = createAuthFlowController({
    api, state, render() {}, setBusy: (value) => calls.push(["busy", value]),
    setToast: (message) => calls.push(["toast", message]),
    formatApiError: (_error, fallback) => fallback,
    setSessionToken: (token) => calls.push(["token", token]), clearSession() {}, cleanAuthUrl() {},
    normalizeUser: (user) => ({ ...user, displayName: user.displayName || user.email }),
    refreshHome: async () => {}, handleLookupInvite: async () => {}, syncPlatformStream() {},
    ensureSession: async () => {}, getPlayOrigin: () => "https://play.example.com",
    isSafeOAuthRedirectUrl: () => true, allowedOAuthProviders: new Set(["google"]),
    resetVoiceOnLeave: async () => {}, disconnectRoomEvents() {}, disconnectPlatformEvents() {},
    roomEventCtx: {}, platformEventCtx: {}, persistRoom() {}, isUuid: () => true,
    windowRef: { location: { assign() {} } }, random: () => 0,
    ...overrides
  });
  return { controller, state, calls };
}

test("login stores session and normalized user", async () => {
  const api = { login: async () => ({ token: "token-1", user: { email: "a@example.com" } }) };
  const { controller, state, calls } = setup(api);
  await controller.handleAuthSubmit({ email: { value: " a@example.com " }, password: { value: "pw" } });
  assert.equal(state.user.displayName, "a@example.com");
  assert.ok(calls.some((call) => call[0] === "token" && call[1] === "token-1"));
  assert.deepEqual(calls.filter((call) => call[0] === "busy").map((call) => call[1]), [true, false]);
});

test("cookie-only login clears a stale bearer fallback and keeps the normalized user", async () => {
  const api = { login: async () => ({ user: { id: "user-1", email: "cookie@example.com" } }) };
  const { controller, state, calls } = setup(api);
  await controller.handleAuthSubmit({
    email: { value: "cookie@example.com" },
    password: { value: "password-123" }
  });
  assert.equal(state.user.id, "user-1");
  assert.ok(calls.some((call) => call[0] === "token" && call[1] === undefined));
});

test("pending email verification opens the six-digit challenge without persisting an empty token", async () => {
  const challenge = {
    id: "be36d9de-63e8-4c7b-96a3-b13ad19bb0ef",
    maskedEmail: "a**@example.com"
  };
  const api = {
    register: async () => ({
      pendingEmailVerification: true,
      verificationEmailSent: true,
      verificationChallenge: challenge
    })
  };
  const { controller, state, calls } = setup(api);
  state.authMode = "register";
  await controller.handleAuthSubmit({
    email: { value: "a@example.com" }, password: { value: "pw" }, displayName: { value: "A" }
  });
  assert.equal(state.authMode, "verify");
  assert.equal(state.pendingVerificationEmail, "a@example.com");
  assert.deepEqual(state.pendingVerificationChallenge, challenge);
  assert.equal(calls.some((call) => call[0] === "token"), false);
});

test("correct verification code stores the new session and exits verification", async () => {
  const api = {
    verifyEmailCode: async () => ({
      token: "verified-token",
      user: { email: "a@example.com", emailVerified: true }
    })
  };
  const { controller, state, calls } = setup(api);
  state.authMode = "verify";
  state.pendingVerificationChallenge = {
    id: "be36d9de-63e8-4c7b-96a3-b13ad19bb0ef"
  };
  await controller.handleVerificationSubmit({ code: { value: "123456" } });
  assert.equal(state.pendingVerificationChallenge, null);
  assert.ok(calls.some((call) => call[0] === "token" && call[1] === "verified-token"));
});

test("unsupported OAuth provider is rejected before network access", async () => {
  const { controller, calls } = setup({});
  await controller.handleOAuth("unknown");
  assert.deepEqual(calls[0], ["toast", "不支持的登录方式"]);
});

test("logout revokes the backend session before clearing local state", async () => {
  const order = [];
  const { controller, state } = setup(
    { logout: async () => { order.push("remote"); } },
    {
      clearSession: () => order.push("local"),
      resetVoiceOnLeave: async () => order.push("voice")
    }
  );
  state.user = { id: "user-1" };
  await controller.handleLogout();
  assert.deepEqual(order, ["remote", "voice", "local"]);
  assert.equal(state.user, null);
  assert.equal(state.view, "landing");
});

test("logout keeps the visible session when the server cannot revoke it", async () => {
  let cleared = false;
  const { controller, state, calls } = setup(
    { logout: async () => { throw Object.assign(new Error("offline"), { status: 503 }); } },
    { clearSession: () => { cleared = true; } }
  );
  state.user = { id: "user-1" };
  await controller.handleLogout();
  assert.equal(cleared, false);
  assert.equal(state.user.id, "user-1");
  assert.ok(calls.some(([kind, message]) => kind === "toast" && message.includes("退出登录失败")));
});
