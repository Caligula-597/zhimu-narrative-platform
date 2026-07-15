import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_POOL_MAX, isDatabaseCapacityError, resolveDatabaseUrl,
  resolveDatabaseSsl, resolvePoolLifetimeSeconds, resolvePoolMax, resolvePoolTimeoutMs
} from "../src/db.js";

test("resolveDatabaseUrl strips sslmode for Supabase pooler", () => {
  const url =
    "postgresql://user:pass@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require";
  assert.equal(
    resolveDatabaseUrl(url),
    "postgresql://user:pass@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
  );
});

test("resolveDatabaseSsl uses rejectUnauthorized false when DATABASE_SSL=true", () => {
  const prev = process.env.DATABASE_SSL;
  process.env.DATABASE_SSL = "true";
  assert.deepEqual(resolveDatabaseSsl(), { rejectUnauthorized: false });
  process.env.DATABASE_SSL = "false";
  assert.equal(resolveDatabaseSsl(), false);
  if (prev === undefined) delete process.env.DATABASE_SSL;
  else process.env.DATABASE_SSL = prev;
});

test("connection pool uses a rolling-deploy-safe default and validates overrides", () => {
  assert.equal(DEFAULT_POOL_MAX, 6);
  assert.equal(resolvePoolMax(undefined), 6);
  assert.equal(resolvePoolMax("8"), 8);
  assert.equal(resolvePoolMax("0"), 6);
  assert.equal(resolvePoolMax("not-a-number"), 6);
});

test("connection pool timeout and lifetime settings are bounded", () => {
  assert.equal(resolvePoolTimeoutMs(undefined, 10_000), 10_000);
  assert.equal(resolvePoolTimeoutMs("2500", 10_000), 2500);
  assert.equal(resolvePoolTimeoutMs("0", 10_000), 10_000);
  assert.equal(resolvePoolTimeoutMs("invalid", 30_000), 30_000);
  assert.equal(resolvePoolLifetimeSeconds(undefined), 1800);
  assert.equal(resolvePoolLifetimeSeconds("3600"), 3600);
  assert.equal(resolvePoolLifetimeSeconds("1"), 1800);
});

test("database capacity errors are recognized without exposing provider details", () => {
  assert.equal(isDatabaseCapacityError({ code: "EMAXCONNSESSION" }), true);
  assert.equal(isDatabaseCapacityError({ code: "53300" }), true);
  assert.equal(isDatabaseCapacityError({ message: "remaining connection slots are reserved" }), true);
  assert.equal(isDatabaseCapacityError(new Error("ordinary failure")), false);
});
