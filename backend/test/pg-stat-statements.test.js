import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { classifyPgStatError, fetchTopPgStatStatements } from "../scripts/pg-stat-report.mjs";

const migrationsDir = path.join(import.meta.dirname, "..", "migrations");

test("pg_stat_statements migration exists", () => {
  const file = path.join(migrationsDir, "063_pg_stat_statements.sql");
  assert.ok(fs.existsSync(file));
  const sql = fs.readFileSync(file, "utf8");
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pg_stat_statements/i);
});

test("classifyPgStatError maps permission denied", () => {
  const err = Object.assign(new Error("permission denied for view pg_stat_statements"), { code: "42501" });
  const classified = classifyPgStatError(err);
  assert.equal(classified.code, "PG_STAT_PERMISSION_DENIED");
  assert.match(classified.message, /permission denied/i);
});

test("classifyPgStatError maps missing relation", () => {
  const err = Object.assign(new Error('relation "pg_stat_statements" does not exist'), { code: "42P01" });
  assert.equal(classifyPgStatError(err).code, "PG_STAT_NOT_INSTALLED");
});

test("fetchTopPgStatStatements fails clearly when extension missing", async () => {
  await assert.rejects(
    () => fetchTopPgStatStatements(5, async () => ({ rowCount: 0, rows: [] })),
    (error) => error.code === "PG_STAT_NOT_INSTALLED"
  );
});

test("fetchTopPgStatStatements surfaces permission errors from query", async () => {
  let calls = 0;
  const runQuery = async () => {
    calls += 1;
    if (calls === 1) return { rowCount: 1, rows: [{ "?column?": 1 }] };
    const err = Object.assign(new Error("permission denied for view pg_stat_statements"), { code: "42501" });
    throw err;
  };
  await assert.rejects(() => fetchTopPgStatStatements(5, runQuery), (error) => error.code === "42501");
  assert.equal(classifyPgStatError(Object.assign(new Error("permission denied"), { code: "42501" })).code, "PG_STAT_PERMISSION_DENIED");
});
