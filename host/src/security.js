export function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
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
