import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const contract = JSON.parse(readFileSync(new URL("../examples/pending-review/未归还/logic-contract.json", import.meta.url), "utf8"));

test("showcase foundation is isolated and stays within the agreed format", () => {
  assert.equal(contract.title, "未归还");
  assert.equal(contract.status, "prototype_v1_ready_for_human_table");
  assert.equal(contract.format.playerCount, 4);
  assert.equal(contract.format.actCount, 3);
  assert.equal(contract.canonRules.usesPreviousStoryContent, false);
  assert.equal(contract.canonRules.murderMystery, false);
  assert.equal(contract.canonRules.lateEvidenceAllowed, false);
});

test("every canon fact has at least two distinct pieces of required evidence", () => {
  const evidenceIds = new Set(contract.evidence.map((item) => item.id));
  for (const fact of contract.facts) {
    assert.equal(fact.locked, true, `${fact.id} must be locked before manuscript writing`);
    assert.ok(fact.requiredEvidence.length >= 2, `${fact.id} needs independent evidence`);
    assert.equal(new Set(fact.requiredEvidence).size, fact.requiredEvidence.length, `${fact.id} repeats evidence`);
    for (const evidenceId of fact.requiredEvidence) {
      assert.ok(evidenceIds.has(evidenceId), `${fact.id} references missing ${evidenceId}`);
      const evidence = contract.evidence.find((item) => item.id === evidenceId);
      assert.ok(evidence.proves.includes(fact.id), `${evidenceId} must explicitly support ${fact.id}`);
    }
    const sourceGroups = fact.requiredEvidence.map((evidenceId) => contract.evidence.find((item) => item.id === evidenceId).sourceGroup);
    assert.equal(new Set(sourceGroups).size, sourceGroups.length, `${fact.id} relies on a single source group`);
  }
});

test("all evidence is available before the ending and has a bounded claim", () => {
  assert.equal(contract.evidence.length, 12);
  for (const evidence of contract.evidence) {
    assert.ok(evidence.actAvailable >= 1 && evidence.actAvailable <= 3, evidence.id);
    assert.ok(evidence.proves.length > 0, `${evidence.id} proves nothing`);
    assert.ok(evidence.doesNotProve.length > 0, `${evidence.id} needs a non-proof boundary`);
  }
  const actEvidence = contract.acts.flatMap((act) => act.availableEvidence);
  assert.equal(new Set(actEvidence).size, contract.evidence.length);
  for (const act of contract.acts) {
    for (const evidenceId of act.availableEvidence) {
      const evidence = contract.evidence.find((item) => item.id === evidenceId);
      assert.equal(evidence.actAvailable, act.sequence, `${evidenceId} is listed in the wrong act`);
    }
  }
});

test("twelve source items are presented as eight bounded gameplay packets", () => {
  assert.equal(contract.gameplayPackets.length, 8);
  const packedEvidence = contract.gameplayPackets.flatMap((packet) => packet.evidence);
  assert.equal(packedEvidence.length, contract.evidence.length);
  assert.equal(new Set(packedEvidence).size, contract.evidence.length);
});

test("every player owns evidence, a final power, a cost, and at least three actions", () => {
  assert.equal(contract.roles.length, 4);
  for (const role of contract.roles) {
    assert.ok(role.exclusiveEvidence.length >= 2, `${role.name} needs evidence agency`);
    assert.ok(role.exclusivePower.length > 0, `${role.name} needs final authority`);
    assert.ok(role.cost.length > 0, `${role.name} needs a cost`);
    assert.ok(role.privateResponsibility.length > 0, `${role.name} must participate in present-day responsibility`);
    assert.ok(role.finalActions.length >= 3, `${role.name} needs meaningful alternatives`);
  }
});

test("each ending has explicit requirements, gains, and plural costs", () => {
  assert.equal(contract.endings.length, 4);
  for (const ending of contract.endings) {
    assert.ok(ending.requirements.length >= 2, `${ending.id} has no state gate`);
    assert.ok(ending.gains.length > 0, `${ending.id} has no gain`);
    assert.ok(ending.costs.length >= 2, `${ending.id} is too cheap`);
  }
  assert.deepEqual(contract.endingResolutionOrder, ["END-C", "END-B", "END-A", "END-D"]);
});

test("the repair ending depends on all four non-transferable player powers", () => {
  const repair = contract.endings.find((ending) => ending.id === "END-B");
  for (const roleId of contract.roles.map((role) => role.id)) {
    assert.ok(repair.requirements.some((requirement) => requirement.startsWith(`${roleId}:`)), `${roleId} is replaceable in END-B`);
  }
});
