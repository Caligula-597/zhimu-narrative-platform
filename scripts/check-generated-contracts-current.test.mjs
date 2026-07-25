import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkGeneratedContractsCurrent } from "./check-generated-contracts-current.mjs";

function withFixture(callback) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zhimu-contract-drift-"));
  const generatedPaths = [
    path.join(fixtureRoot, "backend-contracts.d.ts"),
    path.join(fixtureRoot, "shared-contracts.d.ts")
  ];
  for (const filePath of generatedPaths) fs.writeFileSync(filePath, "current\n");
  try {
    callback({ fixtureRoot, generatedPaths });
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

test("accepts current generated contracts even when they differ from git HEAD", () => {
  withFixture(({ fixtureRoot, generatedPaths }) => {
    const result = checkGeneratedContractsCurrent({
      cwd: fixtureRoot,
      generatedPaths,
      runGenerator: () => ({ status: 0 })
    });
    assert.deepEqual(result, { current: true, changedPaths: [] });
  });
});

test("rejects and identifies generated contracts changed by the generator", () => {
  withFixture(({ fixtureRoot, generatedPaths }) => {
    const result = checkGeneratedContractsCurrent({
      cwd: fixtureRoot,
      generatedPaths,
      runGenerator: () => {
        fs.writeFileSync(generatedPaths[1], "regenerated\n");
        return { status: 0 };
      }
    });
    assert.equal(result.current, false);
    assert.deepEqual(result.changedPaths, [generatedPaths[1]]);
  });
});

test("fails closed when the generator fails", () => {
  withFixture(({ fixtureRoot, generatedPaths }) => {
    assert.throws(
      () => checkGeneratedContractsCurrent({
        cwd: fixtureRoot,
        generatedPaths,
        runGenerator: () => ({ status: 9 })
      }),
      /exit code 9/
    );
  });
});
