/** Optional integrations — missing config degrades features, not process startup. */
export function getOptionalServicesStatus() {
  const has = (key) => Boolean(String(process.env[key] || "").trim());
  const hasPair = (a, b) => has(a) && has(b);

  return {
    oauthGoogle: hasPair("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
    oauthGithub: hasPair("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"),
    email: has("RESEND_API_KEY") || (has("MAILGUN_API_KEY") && has("MAILGUN_DOMAIN")),
    r2: has("R2_BUCKET") && hasPair("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"),
    livekit: has("LIVEKIT_URL") && hasPair("LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"),
    stripe: has("STRIPE_SECRET_KEY"),
    officialExample: has("OFFICIAL_EXAMPLE_WORLD_ID"),
    deepseek: has("DEEPSEEK_API_KEY")
  };
}
