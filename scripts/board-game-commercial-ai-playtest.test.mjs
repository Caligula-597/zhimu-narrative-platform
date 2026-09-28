import assert from "node:assert/strict";
import test from "node:test";
import { COMMERCIAL_MECHANISM_BENCHMARKS, runAllCommercialMechanismBenchmarks } from "../shared/commercial-mechanism-benchmarks.js";

test("commercial mechanism benchmarks let AI seats complete full games", () => {
  const reports = runAllCommercialMechanismBenchmarks({ gamesPerBenchmark: 2, seats: 4 });
  assert.equal(reports.length, COMMERCIAL_MECHANISM_BENCHMARKS.length);
  for (const report of reports) {
    assert.ok(report.coreMechanisms.length >= 5, `${report.id} must declare its core mechanism coverage`);
    assert.equal(report.summary.endedGames, 2, `${report.id} should finish both games`);
    assert.equal(report.summary.errorGames, 0, `${report.id} has AI execution errors`);
    assert.equal(report.summary.privateBoundaryViolations, 0, `${report.id} leaked private information`);
    assert.ok(report.games.every((game) => game.final.scores.length === 4));
  }
});
