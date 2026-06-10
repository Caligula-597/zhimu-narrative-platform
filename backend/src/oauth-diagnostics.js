/**
 * OAuth readiness diagnostics — callback URLs, env gaps, production HTTPS checks.
 */
import {
  OAUTH_PROVIDERS,
  appPublicOrigin,
  oauthCallbackUrl,
  oauthFrontendReturnUrl,
  oauthProviderConfig
} from "./oauth-providers.js";

function pushIssue(bucket, code, message) {
  bucket.push({ code, message });
}

export function getOAuthDiagnostics() {
  const publicUrl = appPublicOrigin();
  const callbackOrigin = (process.env.OAUTH_CALLBACK_ORIGIN || publicUrl || "").replace(/\/$/, "");
  const globalIssues = [];

  if (!publicUrl) {
    pushIssue(globalIssues, "APP_PUBLIC_URL_MISSING", "APP_PUBLIC_URL is required for OAuth redirect and login completion.");
  } else if ((process.env.NODE_ENV ?? "development") === "production" && !publicUrl.startsWith("https://")) {
    pushIssue(globalIssues, "APP_PUBLIC_URL_NOT_HTTPS", "Production APP_PUBLIC_URL should use HTTPS.");
  }

  if (process.env.OAUTH_CALLBACK_ORIGIN?.trim() && publicUrl) {
    try {
      const cb = new URL(callbackOrigin);
      const pub = new URL(publicUrl);
      if (cb.origin !== pub.origin) {
        pushIssue(
          globalIssues,
          "OAUTH_CALLBACK_ORIGIN_MISMATCH",
          "OAUTH_CALLBACK_ORIGIN differs from APP_PUBLIC_URL origin — ensure provider console allows the API callback host."
        );
      }
    } catch {
      pushIssue(globalIssues, "OAUTH_CALLBACK_ORIGIN_INVALID", "OAUTH_CALLBACK_ORIGIN is not a valid URL.");
    }
  }

  const providers = Object.keys(OAUTH_PROVIDERS).map((id) => {
    const meta = OAUTH_PROVIDERS[id];
    const config = oauthProviderConfig(id);
    const issues = [];
    const callbackUrl = oauthCallbackUrl(id);

    if (!config) {
      pushIssue(issues, "OAUTH_CREDENTIALS_MISSING", `${id.toUpperCase()}_CLIENT_ID / ${id.toUpperCase()}_CLIENT_SECRET not set.`);
    } else {
      if (!publicUrl) {
        pushIssue(issues, "APP_PUBLIC_URL_MISSING", "Cannot build OAuth callback without APP_PUBLIC_URL.");
      }
      try {
        const parsed = new URL(callbackUrl);
        if ((process.env.NODE_ENV ?? "development") === "production" && parsed.protocol !== "https:") {
          pushIssue(issues, "OAUTH_CALLBACK_NOT_HTTPS", "Production OAuth callback must be HTTPS.");
        }
      } catch {
        pushIssue(issues, "OAUTH_CALLBACK_INVALID", `Invalid callback URL: ${callbackUrl}`);
      }
    }

    return {
      id,
      label: meta.label,
      enabled: Boolean(config),
      callbackUrl,
      issues
    };
  });

  const enabledProviders = providers.filter((p) => p.enabled);
  const ready = globalIssues.length === 0
    && enabledProviders.length > 0
    && enabledProviders.every((p) => p.issues.length === 0);

  return {
    ready,
    enabledCount: enabledProviders.length,
    publicAppUrl: publicUrl || null,
    callbackOrigin: callbackOrigin || null,
    frontendReturnUrl: oauthFrontendReturnUrl(),
    globalIssues,
    providers
  };
}

/** Public-safe subset for /auth/config (no secrets). */
export function getPublicOAuthDiagnostics() {
  const full = getOAuthDiagnostics();
  return {
    ready: full.ready,
    enabledCount: full.enabledCount,
    publicAppUrl: full.publicAppUrl,
    callbackOrigin: full.callbackOrigin,
    frontendReturnUrl: full.frontendReturnUrl,
    globalIssues: full.globalIssues,
    providers: full.providers.map((p) => ({
      id: p.id,
      label: p.label,
      enabled: p.enabled,
      callbackUrl: p.enabled ? p.callbackUrl : null,
      issues: p.issues
    }))
  };
}

export function validateOAuthProductionConfig() {
  const diagnostics = getOAuthDiagnostics();
  const requireOAuth = process.env.REQUIRE_OAUTH_IN_PRODUCTION === "true";
  const warnings = [];
  const fatals = [];

  if (requireOAuth && diagnostics.enabledCount === 0) {
    fatals.push("REQUIRE_OAUTH_IN_PRODUCTION=true but no OAuth provider credentials are configured.");
  }

  for (const issue of diagnostics.globalIssues) {
    const target = issue.code === "APP_PUBLIC_URL_MISSING" ? fatals : warnings;
    target.push(`OAuth: ${issue.message}`);
  }

  if (diagnostics.enabledCount > 0) {
    if (!process.env.APP_PUBLIC_URL?.trim()) {
      fatals.push("OAuth provider enabled but APP_PUBLIC_URL is empty.");
    }
    for (const provider of diagnostics.providers.filter((p) => p.enabled)) {
      for (const issue of provider.issues) {
        warnings.push(`${provider.label}: ${issue.message}`);
      }
    }
  }

  return { diagnostics, warnings, fatals, ok: fatals.length === 0 };
}
