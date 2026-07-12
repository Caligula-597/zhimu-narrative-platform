import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import {
  buildContentSecurityPolicy,
  buildTrustedTypesReportOnlyPolicy,
  resolveCspMode
} from "../src/security-headers.js";

test("resolveCspMode defaults to report-only in production", () => {
  assert.equal(resolveCspMode("production"), "report-only");
  assert.equal(resolveCspMode("development"), "off");
  assert.equal(resolveCspMode("production", "enforce"), "enforce");
  assert.equal(resolveCspMode("production", "off"), "off");
});

test("buildContentSecurityPolicy uses report-only header in production default", () => {
  const csp = buildContentSecurityPolicy({ nodeEnv: "production" });
  assert.ok(csp);
  assert.equal(csp.header, "Content-Security-Policy-Report-Only");
  assert.match(csp.value, /default-src 'self'/);
  assert.match(csp.value, /script-src 'self'/);
  assert.match(csp.value, /trusted-types zhimu-html/);
  assert.match(csp.value, /require-trusted-types-for 'script'/);
  assert.match(csp.value, /report-uri \/api\/csp-report/);
  assert.doesNotMatch(csp.value, /unsafe-eval/);
});

test("Trusted Types enforcement is an explicit rollout gate", () => {
  const previous = process.env.TRUSTED_TYPES_ENFORCE;
  process.env.TRUSTED_TYPES_ENFORCE = "true";
  try {
    const csp = buildContentSecurityPolicy({ nodeEnv: "production" });
    assert.match(csp.value, /require-trusted-types-for 'script'/);
  } finally {
    if (previous === undefined) delete process.env.TRUSTED_TYPES_ENFORCE;
    else process.env.TRUSTED_TYPES_ENFORCE = previous;
  }
});

test("enforced CSP does not require Trusted Types until its rollout gate is enabled", () => {
  const previous = process.env.TRUSTED_TYPES_ENFORCE;
  delete process.env.TRUSTED_TYPES_ENFORCE;
  try {
    const csp = buildContentSecurityPolicy({ nodeEnv: "production", cspMode: "enforce" });
    assert.equal(csp.header, "Content-Security-Policy");
    assert.doesNotMatch(csp.value, /require-trusted-types-for 'script'/);
  } finally {
    if (previous === undefined) delete process.env.TRUSTED_TYPES_ENFORCE;
    else process.env.TRUSTED_TYPES_ENFORCE = previous;
  }
});

test("Trusted Types can report violations while the regular CSP remains enforced", () => {
  const previousReportOnly = process.env.TRUSTED_TYPES_REPORT_ONLY;
  const previousEnforce = process.env.TRUSTED_TYPES_ENFORCE;
  process.env.TRUSTED_TYPES_REPORT_ONLY = "true";
  delete process.env.TRUSTED_TYPES_ENFORCE;
  try {
    const policy = buildTrustedTypesReportOnlyPolicy({ nodeEnv: "production", cspMode: "enforce" });
    assert.equal(policy.header, "Content-Security-Policy-Report-Only");
    assert.match(policy.value, /require-trusted-types-for 'script'/);
    assert.match(policy.value, /report-uri \/api\/csp-report/);
  } finally {
    if (previousReportOnly === undefined) delete process.env.TRUSTED_TYPES_REPORT_ONLY;
    else process.env.TRUSTED_TYPES_REPORT_ONLY = previousReportOnly;
    if (previousEnforce === undefined) delete process.env.TRUSTED_TYPES_ENFORCE;
    else process.env.TRUSTED_TYPES_ENFORCE = previousEnforce;
  }
});

test("production app responses include CSP report-only header", async (context) => {
  const prev = process.env.CSP_MODE;
  delete process.env.CSP_MODE;
  const app = await createApp({ logger: false, nodeEnv: "production", allowDemoUserHeader: false });
  context.after(() => {
    if (prev === undefined) delete process.env.CSP_MODE;
    else process.env.CSP_MODE = prev;
    return app.close();
  });

  const response = await app.inject({ method: "GET", url: "/api/health/live" });
  assert.equal(response.statusCode, 200);
  assert.ok(response.headers["content-security-policy-report-only"]);
  assert.match(response.headers["content-security-policy-report-only"], /default-src 'self'/);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
});

test("production can enforce regular CSP while reporting Trusted Types", async (context) => {
  const previousMode = process.env.CSP_MODE;
  const previousReportOnly = process.env.TRUSTED_TYPES_REPORT_ONLY;
  const previousEnforce = process.env.TRUSTED_TYPES_ENFORCE;
  process.env.CSP_MODE = "enforce";
  process.env.TRUSTED_TYPES_REPORT_ONLY = "true";
  delete process.env.TRUSTED_TYPES_ENFORCE;
  const app = await createApp({ logger: false, nodeEnv: "production", allowDemoUserHeader: false });
  context.after(() => {
    if (previousMode === undefined) delete process.env.CSP_MODE;
    else process.env.CSP_MODE = previousMode;
    if (previousReportOnly === undefined) delete process.env.TRUSTED_TYPES_REPORT_ONLY;
    else process.env.TRUSTED_TYPES_REPORT_ONLY = previousReportOnly;
    if (previousEnforce === undefined) delete process.env.TRUSTED_TYPES_ENFORCE;
    else process.env.TRUSTED_TYPES_ENFORCE = previousEnforce;
    return app.close();
  });

  const response = await app.inject({ method: "GET", url: "/api/health/live" });
  assert.match(response.headers["content-security-policy"], /default-src 'self'/);
  assert.doesNotMatch(response.headers["content-security-policy"], /require-trusted-types-for 'script'/);
  assert.match(response.headers["content-security-policy-report-only"], /require-trusted-types-for 'script'/);
});

test("development app omits CSP when mode is off", async (context) => {
  const app = await createApp({ logger: false, nodeEnv: "development", allowDemoUserHeader: false });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/health/live" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-security-policy-report-only"], undefined);
  assert.equal(response.headers["content-security-policy"], undefined);
});
