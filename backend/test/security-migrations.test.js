import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationsDir = path.join(import.meta.dirname, "..", "migrations");

function migrationSql() {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => fs.readFileSync(path.join(migrationsDir, file), "utf8"))
    .join("\n");
}

function createdPublicTables(sql) {
  const tables = [];
  for (const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:public)\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi)) {
    if (match[1] !== "schema_migrations") tables.push(match[1]);
  }
  return [...new Set(tables)].sort();
}

function rlsMigrationTables(sql) {
  const tables = [];
  for (const block of sql.matchAll(/rls_tables\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/gi)) {
    for (const match of block[1].matchAll(/'([a-zA-Z_][a-zA-Z0-9_]*)'/g)) tables.push(match[1]);
  }
  for (const match of sql.matchAll(
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:(?:public)\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi
  )) {
    tables.push(match[1]);
  }
  return [...new Set(tables)].sort();
}

test("public tables created by migrations are covered by RLS enablement", () => {
  const sql = migrationSql();
  const created = createdPublicTables(sql);
  const covered = rlsMigrationTables(sql);

  assert.ok(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql), "missing RLS enablement migration");
  assert.deepEqual(
    covered,
    created,
    `RLS table coverage mismatch. Missing: ${created.filter((table) => !covered.includes(table)).join(", ")}`
  );
});
