/**
 * Auth + account domain — register, login, OAuth, sessions, account lifecycle.
 */
import { request, markSessionFromResponse, demoContext } from "./client.js";

const sessionAuth = () => window.zhimuSessionAuth || {};

export function register(payload) {
  return request("/auth/register", { method: "POST", body: payload });
}

export function login(payload) {
  return request("/auth/login", { method: "POST", body: payload });
}

export function createGuest(payload = {}) {
  return request("/auth/guest", { method: "POST", body: payload });
}

export function completeOAuth(code) {
  return request("/auth/oauth/complete", { method: "POST", body: { code } });
}

export function oauthStartUrl(provider) {
  return request(`/auth/oauth/${provider}/start-url`, { method: "POST", body: {} });
}

export function upgradeGuest(payload) {
  return request("/auth/upgrade", { method: "POST", body: payload });
}

export function listSessions() {
  return request("/auth/sessions");
}

export function revokeSession(sessionId) {
  return request(`/auth/sessions/${sessionId}`, { method: "DELETE" });
}

export function logoutAllDevices() {
  return request("/auth/logout-all", { method: "POST", body: {} });
}

export function getAuthConfig() {
  return request("/auth/config");
}

export function verifyEmail(payload) {
  return request("/auth/verify-email", { method: "POST", body: payload });
}

export function resendVerification() {
  return request("/auth/resend-verification", { method: "POST", body: {} });
}

export function requestPasswordReset(payload) {
  return request("/auth/forgot-password", { method: "POST", body: payload });
}

export function resetPassword(payload) {
  return request("/auth/reset-password", { method: "POST", body: payload });
}

export function me() {
  return request("/auth/me");
}

export async function logout() {
  const result = await request("/auth/logout", { method: "POST", body: {} });
  sessionAuth().markLoggedOut?.();
  return result;
}

export async function ensurePlayerSession() {
  if (sessionAuth().isAuthenticated?.()) return null;
  const result = await createGuest({});
  markSessionFromResponse(result);
  return result;
}

/* ── Account ── */

export function getAccountEntitlements() {
  return request("/account/entitlements");
}

export function exportAccountData() {
  return request("/account/export");
}

export function submitPlanUpgradeRequest(payload) {
  return request("/account/plan-upgrade-request", { method: "POST", body: payload });
}

export function previewAccountDelete() {
  return request("/account/delete/preview");
}

export function deleteAccount(payload) {
  return request("/account/delete", { method: "POST", body: payload });
}

export function getAccountPlans() {
  return request("/account/plans");
}

export { demoContext };
