/**
 * Shared client-side security guards — used by main app, play, host.
 * Canonical home for escapeHtml / isUuid / OAuth validators / image sanitizers.
 *
 * Each frontend imports this via relative path (or Vite alias `shared`).
 * Pure functions only — no DOM access, no side effects.
 */

export function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeImageUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return "";
    return parsed.href;
  } catch {
    return "";
  }
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

export function normalizeInviteCode(code) {
  return String(code || "").trim().slice(0, 64);
}

export const ALLOWED_OAUTH_PROVIDERS = new Set(["google", "github"]);

const OAUTH_AUTHORIZE_HOSTS = new Set(["accounts.google.com", "github.com"]);

export function isSafeOAuthRedirectUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    return OAUTH_AUTHORIZE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
