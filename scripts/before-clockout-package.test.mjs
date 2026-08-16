import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildProposalFromMatrix,
  characterArchivesToRolesMeta,
  validateCharacterArchives,
  validateHostRunbooks,
  validateInfoMatrix,
  validateTruthBible
} from "../backend/src/pipeline-matrix-model.js";
import { compilePipelineMechanismPackage } from "../backend/src/pipeline-mechanism-package.js";
import { simulateMechanismPackage, summarizeMechanismSimulation } from "../backend/src/mechanism-simulator.js";
import { diagnoseScriptCollection } from "../shared/prose-quality-gate.js";
import { buildBeforeClockoutSession } from "./build-before-clockout-session.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repoRoot, "examples", "pending-review", "下班以前");

function validateSession(session) {
  const truthBible = validateTruthBible(session.truthBible, session.config, session.setting);
  const characterArchives = validateCharacterArchives(session.characterArchives, session.config, session.setting);
  const infoMatrix = validateInfoMatrix(session.infoMatrix, session.config, characterArchives, session.setting, truthBible);
  const hostRunbooks = validateHostRunbooks({ runbooks: session.hostRunbooks }, session.config, session.setting).runbooks;
  const proposal = buildProposalFromMatrix({ setting: session.setting, config: session.config, truthBible, infoMatrix });
  const mechanism = compilePipelineMechanismPackage({ ...session, truthBible, characterArchives, infoMatrix, hostRunbooks, proposal });
  return {
    truthBible,
    characterArchives,
    infoMatrix,
    hostRunbooks,
    proposal,
    roleMatrix: characterArchivesToRolesMeta(characterArchives, infoMatrix, session.config),
    mechanism
  };
}

test("《下班以前》foundation passes the production validators and compiles to a runtime package", async () => {
  const session = await buildBeforeClockoutSession();
  const packageValue = validateSession(session);
  assert.equal(packageValue.truthBible.playStructure, "faction");
  assert.equal(packageValue.truthBible.killer, "");
  assert.equal(packageValue.roleMatrix.roles.length, 6);
  assert.equal(packageValue.infoMatrix.rows.length, 24);
  assert.equal(packageValue.infoMatrix.clues.length, 18);
  assert.equal(packageValue.proposal.scenes.length, 8);
  assert.equal(packageValue.hostRunbooks.length, 4);
  assert.equal(packageValue.mechanism.reason, "matrix_contract");
  assert.ok(packageValue.mechanism.packageValue);
  for (const decision of packageValue.infoMatrix.decisions) {
    assert.ok(decision.defaultAxisEffects.some((effect) => effect.axisKey && effect.delta !== 0));
    const runtimeDecision = packageValue.mechanism.packageValue.decisionNodes.find((item) => item.key === decision.key);
    const fallback = runtimeDecision.options.find((item) => item.key === runtimeDecision.interaction.defaultOptionKey);
    assert.ok(fallback.effects.some((effect) => effect.targetType === "state"), `${decision.key} fallback is not executable`);
  }
});

test("all 320 authored/default paths execute, every ending is reachable, and the no-action path finishes", async () => {
  const packageValue = validateSession(await buildBeforeClockoutSession());
  const report = simulateMechanismPackage(packageValue.mechanism.packageValue);
  const summary = summarizeMechanismSimulation(report);
  assert.equal(summary.truncated, false);
  assert.equal(summary.pathCount, 320);
  assert.equal(summary.issueCount, 0);
  assert.deepEqual(new Set(summary.reachableEndingRouteKeys), new Set([
    "ending-coop", "ending-acquisition", "ending-split-line", "ending-liquidation"
  ]));
  assert.equal(summary.noActionStrategy.status, "completed");
  assert.equal(summary.noActionStrategy.resolvedEndingRouteKey, "ending-liquidation");
});

test("all 24 role-act cells pass the prose gate and have enough playable body", async () => {
  const session = await buildBeforeClockoutSession();
  const diagnostics = diagnoseScriptCollection(session.scripts, { expectedPov: session.setting?.pov });
  assert.equal(diagnostics.summary.totalCells, 24);
  assert.equal(diagnostics.summary.blockedCells, 0);
  assert.equal(diagnostics.summary.high, 0);
  for (const [roleKey, acts] of Object.entries(session.scripts)) {
    assert.deepEqual(Object.keys(acts), ["act1", "act2", "act3", "act4"], roleKey);
    for (const [actKey, script] of Object.entries(acts)) {
      assert.ok(script.body.length >= 900, `${roleKey}/${actKey} is underwritten`);
    }
  }
});

test("the printable package has standalone materials and graph documents", async () => {
  const clueFiles = (await readdir(path.join(packageRoot, "clues"))).filter((name) => name.endsWith(".md"));
  assert.equal(clueFiles.length, 18);
  for (const [index, clueFile] of clueFiles.sort().entries()) {
    const clueId = `C${String(index + 1).padStart(2, "0")}`;
    assert.ok(clueFile.startsWith(clueId), clueFile);
    const text = await readFile(path.join(packageRoot, "clues", clueFile), "utf8");
    assert.match(text, new RegExp(`^# ${clueId}｜`, "m"));
    assert.match(text, /核验边界/);
  }
  const mapFiles = (await readdir(path.join(packageRoot, "maps"))).filter((name) => name.endsWith(".md"));
  assert.equal(mapFiles.length, 4);
  for (const mapFile of mapFiles) {
    assert.match(await readFile(path.join(packageRoot, "maps", mapFile), "utf8"), /```mermaid/);
  }
  const materialFiles = (await readdir(path.join(packageRoot, "materials"))).filter((name) => name.endsWith(".md"));
  assert.equal(materialFiles.length, 5);
  for (const required of [
    "C09-203室三联附约-打印版.md",
    "C10-工艺数据授权书-打印版.md",
    "C15-最终分配表-打印版.md",
    "C18-最终处置封面-打印版.md",
  ]) {
    const text = await readFile(path.join(packageRoot, "materials", required), "utf8");
    assert.match(text, /签名|签署/);
    assert.match(text, /____/);
  }
  assert.match(await readFile(path.join(packageRoot, "host", "02-个人落点结算.md"), "utf8"), /不选“全场赢家”/);
});
