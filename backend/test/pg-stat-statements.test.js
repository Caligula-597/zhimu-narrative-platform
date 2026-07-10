import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationsDir = path.join(import.meta.dirname, "..", "migrations");

test("pg_stat_statements migration exists", () => {
  const file = path.join(migrationsDir, "063_pg_stat_statements.sql");
  assert.ok(fs.existsSync(file));
  const sql = fs.readFileSync(file, "utf8");
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pg_stat_statements/i);
});
