import { getPoolStats, query } from "./db.js";

const REQUIRED_TABLES = [
  "host_audit_log",
  "write_idempotency",
  "room_event_journal",
  "platform_event_journal",
  "event_outbox",
  "checkpoint_restores",
  "auth_account_creation_events"
];
const REQUIRED_MIGRATIONS = [
  "084_room_creation_idempotency.sql",
  "085_room_creation_idempotency_index.sql",
  "086_rooms_world_created_index.sql",
  "087_room_members_role_active_index.sql",
  "088_auth_account_creation_events.sql",
  "089_auth_account_creation_events_indexes.sql",
  "090_auth_account_creation_events_user_index.sql"
];

export function inspectRequiredDatabaseSchema({ tableNames = [], migrationNames = [] } = {}) {
  const presentTables = new Set(tableNames);
  const appliedMigrations = new Set(migrationNames);
  const missingTables = REQUIRED_TABLES.filter((name) => !presentTables.has(name));
  const missingMigrations = REQUIRED_MIGRATIONS.filter((name) => !appliedMigrations.has(name));
  return {
    ok: missingTables.length === 0 && missingMigrations.length === 0,
    missingTables,
    missingMigrations
  };
}

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
      [REQUIRED_TABLES]
    ).catch(() => ({ rows: [] }))
  ]);
  const latencyMs = Date.now() - started;

  const schema = inspectRequiredDatabaseSchema({
    tableNames: tables.rows.map((row) => row.table_name),
    migrationNames: migrations.rows.map((row) => row.filename)
  });

  const latestMigration = migrations.rows.at(-1)?.filename ?? null;
  return {
    ok: schema.ok,
    databaseTime: time.rows[0].database_time,
    latencyMs,
    migrationsApplied: migrations.rows.length,
    latestMigration,
    features: {
      cascadeWorldDelete: true,
      roomsWorldCascadeMigration: Boolean(latestMigration && latestMigration >= "017_rooms_world_cascade.sql")
    },
    missingTables: schema.missingTables,
    missingMigrations: schema.missingMigrations,
    pool: getPoolStats(),
    hint: schema.ok
      ? null
      : "Run: cd backend && npm run db:migrate"
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
