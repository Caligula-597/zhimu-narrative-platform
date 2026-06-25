/** OAuth provider configuration (Google / GitHub). */
export const OAUTH_PROVIDERS = {
  google: {
    id: "google",
    label: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile"]
  },
  github: {
    id: "github",
    label: "GitHub",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    profileUrl: "https://api.github.com/user",
    emailUrl: "https://api.github.com/user/emails",
    scopes: ["read:user", "user:email"]
  }
};

function env(name) {
  return process.env[name]?.trim() || "";
}

export function oauthProviderConfig(providerId) {
  const provider = OAUTH_PROVIDERS[providerId];
  if (!provider) return null;
  const upper = providerId.toUpperCase();
  const clientId = env(`${upper}_CLIENT_ID`);
  const clientSecret = env(`${upper}_CLIENT_SECRET`);
  if (!clientId || !clientSecret) return null;
  return { ...provider, clientId, clientSecret };
}

export function listEnabledOAuthProviders() {
  return Object.keys(OAUTH_PROVIDERS)
    .map((id) => oauthProviderConfig(id))
    .filter(Boolean)
    .map(({ id, label }) => ({ id, label }));
}

export function appPublicOrigin() {
  const raw = env("APP_PUBLIC_URL") || env("CORS_ORIGIN")?.split(",")[0] || "http://localhost:4173";
  return raw.replace(/\/$/, "");
}

export function oauthCallbackUrl(providerId) {
  const origin = env("OAUTH_CALLBACK_ORIGIN") || appPublicOrigin();
  return `${origin.replace(/\/$/, "")}/api/auth/oauth/${providerId}/callback`;
}

export function oauthFrontendReturnUrl() {
  return `${appPublicOrigin()}/`;
}

function parseOriginList(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeOrigin(raw) {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function allowedOAuthReturnOrigins() {
  const allowed = new Set();
  for (const key of ["APP_PUBLIC_URL", "CORS_ORIGIN", "MARKETING_SITE_ORIGIN", "PLAY_SITE_ORIGIN", "HOST_SITE_ORIGIN"]) {
    for (const entry of parseOriginList(process.env[key]?.trim())) {
      const origin = normalizeOrigin(entry);
      if (origin) allowed.add(origin);
    }
  }
  const fallback = normalizeOrigin(oauthFrontendReturnUrl());
  if (fallback) allowed.add(fallback);
  return allowed;
}

export function resolveOAuthReturnOrigin(requested) {
  if (!requested?.trim()) return oauthFrontendReturnUrl();
  const origin = normalizeOrigin(requested.trim());
  if (!origin || !allowedOAuthReturnOrigins().has(origin)) return oauthFrontendReturnUrl();
  return `${origin}/`;
}
