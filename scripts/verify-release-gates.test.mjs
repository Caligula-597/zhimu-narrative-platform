import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertSupportedNodeRuntime,
  parseRepeatOptions,
  runRepeatedVerification
} from "./verify-full-repeat.mjs";
import {
  parseRollbackOptions,
  runRollbackVerification
} from "../backend/scripts/verify-release-rollback.mjs";

test("verify repeat options reject counts that could false-pass without running", () => {
  for (const value of ["NaN", "0", "-1", "1.5", "11", ""]) {
    assert.throws(() => parseRepeatOptions([`--count=${value}`]), /count/);
  }
  assert.deepEqual(parseRepeatOptions([]), { count: 3, outputPath: null });
  assert.equal(parseRepeatOptions(["--count=3"]).count, 3);
  assert.throws(() => parseRepeatOptions(["--coun=3"]), /unknown argument/);
});

test("release acceptance rejects runtimes outside the pinned Node 24.13 line", () => {
  assert.doesNotThrow(() => assertSupportedNodeRuntime("24.13.0"));
  assert.doesNotThrow(() => assertSupportedNodeRuntime("24.13.9"));
  assert.throws(() => assertSupportedNodeRuntime("22.23.1"), /requires Node\.js 24\.13\.x/);
  assert.throws(() => assertSupportedNodeRuntime("24.14.0"), /requires Node\.js 24\.13\.x/);
  assert.throws(() => assertSupportedNodeRuntime("invalid"), /requires Node\.js 24\.13\.x/);
});

test("package, developer, CI and container runtime pins stay aligned", () => {
  const root = process.cwd();
  const expectedVersion = "24.13.0";
  const expectedEngine = ">=24.13.0 <24.14.0";
  assert.equal(readFileSync(path.join(root, ".nvmrc"), "utf8").trim(), expectedVersion);
  assert.equal(readFileSync(path.join(root, ".node-version"), "utf8").trim(), expectedVersion);
  for (const workspace of [".", "backend", "host", "play", "site"]) {
    const packageJson = JSON.parse(readFileSync(path.join(root, workspace, "package.json"), "utf8"));
    assert.equal(packageJson.engines?.node, expectedEngine, `${workspace} engines.node drifted`);
  }
  for (const dockerfile of ["backend/Dockerfile", "deploy/Dockerfile.fullstack"]) {
    assert.match(readFileSync(path.join(root, dockerfile), "utf8"), /FROM node:24\.13\.0-alpine/);
  }
  const workflowDirectory = path.join(root, ".github", "workflows");
  const workflows = readdirSync(workflowDirectory)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();
  assert.ok(workflows.includes("production-release.yml"), "production release workflow is missing");
  for (const workflow of workflows) {
    const source = readFileSync(path.join(workflowDirectory, workflow), "utf8");
    for (const match of source.matchAll(/node-version:\s*["']?([^\s"']+)/g)) {
      assert.equal(match[1], expectedVersion, `${workflow} node-version drifted`);
    }
  }
});

test("Railway and release CI require an exact Creator frontend rollout", () => {
  const root = process.cwd();
  const railwayJson = JSON.parse(readFileSync(path.join(root, "railway.json"), "utf8"));
  const railwayToml = readFileSync(path.join(root, "railway.toml"), "utf8");
  const workflow = readFileSync(path.join(root, ".github", "workflows", "production-release.yml"), "utf8");
  assert.equal(railwayJson.deploy?.healthcheckPath, "/api/health/ready");
  assert.match(railwayToml, /healthcheckPath\s*=\s*["']\/api\/health\/ready["']/u);
  assert.match(workflow, /Build expected Creator artifact[\s\S]*npm ci && npm run build/u);
  assert.match(workflow, /Build expected Creator artifact[\s\S]*VITE_API_BASE:\s*\/api/u);
  assert.match(workflow, /Build expected Creator artifact[\s\S]*VITE_REQUIRE_AUTH:\s*["']true["']/u);
  assert.match(workflow, /Build expected Creator artifact[\s\S]*VITE_DEMO_MODE:\s*["']false["']/u);
  assert.match(workflow, /REQUIRE_CREATOR_FRONTEND_SYNC:\s*["']true["']/u);
  const deployScript = readFileSync(path.join(root, "scripts", "railway-deploy-ci.mjs"), "utf8");
  assert.match(deployScript, /RAILWAY_API_SERVICE_ID/u);
  assert.match(deployScript, /probeCreatorFrontendSync/u);
});

test("Playwright migrates a fresh database before starting the API", () => {
  const config = readFileSync(path.join(process.cwd(), "playwright.config.js"), "utf8");
  assert.match(config, /command:\s*["']npm run db:migrate && node src\/server\.js["']/);
});

test("production backup remains portable and validates restored business data", () => {
  const workflow = readFileSync(
    path.join(process.cwd(), ".github", "workflows", "production-backup.yml"),
    "utf8"
  );
  assert.match(workflow, /pg_dump[\s\S]*--format=custom[\s\S]*--exclude-extension=supabase_vault/u);
  assert.match(workflow, /pg_restore[\s\S]*--exit-on-error/u);
  for (const table of ["users", "worlds", "schema_migrations"]) {
    assert.match(workflow, new RegExp(`SELECT COUNT\\(\\*\\) FROM ${table}`));
  }
  assert.match(workflow, /rm artifacts\/backup\/zhimu\.dump/u);
});

test("Player join E2E observes the API transition without clicking a detached element", () => {
  const fixture = readFileSync(path.join(process.cwd(), "e2e", "helpers", "fixture.mjs"), "utf8");
  assert.doesNotMatch(
    fixture,
    /\[data-action=["']confirm-join["']\][\s\S]{0,160}\.evaluate\(/u
  );
  assert.match(fixture, /page\.waitForResponse\([\s\S]*\/api\/rooms\/join/u);
  assert.match(fixture, /joinResponse\.ok\(\)/u);
  assert.match(fixture, /\.role-card\.is-selected\[data-role-id=/u);
});

test("verify repeat stops and fails on a signalled child process", () => {
  let calls = 0;
  const exitCode = runRepeatedVerification(
    { count: 3, outputPath: null },
    () => {
      calls += 1;
      return { status: null, signal: "SIGTERM" };
    }
  );
  assert.equal(exitCode, 1);
  assert.equal(calls, 1);
});

test("verify repeat requires every requested run to pass", () => {
  const outputDirectory = mkdtempSync(path.join(tmpdir(), "zhimu-repeat-gate-"));
  const outputPath = path.join(outputDirectory, "repeat.json");
  let calls = 0;
  try {
    const exitCode = runRepeatedVerification(
      { count: 3, outputPath },
      () => {
        calls += 1;
        return { status: calls === 2 ? 9 : 0, signal: null };
      }
    );
    assert.equal(exitCode, 9);
    assert.equal(calls, 2);
    const evidence = JSON.parse(readFileSync(outputPath, "utf8"));
    assert.equal(evidence.status, "failed");
    assert.equal(evidence.requestedRuns, 3);
    assert.equal(evidence.completedRuns, 2);
    assert.equal(evidence.runs[1].exitCode, 9);
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("rollback evidence gate requires both data drills", () => {
  assert.deepEqual(parseRollbackOptions([]), { outputPath: null });
  assert.throws(() => parseRollbackOptions(["--out="]), /file path/);

  let calls = 0;
  assert.equal(runRollbackVerification({ outputPath: null }, () => {
    calls += 1;
    return { status: calls === 2 ? 4 : 0, signal: null };
  }), 4);
  assert.equal(calls, 2);
});

test("rollback evidence gate passes only after every drill passes", () => {
  const outputDirectory = mkdtempSync(path.join(tmpdir(), "zhimu-release-gate-"));
  const outputPath = path.join(outputDirectory, "rollback.json");
  let calls = 0;
  try {
    assert.equal(runRollbackVerification({ outputPath }, () => {
      calls += 1;
      return { status: 0, signal: null };
    }), 0);
    assert.equal(calls, 2);
    const evidence = JSON.parse(readFileSync(outputPath, "utf8"));
    assert.equal(evidence.status, "passed");
    assert.equal(evidence.completedDrills, 2);
    assert.equal(evidence.applicationImageRollbackCovered, false);
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});
