import assert from "node:assert/strict";
import test from "node:test";
import { runF7PlayableProjectSmoke, validateF7PackageBoundaries } from "./f7-playable-project-smoke.mjs";

test("F7 Gold CompleteScriptPackage compiles into the existing P7 runtime", () => {
  const result = runF7PlayableProjectSmoke();
  assert.equal(result.verdict, "F7_PASS");
  assert.equal(result.compile.status, "READY");
  assert.equal(result.roomSmoke.status, "RUNNING");
  assert.equal(result.roomSmoke.currentStageId, "act2");
  assert.equal(result.roomSmoke.playerViewsHideInternalMetadata, true);
  assert.equal(result.roomSmoke.p1P2PrivateIsolation, true);
  assert.equal(result.roomSmoke.m12RuntimeAdded, false);
  assert.equal(result.gameRegressionSentinel.M03, true);
  assert.equal(result.gameRegressionSentinel.M09, true);
});

test("F7 negative A rejects Formation production metadata in player-visible package content", () => {
  const result = runF7PlayableProjectSmoke();
  const broken = structuredClone(result.pkg);
  broken.roleScripts.role_P1[0].formationContext = { nodeId: "N10", beatId: "B3" };
  const validation = validateF7PackageBoundaries(broken);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.code === "FORMATION_INTERNAL_METADATA_LEAK"));
});

test("F7 negative B rejects assigning P1 Formation-aware section to P2", () => {
  const result = runF7PlayableProjectSmoke();
  const broken = structuredClone(result.pkg);
  broken.roleScripts.role_P2.push(structuredClone(broken.roleScripts.role_P1[0]));
  const validation = validateF7PackageBoundaries(broken);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.code === "PRIVATE_CONTENT_VISIBILITY_VIOLATION"));
});
