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

function snapshotPackets(snapshot) {
  return {
    host: {
      kind: "HOST_SCRIPT",
      formationContext: {
        ...snapshot,
        entries: [...snapshot.hostView.entries],
      },
    },
    roles: Object.entries(snapshot.characterViews).map(([characterId, characterView]) => ({
      kind: "ROLE_SCRIPT",
      characterId,
      formationContext: {
        ...snapshot,
        entries: [...characterView.entries],
      },
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
  const candidatePackets = snapshotPackets(snapshot);
  return { state, candidatePmd, candidatePackets, snapshot };
}

function mutateCharacterEntry(snapshot, characterId, nodeId, patch) {
  return {
    ...snapshot,
    characterViews: {
      ...snapshot.characterViews,
      [characterId]: {
        entries: snapshot.characterViews[characterId].entries.map((entry) =>
          entry.nodeId === nodeId ? { ...entry, ...patch } : entry,
        ),
      },
    },
  };
}

for (const [label, fixturePath] of [["Gold", GOLD_PATH], ["Alt", ALT_PATH]]) {
  test(`F5.2 ${label}: formal HOST/ROLE packets complete Formation survival`, () => {
    const { state, pmd, packets } = integratedArtifacts(fixturePath);
    const result = auditM12FormationProjectionSurvival({
      state,
      productionMasterDraft: pmd,
      packetSet: packets,
    });

    assert.equal(result.decision, "FORMATION_PROJECTION_SURVIVED");
    assert.equal(result.firstLossLayer, null);
    assert.equal(result.issues.length, 0);
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

test("F5.1 PMD bridge carries Gold semantics without touching the formal Packet builder", () => {
  const { state, pmd, packets } = integratedArtifacts(GOLD_PATH);
  const view = pmd.formationView;
  assert.ok(view);
  assert.deepEqual(view.sources.map((source) => source.artifactId), ["m12f-closed-after-hours-gold"]);
  assert.deepEqual(view.beats.map((beat) => beat.beatId), ["B1", "B2", "B3", "B4"]);

  const p1 = view.characterViews.P1.entries;
  const p2 = view.characterViews.P2.entries;
  const host = view.hostView.entries;
  const p1N10 = p1.find((entry) => entry.nodeId === "N10");
  const p1N9 = p1.find((entry) => entry.nodeId === "N9");
  const p1N11b = p1.find((entry) => entry.nodeId === "N11b");
  const p2N11 = p2.find((entry) => entry.nodeId === "N11");

  assert.equal(p1N10.projectionType, "OWNED_OBJECT");
  assert.deepEqual(p1N10.provenance.sourceRefs, ["gold:N10"]);
  assert.equal(p1N9.projectionType, "ACTIONABLE_INFERENCE");
  assert.equal(p1N9.inferenceStatus, "ACTIONABLE");
  assert.equal(p1N11b.projectionType, "OBSERVED_FACT");
  assert.equal(p2N11.projectionType, "SELF_KNOWN_NEED");
  assert.equal(p2.some((entry) => entry.nodeId === "N10"), false);
  assert.equal(p2.some((entry) => entry.nodeId === "N9"), false);
  assert.equal(host.some((entry) => entry.nodeId === "N10"), false);
  const p2Packet = packets.roles.find((packet) => packet.characterId === "P2");
  assert.ok(p2Packet);
  assert.equal(p2Packet.formationContext.entries.some((entry) => entry.nodeId === "N10"), false);
  assert.equal(p2Packet.formationContext.entries.some((entry) => entry.nodeId === "N9"), false);

  // F5.2 adds only the audience slice; it never exposes the full PMD view.
  assert.equal(packets.host.formationView, undefined);
  assert.ok(packets.host.formationContext);
  assert.ok(packets.host.formationContext.entries.every((entry) => entry.nodeId !== "N10"));
  assert.ok(packets.roles.every((packet) => packet.formationView === undefined));
  assert.ok(packets.clues.every((packet) => packet.formationContext === undefined));
  assert.ok(packets.publicStages.every((packet) => packet.formationContext === undefined));
  assert.equal(packets.ending.formationContext, undefined);
});

test("F5.1 no-Formation projects keep the additive view null", () => {
  const original = stateForFixture(GOLD_PATH);
  const stateWithoutFormation = createProjectStoryState({
    ...original,
    m12FormationArtifacts: [],
  });
  const integrated = integrateMasterOutline(stateWithoutFormation);
  const pmd = expandProductionMasterDraft(integrated);
  const packets = buildScriptProductionPacketSet(pmd);
  assert.equal(pmd.formationView, null);
  assert.equal(packets.host.formationContext, undefined);
  assert.ok(packets.roles.every((packet) => packet.formationContext === undefined));
  assert.deepEqual(
    pmd.stages.flatMap((stage) => stage.beats).map((beat) => beat.sourceBlockId),
    integrated.masterOutlineDraft.stages.flatMap((stage) => stage.beats).map((beat) => beat.sourceBlockId),
  );
});

test("F5 negative: deleting N10 provenance fails even when the object remains", () => {
  const { state, candidatePmd, candidatePackets, snapshot } = completeCandidate(GOLD_PATH);
  const mutated = mutateCharacterEntry(snapshot, "P1", "N10", {
    provenance: { type: null, summary: null, sourceRefs: [] },
  });
  const result = auditM12FormationProjectionSurvival({
    state,
    productionMasterDraft: { ...candidatePmd, formationView: mutated },
    packetSet: snapshotPackets(mutated),
  });
  assert.equal(result.decision, "FORMATION_PROJECTION_LOSS");
  assert.ok(result.issues.some((item) => item.code === "FORMATION_PROVENANCE_NOT_SURVIVED" && item.nodeId === "N10"));
});

test("F5 negative: N9 cannot be upgraded from ACTIONABLE_INFERENCE to Canon fact", () => {
  const { state, candidatePmd, snapshot } = completeCandidate(GOLD_PATH);
  const mutated = mutateCharacterEntry(snapshot, "P1", "N9", {
    projectionType: "CANON_FACT",
    inferenceStatus: "CANON_FACT",
    confidence: null,
  });
  const result = auditM12FormationProjectionSurvival({
    state,
    productionMasterDraft: { ...candidatePmd, formationView: mutated },
    packetSet: snapshotPackets(mutated),
  });
  assert.equal(result.decision, "FORMATION_PROJECTION_LOSS");
  assert.ok(result.issues.some((item) => item.code === "FORMATION_INFERENCE_SEMANTICS_NOT_SURVIVED" && item.nodeId === "N9"));
});

test("F5.2 negative: injecting P1 private N10 into P2 fails visibility audit", () => {
  const { state, candidatePmd, snapshot } = completeCandidate(GOLD_PATH);
  const p1N10 = snapshot.characterViews.P1.entries.find((entry) => entry.nodeId === "N10");
  const mutated = {
    ...snapshot,
    characterViews: {
      ...snapshot.characterViews,
      P2: {
        entries: [...snapshot.characterViews.P2.entries, { ...p1N10 }],
      },
    },
  };
  const result = auditM12FormationProjectionSurvival({
    state,
    productionMasterDraft: { ...candidatePmd, formationView: mutated },
    packetSet: snapshotPackets(mutated),
  });
  assert.equal(result.decision, "FORMATION_PROJECTION_LOSS");
  assert.ok(result.issues.some((item) => item.code === "FORMATION_PRIVATE_VISIBILITY_LEAK" && item.audienceId === "P2" && item.nodeId === "N10"));
});
