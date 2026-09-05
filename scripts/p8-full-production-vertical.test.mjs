/**
 * P8.2.2 Full Production Vertical Slice — GEN-01 end-to-end proof
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { runFullProductionVertical } from "./p8-full-production-vertical.mjs";
import { assignablePlayerRoles } from "../shared/full-production-coverage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPTURE = path.resolve(__dirname, "../captures/p8-full-production/GEN-01");

describe("P8.2.2 Full Production Vertical Slice (GEN-01)", () => {
  it("PMD → Writer → Package → Approve → Playable → Runtime FINISHED", async () => {
    const result = await runFullProductionVertical({
      writeCaptures: true,
      captureDir: CAPTURE,
    });

    // Production
    assert.notEqual(result.production.gate.status, "BLOCKED");
    assert.ok(
      result.production.sectionStates.every((s) => s.status === "GENERATED"),
      JSON.stringify(result.production.sectionStates.map((s) => ({ id: s.sectionId, s: s.status, d: s.diff }))),
    );
    assert.ok(
      result.production.sectionStates.every((s) => s.diff?.status === "CLEAN"),
    );
    assert.equal(result.production.package.status, "READY_FOR_REVIEW");
    assert.equal(result.production.validation.ok, true);
    assert.equal(result.approved.ok, true);
    assert.equal(result.approved.package.status, "READY_TO_COMPILE");

    // Coverage
    assert.equal(result.coverage.ok, true, JSON.stringify(result.coverage.errors, null, 2));
    assert.equal(result.coverage.assignablePlayerCount, 5);
    assert.equal(result.coverage.stageCount, 3);
    assert.ok(result.coverage.stageCoverage.every((s) => s.hasHostSection));
    assert.ok(result.coverage.characterCoverage.every((c) => c.missingStageIds.length === 0));
    assert.equal(result.coverage.clueCoverage.missingInPackage.length, 0);
    assert.equal(result.coverage.clueCoverage.fidelityIssues.length, 0);
    assert.equal(result.coverage.truthCoverage.missingFinalTruthBeatIds.length, 0);
    assert.equal(result.coverage.endingCoverage.hasPlayableEndingContent, true);

    // Compile
    assert.equal(result.playable.status, "READY");
    const players = assignablePlayerRoles(result.approved.package);
    assert.equal(players.length, 5);
    assert.deepEqual(
      result.playable.stages.map((s) => s.id),
      ["act1", "act2", "act3"],
    );
    assert.equal(result.playable.runtimeConfig.startStageId, "act1");
    assert.equal(result.playable.runtimeConfig.finalStageId, "act3");
    const errorCodes = (result.playable.diagnostics || [])
      .filter((d) => d.severity === "ERROR")
      .map((d) => d.code);
    for (const code of [
      "UNKNOWN_STAGE_REF",
      "UNKNOWN_ROLE_REF",
      "ORPHAN_CONTENT",
      "ORPHAN_CLUE",
      "MISSING_ROLE_CONTENT",
    ]) {
      assert.equal(errorCodes.filter((c) => c === code).length, 0, code);
    }

    // Clue 1:1
    assert.ok(result.trace.clueTrace.every((t) => t.ok), JSON.stringify(result.trace.clueTrace.filter((t) => !t.ok)));

    // Trace: ContentUnit → section → provenance
    assert.ok(result.trace.sectionToContentUnit.length >= 10);
    assert.ok(
      result.trace.sectionToContentUnit.some(
        (row) =>
          row.visibility === "PRIVATE" &&
          (row.provenance.sourceBeatIds.length || row.provenance.sourceFactIds.length),
      ),
    );

    // Runtime
    const rp = result.trace.runtimeProof;
    assert.equal(rp.unassignedStartBlocked, true);
    assert.equal(rp.sessionStarted, true);
    assert.deepEqual(rp.stagesVisited, ["act1", "act2", "act3"]);
    assert.ok(rp.privacyChecks.every((c) => c.ok), JSON.stringify(rp.privacyChecks.filter((c) => !c.ok)));
    assert.ok(rp.clueChecks.length >= 1);
    assert.ok(rp.clueChecks.every((c) => c.ok), JSON.stringify(rp.clueChecks.filter((c) => !c.ok)));
    assert.equal(rp.refreshOk, true);
    assert.equal(rp.finished, true);
    assert.equal(rp.endingMode, "CONTENT_ONLY");
    assert.equal(rp.errors.length, 0, JSON.stringify(rp.errors));

    // Captures written
    for (const name of [
      "complete-script-package.json",
      "playable-project.json",
      "coverage-report.json",
      "runtime-trace.json",
    ]) {
      assert.ok(fs.existsSync(path.join(CAPTURE, name)), name);
    }
  });
});
