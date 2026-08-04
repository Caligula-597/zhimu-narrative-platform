/**
 * Ops domain — operator status, audit log, plan management, test alerts.
 */
import { opsRequest, opsToken, request } from "./client.js";

export function setOpsToken(token) {
  const value = String(token || "").trim();
  if (value) sessionStorage.setItem("zhimuOpsToken", value);
  else sessionStorage.removeItem("zhimuOpsToken");
}

export function hasOpsToken() {
  return Boolean(opsToken());
}

export function getOpsStatus() {
  return opsRequest("/ops/status");
}

export function getOpsAuditLog(params = {}) {
  const query = new URLSearchParams();
  if (params.roomId) query.set("roomId", params.roomId);
  if (params.action) query.set("action", params.action);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  const qs = query.toString();
  return opsRequest(`/ops/audit-log${qs ? `?${qs}` : ""}`);
}

export function getOpsPlanUpgradeRequests(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return opsRequest(`/ops/plan-upgrade/requests${qs ? `?${qs}` : ""}`);
}

export function getOpsFeedback(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.kind) query.set("kind", params.kind);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  const qs = query.toString();
  return opsRequest(`/ops/feedback${qs ? `?${qs}` : ""}`);
}

export function getOpsFeedbackStats() {
  return opsRequest("/ops/feedback/stats");
}

export function updateOpsFeedbackStatus(id, status) {
  return opsRequest(`/ops/feedback/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { status }
  });
}

export function assignOpsPlan(payload) {
  return opsRequest("/ops/users/plan", { method: "POST", body: payload });
}

export function getOpsUsers(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.verification && params.verification !== "all") {
    query.set("verification", params.verification);
  }
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  const qs = query.toString();
  return opsRequest(`/ops/users${qs ? `?${qs}` : ""}`);
}

export function previewOpsUserDelete(userId) {
  return opsRequest(`/ops/users/${encodeURIComponent(userId)}/delete-preview`);
}

export function resendOpsUserVerification(userId) {
  return opsRequest(`/ops/users/${encodeURIComponent(userId)}/resend-verification`, {
    method: "POST",
    body: {}
  });
}

export function deleteOpsUserAccount(userId, payload) {
  return opsRequest(`/ops/users/${encodeURIComponent(userId)}/delete`, {
    method: "POST",
    body: payload
  });
}

export function sendOpsTestAlert() {
  return opsRequest("/ops/alerts/test", { method: "POST", body: {} });
}

/** opsRequest re-export for ops-only callers that need raw access. */
export { opsRequest, opsToken, request };
