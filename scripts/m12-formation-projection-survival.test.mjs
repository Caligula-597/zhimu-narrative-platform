/**
 * F5 — Formation Projection Survival V1 tests.
 *
 * These tests intentionally keep P6 / formal Packet builders unchanged. The
 * first group proves the current production path loses Formation at PMD. The
 * second group uses an in-memory complete snapshot only to prove the probe's
 * semantic negative fixtures: node presence alone cannot pass provenance or
 * inference checks.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";
import { integrateMasterOutline } from "../shared/master-outline-integrator.js";
import { expandProductionMasterDraft } from "../shared/production-master-draft-expander.js";
import { buildScriptProductionPacketSet } from "../shared/script-production-packets.js";
import {
  auditM12FormationProjectionSurvival,
  buildM12FormationSurvivalExpectation,
} from "../shared/m12-formation-projection-survival.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GOLD_PATH = path.join(root, "fixtures/m12-formation/closed-after-hours-gold.json");
const ALT_PATH = path.join(root, "fixtures/m12-formation/sealed-room-alt-topology.json");

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function m12Beat(id, stageKey, actionKind, actor) {
  return {
    id,
    stageKey,
    summary: `${actionKind} · ${stageKey}`,
    involvedRoleKeys: ["bargainA", "bargainB"],
    semantics: {
      actorRefs: [actor],
      actorLabel: actor,
      goal: `${actionKind} goal`,
      action: `${actionKind} action`,
      target: "M12 stake",
      requires: [],
      produces: [],
      actionKind,
      independence: actionKind === "PROBE" ? "INDEPENDENT" : "DEPENDENT",
    },
  };
}

function stateForFixture(filePath) {
  const fixture = loadJson(filePath);
  const block = {
    id: fixture.sourceBlockId,
    mechanismId: "m12-1",
    familyId: "M12",
    templateId: "M12-1",
    title: "M12 Formation survival fixture",
    revision: fixture.sourceBlockRevision,
    status: "USER_ACCEPTED",
    roleBindings: {
      bargainA: { id: fixture.participants.seekerId, name: "Seeker" },
      bargainB: { id: fixture.participants.holderId, name: "Holder" },
    },
    setup: [m12Beat("probe", "PROBE", "PROBE", fixture.participants.seekerId)],
    progression: [m12Beat("negotiate", "NEGOTIATE", "NEGOTIATE", fixture.participants.holderId)],
    climax: [m12Beat("exchange", "EXCHANGE", "EXCHANGE", fixture.participants.seekerId)],
    resolution: [m12Beat("aftermath", "AFTERMATH", "CONSEQUENCE", fixture.participants.holderId)],
  };
  return createProjectStoryState({
    projectId: fixture.projectId,
    revision: 11,
    characters: ["P1", "P2", "P3", "P4", "P5", "P6"].map((id) => ({ id, name: id })),
    stages: [
      { id: "act1", label: "第一幕", order: 0 },
      { id: "act2", label: "第二幕", order: 1 },
      { id: "act3", label: "第三幕", order: 2 },
      { id: "act4", label: "第四幕", order: 3 },
    ],
    mechanismBlocks: [block],
    m12FormationArtifacts: [fixture],
  });
}

function integratedArtifacts(filePath) {
  const integrated = integrateMasterOutline(stateForFixture(filePath));
  const pmd = expandProductionMasterDraft(integrated);
  const packets = buildScriptProductionPacketSet(pmd);
  return { state: integrated, pmd, packets };
}

function snapshotPackets(snapshot, artifactId) {
  const view = { ...snapshot, audienceFacts: [...snapshot.audienceFacts] };
  const hostFacts = view.audienceFacts.filter((fact) => fact.audienceType === "HOST");
  const roleFacts = new Map();
  for (const fact of view.audienceFacts) {
    if (fact.audienceType !== "CHARACTER") continue;
    if (!roleFacts.has(fact.audienceId)) roleFacts.set(fact.audienceId, []);
    roleFacts.get(fact.audienceId).push(fact);
  }
  return {
    host: {
      kind: "HOST_SCRIPT",
      formationView: { ...view, audienceFacts: hostFacts, artifactId },
    },
    roles: [...roleFacts.entries()].map(([characterId, audienceFacts]) => ({
      kind: "ROLE_SCRIPT",
      characterId,
      formationView: { ...view, audienceFacts, artifactId },
    })),
  };
}

function completeCandidate(filePath) {
  const { state, pmd, packets } = integratedArtifacts(filePath);
  const artifact = state.m12FormationArtifacts[0];
  const snapshot = buildM12FormationSurvivalExpectation({
    state,
    artifactId: artifact.id,
    masterOutlineDraft: state.masterOutlineDraft,
  });
  const candidatePmd = { ...pmd, formationView: snapshot };
  const candidatePackets = snapshotPackets(snapshot, artifact.id);
  return { state, candidatePmd, candidatePackets, snapshot };
}

for (const [label, fixturePath] of [["Gold", GOLD_PATH], ["Alt", ALT_PATH]]) {
  test(`F5 ${label}: current P6/Packet path reports the first Formation loss`, () => {
    const { state, pmd, packets } = integratedArtifacts(fixturePath);
    const result = auditM12FormationProjectionSurvival({
      state,
      productionMasterDraft: pmd,
      packetSet: packets,
    });

    assert.equal(result.decision, "FORMATION_PROJECTION_LOSS");
    assert.equal(result.firstLossLayer, "PRODUCTION_MASTER_DRAFT");
    assert.ok(result.issues.some((item) => item.code === "FORMATION_BEAT_REFS_MISSING"));
    assert.ok(result.issues.some((item) => item.code === "FORMATION_PMD_VIEW_MISSING"));
    assert.ok(result.issues.some((item) => item.code === "FORMATION_PACKET_VIEW_MISSING"));
    const beatLoss = result.issues.find((item) => item.code === "FORMATION_BEAT_REFS_MISSING");
    assert.deepEqual(beatLoss.beatIds, ["B1", "B2", "B3", "B4"]);
    assert.equal(result.llmCalls, 0);
  });
}

test("F5 complete deterministic snapshot passes without calling a model", () => {
  const { state, candidatePmd, candidatePackets } = completeCandidate(GOLD_PATH);
  const result = auditM12FormationProjectionSurvival({
    state,
    productionMasterDraft: candidatePmd,
    packetSet: candidatePackets,
  });
  assert.equal(result.decision, "FORMATION_PROJECTION_SURVIVED");
  assert.equal(result.issues.length, 0);
  assert.equal(result.llmCalls, 0);
});
test("F5 negative: deleting N10 provenance fails even when the object remains", () => {
  const { state, candidatePmd, candidatePackets, snapshot } = completeCandidate(GOLD_PATH);
  const mutated = {
    ...snapshot,
    audienceFacts: snapshot.audienceFacts.map((fact) =>
      fact.nodeId === "N10" && fact.audienceId === "P1"
        ? { ...fact, provenance: { type: null, summary: null, sourceRefs: [] } }
        : fact,
    ),
  };
  const result = auditM12FormationProjectionSurvival({
    state,
    productionMasterDraft: { ...candidatePmd, formationView: mutated },
    packetSet: snapshotPackets(mutated, state.m12FormationArtifacts[0].id),
  });
  assert.equal(result.decision, "FORMATION_PROJECTION_LOSS");
  assert.ok(result.issues.some((item) => item.code === "FORMATION_PROVENANCE_NOT_SURVIVED" && item.nodeId === "N10"));
});

test("F5 negative: N9 cannot be upgraded from ACTIONABLE_INFERENCE to Canon fact", () => {
  const { state, candidatePmd, snapshot } = completeCandidate(GOLD_PATH);
  const mutated = {
    ...snapshot,
    audienceFacts: snapshot.audienceFacts.map((fact) =>
      fact.nodeId === "N9" && fact.audienceId === "P1"
        ? { ...fact, projectionType: "CANON_FACT", inferenceStatus: "CANON_FACT", confidence: null }
        : fact,
    ),
  };
  const result = auditM12FormationProjectionSurvival({
    state,
    productionMasterDraft: { ...candidatePmd, formationView: mutated },
    packetSet: snapshotPackets(mutated, state.m12FormationArtifacts[0].id),
  });
  assert.equal(result.decision, "FORMATION_PROJECTION_LOSS");
  assert.ok(result.issues.some((item) => item.code === "FORMATION_INFERENCE_SEMANTICS_NOT_SURVIVED" && item.nodeId === "N9"));
});
