/**
 * P10.1 Owner Binding Closure — primaryRole slots must bind; intentional overlap is advisory.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import {
  listCaseFixturePaths,
  loadCaseFixture,
  buildProjectStoryStateFromFixture,
} from "../shared/p8-generalization-runner.js";
import { integrateMasterOutline } from "../shared/master-outline-integrator.js";
import { expandProductionMasterDraft } from "../shared/production-master-draft-expander.js";
import { evaluateScriptProductionReadiness } from "../shared/script-production-gate.js";
import { listPrimaryOwnerSlots } from "../shared/complete-beat-semantics-data.js";
import { generateStoryMechanism, acceptStoryBlock } from "../shared/story-mechanism-engine.js";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";

const FIXED = () => "2026-09-06T12:30:00.000Z";

function loadGate(caseId) {
  const file = listCaseFixturePaths().find((p) => path.basename(p).startsWith(caseId));
  const fixture = loadCaseFixture(file);
  let state = buildProjectStoryStateFromFixture(fixture);
  state = integrateMasterOutline(state, { now: FIXED });
  const pmd = expandProductionMasterDraft(state, { now: FIXED, title: fixture.title });
  return { fixture, pmd, gate: evaluateScriptProductionReadiness(pmd) };
}

describe("P10.1 Owner Binding Closure", () => {
  it("lists M08-1 primary owner slots including defector", () => {
    assert.ok(listPrimaryOwnerSlots("M08-1").includes("defector"));
  });

  it("binds defector for M08-1 even when template previously omitted the slot", () => {
    const state = createProjectStoryState({
      projectId: "p101-m08",
      premise: { genre: "test", playerCount: 5 },
      characters: [
        { id: "c1", name: "甲" },
        { id: "c2", name: "乙" },
        { id: "c3", name: "丙" },
        { id: "c4", name: "丁" },
        { id: "c5", name: "戊" },
      ],
      stages: [
        { id: "act1", label: "一", order: 0 },
        { id: "act2", label: "二", order: 1 },
        { id: "act3", label: "三", order: 2 },
        { id: "act4", label: "四", order: 3 },
      ],
    });
    let next = generateStoryMechanism({
      templateId: "M08-1",
      projectStoryState: state,
      preferredVariantId: "V07",
      intentionalOverlap: false,
    });
    const block = next.mechanismBlocks.find((b) => b.templateId === "M08-1");
    assert.ok(block?.roleBindings?.defector?.id, "defector must be bound");
    next = acceptStoryBlock(next, block.id);
    assert.ok(next.roleAssignments.some((r) => r.slotId === "defector"));
  });

  it("unblocks previously OWNER-blocked GEN cases into production", () => {
    for (const caseId of ["GEN-02", "GEN-04", "GEN-05", "GEN-06", "GEN-07"]) {
      const { gate } = loadGate(caseId);
      const ownerBlocks = gate.blockers.filter((b) => b.type === "OWNER_UNRESOLVED");
      assert.equal(ownerBlocks.length, 0, `${caseId} still OWNER_UNRESOLVED: ${JSON.stringify(ownerBlocks)}`);
      assert.notEqual(gate.status, "BLOCKED", `${caseId} gate=${gate.status}`);
    }
  });

  it("does not block GEN-07 on intentional-overlap weave candidates", () => {
    const { pmd, gate } = loadGate("GEN-07");
    assert.notEqual(gate.status, "BLOCKED");
    assert.ok(!gate.blockers.some((b) => b.type === "UNRESOLVED_CONFLICT"));
    assert.ok(!gate.blockers.some((b) => b.type === "INTENTIONAL_OVERLAP_CANDIDATE"));
    // If the candidate warning exists, it must be advisory-classified (not blocker).
    const intentional = (pmd.warnings || []).filter((w) => w.type === "INTENTIONAL_OVERLAP_CANDIDATE");
    for (const w of intentional) {
      assert.ok(gate.advisories.some((a) => a.id === w.id || a.message === w.message));
    }
  });
});
