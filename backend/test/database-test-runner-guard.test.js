import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("raw node --test cannot import the database module with a production-looking URL", () => {
  const childEnv = {
    ...process.env,
    DATABASE_URL: "postgres://user:password@db.example.supabase.co:5432/postgres",
    ZHIMU_ALLOW_TEST_DB_WRITES: ""
  };
  delete childEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(
    process.execPath,
    ["--test", "test/fixtures/database-import-test.fixture.mjs"],
    {
      cwd: backendRoot,
      encoding: "utf8",
      env: childEnv
    }
  );

  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /database module test runner: refusing production-looking/u);
});
