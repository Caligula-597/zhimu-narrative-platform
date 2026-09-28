import assert from "node:assert/strict";
import test from "node:test";
import { COMMERCIAL_MECHANISM_DECOMPOSITIONS, getCommercialMechanismDecomposition, summarizeCommercialMechanismDecompositions } from "../shared/commercial-mechanism-decompositions.js";
import { BOARD_GAME_MECHANISM_MODULES, composeBoardGameMechanisms } from "../shared/board-game-mechanism-composer.js";

const knownModules = new Set(BOARD_GAME_MECHANISM_MODULES.map((module) => module.id));

test("commercial decomposition catalog covers distinct mechanism families with balance layers", () => {
  assert.equal(COMMERCIAL_MECHANISM_DECOMPOSITIONS.length, 6);
  assert.equal(summarizeCommercialMechanismDecompositions().implementationStatuses.decomposition_only, 6);
  const ids = new Set();
  for (const item of COMMERCIAL_MECHANISM_DECOMPOSITIONS) {
    assert.ok(!ids.has(item.id), `duplicate decomposition id: ${item.id}`);
    ids.add(item.id);
    assert.ok(item.coreLoop.length >= 4, `${item.id}.coreLoop needs enough detail`);
    assert.ok(item.stateLayers.length >= 3, `${item.id}.stateLayers needs enough detail`);
    for (const field of ["decisionPressures", "balanceLevers", "onlineResponseContract"]) assert.ok(item[field].length >= 4, `${item.id}.${field} needs enough detail`);
    assert.ok(item.knownGaps.length >= 2, `${item.id}.knownGaps needs enough detail`);
    for (const field of ["payoff", "tempo", "denial", "scaling", "risk"]) assert.ok(item.cardRoleBalance[field], `${item.id}.cardRoleBalance.${field}`);
    for (const field of ["identity", "powerBudget", "counterplay", "seatRisk"]) assert.ok(item.roleBalance[field], `${item.id}.roleBalance.${field}`);
    for (const moduleId of item.requiredModules) assert.ok(knownModules.has(moduleId), `${item.id} references unknown module ${moduleId}`);
    for (const missing of item.missingModules) assert.ok(typeof missing === "string" && missing.length > 0);
    assert.ok(item.onlineResponseContract.some((line) => /原子|顺序|幂等|并发|回滚|审计|可见|回放/.test(line)), `${item.id} lacks a response safety contract`);
  }
});

test("standard response module is composable wherever complex card timing is needed", () => {
  const result = composeBoardGameMechanisms(["timing.reveal", "card.play", "effects.response_standard", "online.command_server"]);
  assert.equal(result.ready, true);
  assert.equal(result.implementationReady, true);
  assert.ok(result.capabilities.includes("effects.atomic"));
  assert.ok(result.capabilities.includes("effects.chain"));
  assert.ok(result.issues.every((issue) => issue.level !== "error"));
});

test("decomposition lookup returns a stable research record", () => {
  assert.equal(getCommercialMechanismDecomposition("root-asymmetric-factions")?.sourceGame, "Root");
  assert.equal(getCommercialMechanismDecomposition("unknown"), null);
});
