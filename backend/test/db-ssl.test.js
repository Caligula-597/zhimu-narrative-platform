import test from "node:test";
import assert from "node:assert/strict";
import { resolveDatabaseUrl, resolveDatabaseSsl } from "../src/db.js";

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
