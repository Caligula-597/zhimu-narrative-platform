/**
 * P8.2.1 Script Production Orchestrator — GEN-01 approve → compile
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DeterministicTestScriptWriter,
} from "../shared/deterministic-test-script-writer.js";
import {
  approveCompleteScriptPackage,
  runScriptProduction,
} from "../shared/script-production-orchestrator.js";
import { compileCompleteScriptPackage } from "../shared/complete-script-playable-adapter.js";
import { FIXED_NOW, loadGen01Pmd } from "./p821-gen01-fixture.mjs";

describe("P8.2.1 orchestrator GEN-01 vertical", () => {
  it("Packet→Writer→Diff→approve→Compiler READY", async () => {
    const pmd = loadGen01Pmd();
    const out = await runScriptProduction({
      pmd,
      writer: new DeterministicTestScriptWriter(),
      projectId: "gen-01-writer",
      now: FIXED_NOW,
    });
    assert.notEqual(out.gate.status, "BLOCKED");
    assert.ok(
      out.sectionStates.every((s) => s.status === "GENERATED"),
      JSON.stringify(
        out.sectionStates.map((s) => ({ id: s.sectionId, status: s.status, err: s.diff?.errors })),
      ),
    );
    assert.equal(out.package.status, "READY_FOR_REVIEW");
    assert.equal(out.validation.ok, true, JSON.stringify(out.validation.errors));

    const approved = approveCompleteScriptPackage(out.package, out.validation, {
      sectionStates: out.sectionStates,
    });
    assert.equal(approved.ok, true, approved.reason);
    assert.equal(approved.package.status, "READY_TO_COMPILE");

    const playable = compileCompleteScriptPackage(approved.package, {
      now: FIXED_NOW,
      projectId: "gen-01-writer-playable",
    });
    assert.equal(playable.status, "READY");
  });

  it("does not call writer path via PMD dump — request carries packet only", async () => {
    const pmd = loadGen01Pmd();
    let sawPmd = false;
    const writer = {
      async write(request) {
        if (request.pmd || request.productionMasterDraft) sawPmd = true;
        assert.ok(request.packet);
        assert.equal(request.constraints.mayAddCanonicalFacts, false);
        return new DeterministicTestScriptWriter().write(request);
      },
    };
    await runScriptProduction({ pmd, writer, projectId: "boundary", now: FIXED_NOW });
    assert.equal(sawPmd, false);
  });
});
