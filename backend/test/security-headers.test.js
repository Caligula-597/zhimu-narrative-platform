import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import {
  buildContentSecurityPolicy,
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
  assert.match(csp.value, /report-uri \/api\/csp-report/);
  assert.doesNotMatch(csp.value, /unsafe-eval/);
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

test("development app omits CSP when mode is off", async (context) => {
  const app = await createApp({ logger: false, nodeEnv: "development", allowDemoUserHeader: false });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/health/live" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-security-policy-report-only"], undefined);
  assert.equal(response.headers["content-security-policy"], undefined);
});
