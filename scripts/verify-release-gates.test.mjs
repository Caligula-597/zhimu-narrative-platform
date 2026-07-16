import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parseRepeatOptions, runRepeatedVerification } from "./verify-full-repeat.mjs";
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
