import assert from "node:assert/strict";
import test from "node:test";
import {
  getOAuthDiagnostics,
  getPublicOAuthDiagnostics,
  validateOAuthProductionConfig
} from "../src/oauth-diagnostics.js";

function saveEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(saved) {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const OAUTH_ENV = [
  "NODE_ENV",
  "APP_PUBLIC_URL",
  "OAUTH_CALLBACK_ORIGIN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "REQUIRE_OAUTH_IN_PRODUCTION"
];

test("getOAuthDiagnostics reports missing credentials", () => {
  const saved = saveEnv(OAUTH_ENV);
  try {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    process.env.APP_PUBLIC_URL = "https://app.example.com";
    const diag = getOAuthDiagnostics();
    assert.equal(diag.enabledCount, 0);
    assert.equal(diag.ready, false);
    assert.equal(diag.providers.every((p) => !p.enabled), true);
  } finally {
    restoreEnv(saved);
  }
});

test("getOAuthDiagnostics ready when provider and public URL configured", () => {
  const saved = saveEnv(OAUTH_ENV);
  try {
    process.env.NODE_ENV = "production";
    process.env.APP_PUBLIC_URL = "https://getzhimu.com";
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    const diag = getOAuthDiagnostics();
    assert.equal(diag.enabledCount, 1);
    assert.equal(diag.ready, true);
    assert.ok(diag.providers.find((p) => p.id === "google")?.callbackUrl.includes("/api/auth/oauth/google/callback"));
  } finally {
    restoreEnv(saved);
  }
});

test("validateOAuthProductionConfig fatals when REQUIRE_OAUTH without providers", () => {
  const saved = saveEnv(OAUTH_ENV);
  try {
    process.env.NODE_ENV = "production";
    process.env.REQUIRE_OAUTH_IN_PRODUCTION = "true";
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    const result = validateOAuthProductionConfig();
    assert.equal(result.ok, false);
    assert.ok(result.fatals.length >= 1);
  } finally {
    restoreEnv(saved);
  }
});

test("getPublicOAuthDiagnostics never exposes client secrets", () => {
  const saved = saveEnv(OAUTH_ENV);
  try {
    process.env.APP_PUBLIC_URL = "https://getzhimu.com";
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.GOOGLE_CLIENT_SECRET = "super-secret";
    const pub = getPublicOAuthDiagnostics();
    const raw = JSON.stringify(pub);
    assert.ok(!raw.includes("super-secret"));
    assert.ok(!raw.includes("google-secret"));
  } finally {
    restoreEnv(saved);
  }
});
