import assert from "node:assert/strict";
import test from "node:test";
import { resolveAllowedCorsOrigins } from "../src/cors-origins.js";

test("resolveAllowedCorsOrigins defaults to permissive in non-production", () => {
  const prevCors = process.env.CORS_ORIGIN;
  const prevMarketing = process.env.MARKETING_SITE_ORIGIN;
  delete process.env.CORS_ORIGIN;
  delete process.env.MARKETING_SITE_ORIGIN;
  try {
    assert.equal(resolveAllowedCorsOrigins({}, "development"), true);
  } finally {
    if (prevCors === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = prevCors;
    if (prevMarketing === undefined) delete process.env.MARKETING_SITE_ORIGIN;
    else process.env.MARKETING_SITE_ORIGIN = prevMarketing;
  }
});

test("resolveAllowedCorsOrigins rejects unknown in production without env", () => {
  const prevCors = process.env.CORS_ORIGIN;
  const prevMarketing = process.env.MARKETING_SITE_ORIGIN;
  delete process.env.CORS_ORIGIN;
  delete process.env.MARKETING_SITE_ORIGIN;
  try {
    assert.equal(resolveAllowedCorsOrigins({}, "production"), false);
  } finally {
    if (prevCors === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = prevCors;
    if (prevMarketing === undefined) delete process.env.MARKETING_SITE_ORIGIN;
    else process.env.MARKETING_SITE_ORIGIN = prevMarketing;
  }
});

test("wildcard remains visible to production startup validation", () => {
  const previous = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = "*";
  try {
    assert.equal(resolveAllowedCorsOrigins({}, "production"), true);
  } finally {
    if (previous === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previous;
  }
});
