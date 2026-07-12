/**
 * Refuse destructive DB ops (CREATE/DROP sibling DB, restore drill) against
 * production-looking hosts unless explicitly overridden.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * @param {string} databaseUrl
 * @param {{ opName?: string }} [opts]
 */
export function assertSafeDatabaseUrlForDestructiveOps(databaseUrl, opts = {}) {
  const opName = opts.opName || "destructive database operation";
  if (process.env.ZHIMU_ALLOW_DESTRUCTIVE_DB === "1") return;

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(`${opName}: invalid DATABASE_URL`);
  }

  const host = String(parsed.hostname || "").toLowerCase();
  const dbName = String(parsed.pathname || "")
    .replace(/^\//, "")
    .split("?")[0]
    .toLowerCase();

  if (LOCAL_HOSTS.has(host) || host.endsWith(".local")) return;

  const prodHint = /supabase\.co|railway\.app|neon\.tech|amazonaws\.com|azure\.com|getzhimu|[\._-]prod([\._-]|$)/i;
  if (prodHint.test(host) || prodHint.test(dbName)) {
    throw new Error(
      `${opName}: refusing production-looking database host=${host} db=${dbName || "(none)"}. ` +
        `Use a local/CI URL, or set ZHIMU_ALLOW_DESTRUCTIVE_DB=1 to override.`
    );
  }

  // Unknown remote hosts still require an explicit override.
  throw new Error(
    `${opName}: refusing remote database host=${host} db=${dbName || "(none)"}. ` +
      `Use localhost, or set ZHIMU_ALLOW_DESTRUCTIVE_DB=1 after confirming this is a non-production cluster.`
  );
}
