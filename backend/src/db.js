import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

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

export const pool = new Pool({
  connectionString: resolveDatabaseUrl(),
  ssl: resolveDatabaseSsl(),
  max: Number(process.env.PGPOOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_MS ?? 30_000)
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
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
