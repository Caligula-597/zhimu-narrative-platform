/**
 * Refuse test/destructive database operations against remote or production-
 * looking hosts unless the operator explicitly confirms an isolated target.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function assertLocalOrExplicitDatabase(databaseUrl, { opName, overrideEnv }) {
  if (process.env[overrideEnv] === "1") return;

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

  const prodHint = /supabase\.co|railway\.app|neon\.tech|amazonaws\.com|azure\.com|getzhimu|[\._-]prod([\._-]|$)/iu;
  if (prodHint.test(host) || prodHint.test(dbName)) {
    throw new Error(
      `${opName}: refusing production-looking database host=${host} db=${dbName || "(none)"}. `
        + `Use a local/CI URL, or set ${overrideEnv}=1 after confirming an isolated non-production database.`
    );
  }

  throw new Error(
    `${opName}: refusing remote database host=${host} db=${dbName || "(none)"}. `
      + `Use localhost, or set ${overrideEnv}=1 after confirming this is an isolated non-production cluster.`
  );
}

export function assertSafeDatabaseUrlForDestructiveOps(databaseUrl, opts = {}) {
  return assertLocalOrExplicitDatabase(databaseUrl, {
    opName: opts.opName || "destructive database operation",
    overrideEnv: "ZHIMU_ALLOW_DESTRUCTIVE_DB"
  });
}

export function assertSafeDatabaseUrlForTestWrites(databaseUrl, opts = {}) {
  return assertLocalOrExplicitDatabase(databaseUrl, {
    opName: opts.opName || "test database writes",
    overrideEnv: "ZHIMU_ALLOW_TEST_DB_WRITES"
  });
}
