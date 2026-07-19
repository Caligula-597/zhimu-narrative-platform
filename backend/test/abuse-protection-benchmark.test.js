import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAbuseBenchmarkOptions,
  runAbuseBenchmark
} from "../scripts/benchmark-abuse-protection.mjs";

test("abuse benchmark refuses implicit remote targets and credentials in URLs", () => {
  assert.throws(
    () => parseAbuseBenchmarkOptions(["--url=https://staging.example.com"], {}),
    /require --allow-remote/
  );
  assert.throws(
    () => parseAbuseBenchmarkOptions(["--url=https://user:secret@staging.example.com"], {
      ABUSE_TEST_BEARER_TOKENS: "token"
    }),
    /must not contain credentials/
  );
});

test("remote abuse benchmark is tightly bounded", () => {
  assert.throws(
    () => parseAbuseBenchmarkOptions([
      "--url=https://staging.example.com",
      "--allow-remote",
      "--requests=501"
    ], { ABUSE_TEST_BEARER_TOKENS: "token" }),
    /between 40 and 500/
  );
  const options = parseAbuseBenchmarkOptions([
    "--url=https://staging.example.com",
    "--allow-remote",
    "--requests=40",
    "--concurrency=10"
  ], { ABUSE_TEST_BEARER_TOKENS: "token-a,token-b" });
  assert.equal(options.authMode, "bearer");
  assert.equal(options.actors.length, 2);
  assert.equal(options.scope, "room-access");
  assert.throws(
    () => parseAbuseBenchmarkOptions(["--scope=unknown"], {}),
    /room-access or voice/
  );
});

test("voice attack report covers message, token, create, and invite buckets", async () => {
  const options = {
    baseUrl: "http://127.0.0.1:4180",
    loopback: true,
    authMode: "bearer",
    actors: ["voice-secret"],
    requests: 40,
    concurrency: 8,
    timeoutMs: 1000,
    scope: "voice",
    out: ""
  };
  const seen = new Map();
  const report = await runAbuseBenchmark(options, async (url) => {
    if (url.endsWith("/api/health/live")) return new Response("ok", { status: 200 });
    const kind = url.includes("/messages")
      ? "message"
      : url.includes("/token")
        ? "token"
        : url.includes("/members")
          ? "invite"
          : "create";
    const count = (seen.get(kind) || 0) + 1;
    seen.set(kind, count);
    return new Response("probe", { status: count > 5 ? 429 : (kind === "create" ? 404 : 403) });
  });
  assert.equal(report.passed, true);
  assert.equal(Object.keys(report.scenarios).length, 4);
  assert.equal(report.serverErrors, 0);
  assert.equal(JSON.stringify(report).includes("voice-secret"), false);
});

test("mixed attack report proves throttling without leaking credentials", async () => {
  const options = {
    baseUrl: "http://127.0.0.1:4180",
    loopback: true,
    authMode: "bearer",
    actors: ["secret-a", "secret-b"],
    requests: 40,
    concurrency: 8,
    timeoutMs: 1000,
    out: ""
  };
  let attackIndex = 0;
  const report = await runAbuseBenchmark(options, async (url, init) => {
    if (url.endsWith("/api/health/live")) return new Response("ok", { status: 200 });
    attackIndex += 1;
    const malformed = init?.body?.includes('"not-a-uuid"');
    return new Response("blocked", { status: attackIndex % 4 === 0 ? 429 : (malformed ? 400 : 404) });
  });

  assert.equal(report.passed, true);
  assert.equal(report.rateLimited, 10);
  assert.equal(report.serverErrors, 0);
  assert.equal(report.health.before, 200);
  assert.equal(report.health.after, 200);
  assert.equal(JSON.stringify(report).includes("secret-a"), false);
});
