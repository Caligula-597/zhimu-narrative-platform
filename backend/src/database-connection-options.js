/** Shared PostgreSQL URL and TLS policy for the API and operational scripts. */
export function resolveDatabaseUrl(raw = process.env.DATABASE_URL) {
  if (!raw?.trim()) return raw;
  try {
    const parsed = new URL(raw.replace(/^postgresql:\/\//, "http://"));
    parsed.searchParams.delete("sslmode");
    const query = parsed.searchParams.toString();
    const base = raw.split("?")[0];
    return query ? `${base}?${query}` : base;
  } catch {
    return raw
      .replace(/([?&])sslmode=[^&]*&?/g, (_, separator) => (separator === "?" ? "?" : ""))
      .replace(/\?&/, "?")
      .replace(/[?&]$/, "");
  }
}

export function inspectDatabaseTlsPolicy(env = process.env) {
  const enabled = env.DATABASE_SSL === "true";
  const verifyCertificate = env.DATABASE_SSL_VERIFY !== "false";
  const caConfigured = Boolean(String(env.DATABASE_SSL_CA || "").trim());
  return {
    enabled,
    verifyCertificate,
    caConfigured,
    trusted: enabled && verifyCertificate,
    caSource: caConfigured ? "provider" : "system"
  };
}

export function resolveDatabaseSsl(env = process.env) {
  const policy = inspectDatabaseTlsPolicy(env);
  if (env.NODE_ENV === "production" && !policy.enabled) {
    const error = new Error("Production database connections require DATABASE_SSL=true");
    error.code = "DATABASE_TLS_REQUIRED";
    throw error;
  }
  if (env.NODE_ENV === "production" && !policy.verifyCertificate) {
    const error = new Error(
      "Production database TLS certificate verification cannot be disabled; configure DATABASE_SSL_CA instead"
    );
    error.code = "DATABASE_TLS_VERIFICATION_REQUIRED";
    throw error;
  }
  if (!policy.enabled) return false;
  const ca = String(env.DATABASE_SSL_CA || "").trim();
  return {
    rejectUnauthorized: policy.verifyCertificate,
    ...(ca ? { ca: ca.replace(/\\n/g, "\n") } : {})
  };
}
