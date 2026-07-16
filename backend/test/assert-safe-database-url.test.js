import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeDatabaseUrlForDestructiveOps,
  assertSafeDatabaseUrlForTestWrites
} from "../scripts/lib/assert-safe-database-url.mjs";

test("allows localhost DATABASE_URL without override", () => {
  assert.doesNotThrow(() =>
    assertSafeDatabaseUrlForDestructiveOps("postgres://zhimu:x@localhost:5432/zhimu")
  );
  assert.doesNotThrow(() =>
    assertSafeDatabaseUrlForDestructiveOps("postgres://zhimu:x@127.0.0.1:5432/zhimu_verify")
  );
});

test("refuses supabase-looking hosts unless override is set", () => {
  assert.throws(
    () => assertSafeDatabaseUrlForDestructiveOps(
      "postgres://u:p@db.abcdefghijklmnop.supabase.co:5432/postgres",
      { opName: "test-op" }
    ),
    /refusing production-looking/
  );
});

test("override ZHIMU_ALLOW_DESTRUCTIVE_DB=1 permits remote hosts", () => {
  const previous = process.env.ZHIMU_ALLOW_DESTRUCTIVE_DB;
  process.env.ZHIMU_ALLOW_DESTRUCTIVE_DB = "1";
  try {
    assert.doesNotThrow(() =>
      assertSafeDatabaseUrlForDestructiveOps("postgres://u:p@db.example.supabase.co:5432/postgres")
    );
  } finally {
    if (previous === undefined) delete process.env.ZHIMU_ALLOW_DESTRUCTIVE_DB;
    else process.env.ZHIMU_ALLOW_DESTRUCTIVE_DB = previous;
  }
});

test("test writes require their own explicit remote override", () => {
  const previousDestructive = process.env.ZHIMU_ALLOW_DESTRUCTIVE_DB;
  const previousTest = process.env.ZHIMU_ALLOW_TEST_DB_WRITES;
  process.env.ZHIMU_ALLOW_DESTRUCTIVE_DB = "1";
  delete process.env.ZHIMU_ALLOW_TEST_DB_WRITES;
  try {
    assert.throws(
      () => assertSafeDatabaseUrlForTestWrites("postgres://u:p@db.example.supabase.co:5432/postgres"),
      /ZHIMU_ALLOW_TEST_DB_WRITES=1/
    );
    process.env.ZHIMU_ALLOW_TEST_DB_WRITES = "1";
    assert.doesNotThrow(() =>
      assertSafeDatabaseUrlForTestWrites("postgres://u:p@db.example.supabase.co:5432/postgres")
    );
  } finally {
    if (previousDestructive === undefined) delete process.env.ZHIMU_ALLOW_DESTRUCTIVE_DB;
    else process.env.ZHIMU_ALLOW_DESTRUCTIVE_DB = previousDestructive;
    if (previousTest === undefined) delete process.env.ZHIMU_ALLOW_TEST_DB_WRITES;
    else process.env.ZHIMU_ALLOW_TEST_DB_WRITES = previousTest;
  }
});
