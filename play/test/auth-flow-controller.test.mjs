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

test("pending email verification does not persist an empty token", async () => {
  const api = { register: async () => ({ pendingEmailVerification: true, message: "请验证邮箱" }) };
  const { controller, state, calls } = setup(api);
  state.authMode = "register";
  await controller.handleAuthSubmit({
    email: { value: "a@example.com" }, password: { value: "pw" }, displayName: { value: "A" }
  });
  assert.equal(state.authMode, "login");
  assert.equal(calls.some((call) => call[0] === "token"), false);
});

test("unsupported OAuth provider is rejected before network access", async () => {
  const { controller, calls } = setup({});
  await controller.handleOAuth("unknown");
  assert.deepEqual(calls[0], ["toast", "不支持的登录方式"]);
});
