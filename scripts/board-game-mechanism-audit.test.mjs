import assert from "node:assert/strict";
import test from "node:test";
import { assertBoardGameMechanismAudit, createBoardGameMechanismAudit } from "../shared/board-game-mechanism-audit.js";

test("mechanism audit separates runnable abstractions from decomposition-only studies", () => {
  const audit = assertBoardGameMechanismAudit(createBoardGameMechanismAudit());
  assert.ok(audit.mechanismInventory.matrixCount >= 40);
  assert.ok(audit.mechanismInventory.status.supported > 0);
  assert.ok(audit.mechanismInventory.status.partial > 0);
  assert.equal(audit.commercialStudies.decompositionCount, 6);
  assert.equal(audit.commercialStudies.runnableBenchmarkCount, 6);
  assert.equal(audit.replicationConclusion.exactCommercialReplication, false);
  assert.equal(audit.replicationConclusion.coreMechanismReimplementation, "conditional");
  assert.equal(audit.universalKits.length, 4);
  assert.ok(audit.universalKits.every((kit) => kit.status === "runtime"));
  assert.ok(audit.replicationConclusion.nextGates.length >= 5);
  assert.ok(audit.commercialStudies.decompositions.every((item) => item.compositionReady && item.responseContractReady));
});
