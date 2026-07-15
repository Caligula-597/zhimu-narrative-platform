import pg from "pg";
import "dotenv/config";

const { Pool } = pg;
export const DEFAULT_POOL_MAX = 6;

/** Strip sslmode from URL — pg v8+ treats require as verify-full and breaks Supabase pooler on Railway. */
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
      .replace(/([?&])sslmode=[^&]*&?/g, (_, sep) => (sep === "?" ? "?" : ""))
      .replace(/\?&/, "?")
      .replace(/[?&]$/, "");
  }
}

export function resolveDatabaseSsl() {
  return process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false;
}

export function resolvePoolMax(raw = process.env.PGPOOL_MAX) {
  const value = Number(raw ?? DEFAULT_POOL_MAX);
  return Number.isInteger(value) && value > 0 && value <= 100 ? value : DEFAULT_POOL_MAX;
}

export function resolvePoolTimeoutMs(raw, fallback) {
  const fallbackNumber = Number(fallback);
  const safeFallback = Number.isInteger(fallbackNumber) && fallbackNumber >= 1_000
    ? fallbackNumber
    : 10_000;
  const value = Number(raw ?? safeFallback);
  return Number.isInteger(value) && value >= 1_000 && value <= 10 * 60_000
    ? value
    : safeFallback;
}

export function resolvePoolLifetimeSeconds(raw = process.env.PGPOOL_MAX_LIFETIME_SECONDS) {
  const value = Number(raw ?? 1800);
  return Number.isInteger(value) && value >= 60 && value <= 24 * 60 * 60 ? value : 1800;
}

export function isDatabaseCapacityError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "");
  return code === "EMAXCONNSESSION"
    || code === "53300"
    || /max clients reached|too many (?:database )?clients|remaining connection slots/i.test(message);
}

export const pool = new Pool({
  connectionString: resolveDatabaseUrl(),
  ssl: resolveDatabaseSsl(),
  // Supabase session poolers commonly cap a project at 15 clients. Six per
  // instance permits a two-instance rolling deploy plus migration/ops headroom.
  max: resolvePoolMax(),
  idleTimeoutMillis: resolvePoolTimeoutMs(process.env.PGPOOL_IDLE_MS, 30_000),
  connectionTimeoutMillis: resolvePoolTimeoutMs(process.env.PGPOOL_CONNECTION_TIMEOUT_MS, 10_000),
  maxLifetimeSeconds: resolvePoolLifetimeSeconds(),
  keepAlive: true
});

// pg emits idle-client failures on the pool rather than through a query
// promise. Always attach a listener so a transient network disconnect cannot
// become an uncaughtException; pg removes that failed client from the pool.
pool.on("error", (error) => {
  console.error("[database] idle client error:", error?.message || error);
});

export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: pool.options.max
  };
}

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function transaction(work) {
  const client = await pool.connect();
  let releaseError;
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      // Passing the connection failure to release() makes pg destroy the
      // poisoned client instead of returning it to the reusable pool.
      releaseError = rollbackError;
    }
    throw error;
  } finally {
    client.release(releaseError);
  }
}
