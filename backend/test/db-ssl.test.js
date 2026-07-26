import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_POOL_MAX, inspectDatabaseTlsPolicy, isDatabaseCapacityError, resolveDatabaseUrl,
  resolveDatabaseSsl, resolvePoolLifetimeSeconds, resolvePoolMax, resolvePoolTimeoutMs,
  resolveQueryTimeoutMs
} from "../src/db.js";

test("resolveDatabaseUrl strips sslmode for Supabase pooler", () => {
  const url =
    "postgresql://user:pass@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require";
  assert.equal(
    resolveDatabaseUrl(url),
    "postgresql://user:pass@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
  );
});

test("resolveDatabaseSsl verifies certificates and production refuses unverified TLS", () => {
  assert.deepEqual(resolveDatabaseSsl({
    DATABASE_SSL: "true"
  }), { rejectUnauthorized: true });
  assert.deepEqual(resolveDatabaseSsl({
    DATABASE_SSL: "true",
    DATABASE_SSL_CA: "line1\\nline2"
  }), { rejectUnauthorized: true, ca: "line1\nline2" });
  assert.deepEqual(resolveDatabaseSsl({
    NODE_ENV: "development",
    DATABASE_SSL: "true",
    DATABASE_SSL_CA: "line1\\nline2",
    DATABASE_SSL_VERIFY: "false"
  }), {
    rejectUnauthorized: false,
    ca: "line1\nline2"
  });
  assert.throws(
    () => resolveDatabaseSsl({
      NODE_ENV: "production",
      DATABASE_SSL: "true",
      DATABASE_SSL_VERIFY: "false"
    }),
    { code: "DATABASE_TLS_VERIFICATION_REQUIRED" }
  );
  assert.throws(
    () => resolveDatabaseSsl({
      NODE_ENV: "production",
      DATABASE_SSL: "false"
    }),
    { code: "DATABASE_TLS_REQUIRED" }
  );
  assert.equal(resolveDatabaseSsl({
    NODE_ENV: "development",
    DATABASE_SSL: "false"
  }), false);
});

test("database TLS status does not report encrypted-but-unverified connections as trusted", () => {
  assert.deepEqual(inspectDatabaseTlsPolicy({
    DATABASE_SSL: "true",
    DATABASE_SSL_VERIFY: "false"
  }), {
    enabled: true,
    verifyCertificate: false,
    caConfigured: false,
    trusted: false,
    caSource: "system"
  });
  assert.equal(inspectDatabaseTlsPolicy({
    DATABASE_SSL: "true",
    DATABASE_SSL_CA: "provider-ca"
  }).trusted, true);
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
  assert.equal(resolveQueryTimeoutMs(undefined, 30_000), 30_000);
  assert.equal(resolveQueryTimeoutMs("15000", 30_000), 15_000);
  assert.equal(resolveQueryTimeoutMs("0", 30_000), 30_000);
});

test("database capacity errors are recognized without exposing provider details", () => {
  assert.equal(isDatabaseCapacityError({ code: "EMAXCONNSESSION" }), true);
  assert.equal(isDatabaseCapacityError({ code: "53300" }), true);
  assert.equal(isDatabaseCapacityError({ message: "remaining connection slots are reserved" }), true);
  assert.equal(isDatabaseCapacityError(new Error("ordinary failure")), false);
});
