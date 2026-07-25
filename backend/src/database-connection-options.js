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

export function resolveDatabaseSsl() {
  if (process.env.DATABASE_SSL !== "true") return false;
  const ca = String(process.env.DATABASE_SSL_CA || "").trim();
  return {
    rejectUnauthorized: true,
    ...(ca ? { ca: ca.replace(/\\n/g, "\n") } : {})
  };
}
