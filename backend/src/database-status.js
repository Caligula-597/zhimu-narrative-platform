import { getPoolStats, query } from "./db.js";

export async function getDatabaseStatus() {
  const started = Date.now();
  const [time, migrations, tables] = await Promise.all([
    query("SELECT now() AS database_time"),
    query(
      `SELECT filename FROM schema_migrations ORDER BY filename`
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [["host_audit_log", "write_idempotency", "room_event_journal", "platform_event_journal", "event_outbox", "checkpoint_restores"]]
    ).catch(() => ({ rows: [] }))
  ]);
  const latencyMs = Date.now() - started;

  const requiredTables = ["host_audit_log", "write_idempotency", "room_event_journal", "platform_event_journal", "event_outbox", "checkpoint_restores"];
  const present = new Set(tables.rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((name) => !present.has(name));

  const latestMigration = migrations.rows.at(-1)?.filename ?? null;
  return {
    ok: missingTables.length === 0,
    databaseTime: time.rows[0].database_time,
    latencyMs,
    migrationsApplied: migrations.rows.length,
    latestMigration,
    features: {
      cascadeWorldDelete: true,
      roomsWorldCascadeMigration: Boolean(latestMigration && latestMigration >= "017_rooms_world_cascade.sql")
    },
    missingTables,
    pool: getPoolStats(),
    hint: missingTables.length
      ? "Run: cd backend && npm run db:migrate"
      : null
  };
}

export async function getReadinessStatus() {
  const status = await getDatabaseStatus();
  const pool = status.pool;
  const poolSaturated = pool.waiting > 0 && pool.idle === 0;
  return {
    ...status,
    ready: status.ok && !poolSaturated,
    checks: {
      database: status.ok,
      pool: !poolSaturated
    }
  };
}
