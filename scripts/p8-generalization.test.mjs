/**
 * P8.0B corpus + Machine Gate wiring tests.
 * Does not require all GEN cases to PASS gates — explosions are reported.
 * Asserts: 8 fixtures, schema, runner produces reports, A–H regression untouched path.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  GEN_CASE_IDS,
  P8_CASES_DIR,
  auditAllCases,
  auditOneCase,
  loadAllCaseFixtures,
  loadCaseFixture,
  listCaseFixturePaths,
} from "../shared/p8-generalization-runner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("P8.0B generalization corpus", () => {
  it("has exactly GEN-01..GEN-08 fixtures with schemaVersion 1", () => {
    const paths = listCaseFixturePaths();
    assert.equal(paths.length, 8);
    const fixtures = loadAllCaseFixtures().map((r) => r.fixture);
    assert.deepEqual(
      fixtures.map((f) => f.caseId),
      [...GEN_CASE_IDS],
    );
    for (const f of fixtures) {
      assert.equal(f.schemaVersion, 1);
      assert.ok(f.title);
      assert.ok(f.projectConfig?.playerCount);
      assert.ok(f.projectConfig?.stageCount);
      assert.ok(Array.isArray(f.storyPlan) && f.storyPlan.length >= 1);
      assert.ok(Array.isArray(f.characters));
      assert.equal(
        f.characters.filter((c) => !c.isNpc).length,
        f.projectConfig.playerCount,
      );
      assert.ok(f.expectedStructuralProperties);
      assert.ok(f.playableExpectation);
      assert.equal(f.playableExpectation.allowMissingCompleteScripts, true);
    }
  });

  it("does not treat A–H fidelity captures as GEN corpus", () => {
    const names = fs.readdirSync(P8_CASES_DIR);
    assert.ok(!names.some((n) => /A-standard|E-low-affinity|H-conditional/.test(n)));
    assert.ok(fs.existsSync(path.join(__dirname, "../captures/production-master-draft-p60")));
  });

  it("coverage matrix hits 5/6/7/8 players and 3/4/5 stages", () => {
    const fixtures = loadAllCaseFixtures().map((r) => r.fixture);
    const players = new Set(fixtures.map((f) => f.projectConfig.playerCount));
    const stages = new Set(fixtures.map((f) => f.projectConfig.stageCount));
    assert.deepEqual([...players].sort((a, b) => a - b), [5, 6, 7, 8]);
    assert.deepEqual([...stages].sort((a, b) => a - b), [3, 4, 5]);
    assert.ok(fixtures.some((f) => f.playableExpectation.requireCulprit === false));
    assert.ok(fixtures.some((f) => (f.gamePlan || []).length >= 3));
    assert.ok(fixtures.some((f) => f.expectedStructuralProperties.maxInterwoven === 0));
  });

  it("runner writes Machine Gate G1/G2/G3 reports for all cases without throwing", () => {
    const summary = auditAllCases({ writeCaptures: false });
    assert.equal(summary.results.length, 8);
    for (const r of summary.results) {
      assert.ok(r.caseId);
      assert.ok(Array.isArray(r.gates.G1));
      assert.ok(Array.isArray(r.gates.G2));
      assert.ok(Array.isArray(r.gates.G3));
      assert.equal(typeof r.gatePass.all, "boolean");
      if (!r.gatePass.all) {
        assert.ok(
          ["CONTRACT_FAILURE", "GENERATION_FAILURE", "CONTENT_QUALITY_FAILURE"].includes(
            r.failureClass,
          ),
        );
      }
    }
  });

  it("GEN-01 runs pipeline and asserts 5 players in project state", () => {
    const { fixture } = loadAllCaseFixtures().find((r) => r.fixture.caseId === "GEN-01");
    const { report, state } = auditOneCase(fixture, { writeCaptures: false });
    assert.equal(fixture.projectConfig.playerCount, 5);
    assert.equal(fixture.projectConfig.stageCount, 3);
    if (state) {
      assert.equal(state.premise.playerCount, 5);
      assert.equal(state.characters.filter((c) => !c.isNpc).length, 5);
      assert.equal(state.stages.length, 3);
    }
    assert.ok(report.gates.G1.length >= 1);
  });

  it("GEN-07 G2 reads nested contributions (not false-red on contributions=0)", () => {
    const { fixture } = loadAllCaseFixtures().find((r) => r.fixture.caseId === "GEN-07");
    const { report } = auditOneCase(fixture, { writeCaptures: false });
    const g2 = report.gates.G2.find((g) => g.id === "G2.complexContributionRoles");
    assert.ok(g2, "complexContributionRoles gate present");
    assert.equal(g2.pass, true, g2.message);
    assert.ok((g2.details?.contributions || 0) > 0);
  });

  it("GEN-02/07 G3 fails orphan GAME stage references (no false-green)", () => {
    for (const id of ["GEN-02", "GEN-07"]) {
      const { fixture } = loadAllCaseFixtures().find((r) => r.fixture.caseId === id);
      const { report } = auditOneCase(fixture, { writeCaptures: false });
      const g3 = report.gates.G3.find((g) => g.id === "G3.gameStageReferenceIntegrity");
      assert.ok(g3, `${id} integrity gate`);
      assert.equal(g3.pass, false, `${id} must fail orphan act5: ${g3.message}`);
      assert.equal(report.gatePass.G3, false);
    }
  });

  it("GEN-01/08 G1 flags 3-act final stage ESCALATION as semantic miss", () => {
    for (const id of ["GEN-01", "GEN-08"]) {
      const { fixture } = loadAllCaseFixtures().find((r) => r.fixture.caseId === id);
      const { report } = auditOneCase(fixture, { writeCaptures: false });
      const g1 = report.gates.G1.find((g) => g.id === "G1.finalStagePayoffSemantics");
      assert.ok(g1, `${id} payoff semantics gate`);
      assert.equal(g1.pass, false, `${id} final should not be ESCALATION: ${g1.message}`);
    }
  });
});
