/**
 * P8.2.0 — Package contract, Gate, Packets, Validator, Playable adapter (no LLM)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMPLETE_SCRIPT_PACKAGE_VERSION,
  normalizeCompleteScriptPackage,
} from "../shared/complete-script-package-contracts.js";
import { evaluateScriptProductionReadiness } from "../shared/script-production-gate.js";
import {
  buildScriptProductionPacketSet,
  rolePacketHasNoForeignOwnerLeak,
} from "../shared/script-production-packets.js";
import { assembleCompleteScriptDraftFromPmd } from "../shared/complete-script-draft-assembler.js";
import { validateCompleteScriptPackage } from "../shared/complete-script-validator.js";
import {
  compileCompleteScriptPackage,
  toPlayableCompileSource,
} from "../shared/complete-script-playable-adapter.js";
import {
  buildProjectStoryStateFromFixture,
  listCaseFixturePaths,
  loadCaseFixture,
} from "../shared/p8-generalization-runner.js";
import { integrateMasterOutline } from "../shared/master-outline-integrator.js";
import { expandProductionMasterDraft } from "../shared/production-master-draft-expander.js";

const FIXED_NOW = () => "2026-09-05T12:00:00.000Z";

function loadGen01Pmd() {
  const paths = listCaseFixturePaths();
  const gen01 = paths.find((p) => path.basename(p).startsWith("GEN-01"));
  assert.ok(gen01, "GEN-01 fixture");
  const fixture = loadCaseFixture(gen01);
  let state = buildProjectStoryStateFromFixture(fixture);
  state = integrateMasterOutline(state, { now: FIXED_NOW });
  return expandProductionMasterDraft(state, {
    now: FIXED_NOW,
    title: `${fixture.caseId} ${fixture.title}`,
  });
}

describe("P8.2.0 ProductionGate", () => {
  it("classifies OWNER_UNRESOLVED as blocker and MISSING_CLUE_DETAIL as fillable", () => {
    const blocked = evaluateScriptProductionReadiness({
      stages: [{ stageId: "s1", beats: [] }],
      characterViews: { characters: [{ characterId: "A", stages: [] }] },
      warnings: [
        { id: "1", type: "OWNER_UNRESOLVED", severity: "info", message: "缺 OWNER" },
        { id: "2", type: "MISSING_CLUE_DETAIL", severity: "info", message: "缺线索" },
        { id: "3", type: "STAGE_CROWDING", severity: "warn", message: "拥挤" },
      ],
    });
    assert.equal(blocked.status, "BLOCKED");
    assert.equal(blocked.blockers.length, 1);
    assert.equal(blocked.fillableGaps.length, 1);
    assert.equal(blocked.advisories.length, 1);

    const ready = evaluateScriptProductionReadiness({
      stages: [{ stageId: "s1", beats: [] }],
      characterViews: { characters: [{ characterId: "A", stages: [] }] },
      warnings: [{ id: "2", type: "MISSING_CLUE_DETAIL", severity: "info", message: "缺线索" }],
    });
    assert.equal(ready.status, "READY_WITH_WARNINGS");
  });
});

describe("P8.2.0 Packets from GEN-01 PMD", () => {
  it("builds host/role/clue/public/ending packets with provenance ids from PMD", () => {
    const pmd = loadGen01Pmd();
    const packets = buildScriptProductionPacketSet(pmd);
    assert.equal(packets.host.kind, "HOST_SCRIPT");
    assert.ok(packets.roles.length >= 5);
    assert.ok(packets.clues.length >= 1);
    assert.ok(packets.publicStages.length >= 3);
    assert.equal(packets.ending.kind, "ENDING");
    assert.ok(packets.ending.finalStageId);
    assert.ok(!("correctCulpritId" in packets.ending));

    for (const role of packets.roles) {
      assert.ok(rolePacketHasNoForeignOwnerLeak(role, pmd));
      assert.ok(role.sourceBeatIds.length >= 0);
      for (const st of role.stages) {
        assert.ok(Array.isArray(st.allowedFactIds));
        assert.ok(Array.isArray(st.forbiddenFactIds));
      }
    }

    const stageIds = new Set(pmd.stages.map((s) => s.stageId));
    for (const ps of packets.publicStages) {
      assert.ok(stageIds.has(ps.stageId));
    }
  });
});

describe("P8.2.0 CompleteScriptPackage + Playable adapter", () => {
  it("GEN-01 draft package validates and compiles without teaching compiler PMD", () => {
    const pmd = loadGen01Pmd();
    const { package: pkg, gate, packets } = assembleCompleteScriptDraftFromPmd(pmd, {
      projectId: "gen-01",
      now: FIXED_NOW,
    });
    assert.equal(pkg.version, COMPLETE_SCRIPT_PACKAGE_VERSION);
    assert.notEqual(gate.status, "BLOCKED");
    assert.ok(["DRAFT", "READY_FOR_REVIEW", "READY_TO_COMPILE"].includes(pkg.status));

    const validation = validateCompleteScriptPackage({ pmd, packetSet: packets, package: pkg });
    assert.equal(validation.ok, true, JSON.stringify(validation.errors, null, 2));

    const source = toPlayableCompileSource(pkg);
    assert.equal(source.metadata.sourceType, "COMPLETE_SCRIPT_PACKAGE");
    assert.ok(source.roles.some((r) => r.type === "HOST"));
    assert.equal(
      source.roles.filter((r) => r.type === "PLAYER").length,
      pmd.characterViews.characters.length,
    );

    const playable = compileCompleteScriptPackage(pkg, {
      now: FIXED_NOW,
      projectId: "gen-01-playable",
    });
    assert.ok(playable);
    assert.ok(["READY", "DRAFT", "INVALID"].includes(playable.status));
    // Prefer READY; if INVALID surface diagnostics for debug
    if (playable.status !== "READY") {
      assert.fail(`expected READY playable, got ${playable.status}: ${JSON.stringify(playable.diagnostics || playable.errors || playable, null, 2).slice(0, 2000)}`);
    }
  });

  it("normalize round-trip preserves warehouse-shaped keys", () => {
    const normalized = normalizeCompleteScriptPackage({
      id: "csp-t",
      roles: [{ id: "role_host", name: "H", type: "HOST" }],
      stages: [{ id: "s1", order: 0, title: "一" }],
      hostScript: { sections: [{ id: "h1", stageId: "s1", paragraphs: ["a"] }] },
      roleScripts: {},
      clues: [],
    });
    assert.equal(normalized.version, 1);
    assert.equal(normalized.hostScript.sections[0].paragraphs[0], "a");
  });
});
