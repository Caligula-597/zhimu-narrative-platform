/**
 * F4C — Formation Beat → Master Outline placement sidecar tests.
 *
 * Scope: state-authoritative placement/ref only. No PMD, Writer, GAME, or Runtime.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  integrateMasterOutline,
  writeMasterOutlineDraft,
} from "../shared/master-outline-integrator.js";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";

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

function stateForFixture(filePath, { includeProbe = true } = {}) {
  const fixture = loadJson(filePath);
  const block = {
    id: fixture.sourceBlockId,
    mechanismId: "m12-1",
    familyId: "M12",
    templateId: "M12-1",
    title: "M12 Formation integration fixture",
    revision: fixture.sourceBlockRevision,
    status: "USER_ACCEPTED",
    roleBindings: {
      bargainA: { id: fixture.participants.seekerId, name: "Seeker" },
      bargainB: { id: fixture.participants.holderId, name: "Holder" },
    },
    setup: includeProbe ? [m12Beat("probe", "PROBE", "PROBE", fixture.participants.seekerId)] : [],
    progression: [m12Beat("negotiate", "NEGOTIATE", "NEGOTIATE", fixture.participants.holderId)],
    climax: [m12Beat("exchange", "EXCHANGE", "EXCHANGE", fixture.participants.seekerId)],
    resolution: [m12Beat("aftermath", "AFTERMATH", "CONSEQUENCE", fixture.participants.holderId)],
  };
  return createProjectStoryState({
    projectId: fixture.projectId,
    revision: 11,
    characters: [
      { id: fixture.participants.seekerId, name: "Seeker" },
      { id: fixture.participants.holderId, name: "Holder" },
    ],
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

function placementById(draft, beatId) {
  return draft.formationBeatPlacements.find((row) => row.beatId === beatId);
}

function probeAnchor(draft, sourceBlockId) {
  for (const stage of draft.stages) {
    const index = stage.beats.findIndex(
      (beat) => beat.sourceBlockId === sourceBlockId && beat.semantics?.actionKind === "PROBE",
    );
    if (index >= 0) return { stage, index };
  }
  return null;
}

function assertFormationSidecarOnly(draft) {
  assert.ok(Array.isArray(draft.formationBeatPlacements));
  assert.ok(Array.isArray(draft.formationIntegration.warnings));
  for (const row of draft.formationBeatPlacements) {
    assert.deepEqual(Object.keys(row).sort(), [
      "artifactId",
      "artifactRevision",
      "beatId",
      "order",
      "sourceBlockId",
      "stageId",
    ]);
  }
  assert.ok(!JSON.stringify(draft).includes("audienceViews"));
  assert.ok(!JSON.stringify(draft).includes("requiredNodeRefs"));
  assert.ok(!draft.stages.flatMap((stage) => stage.beats).some((beat) => /^B[1-4]$/.test(beat.id)));
}

test("F4C Gold: all Formation Beats get refs before the M12 PROBE anchor", () => {
  const state = stateForFixture(GOLD_PATH);
  const next = integrateMasterOutline(state, {
    artifact: { id: "caller-forged" },
    formationBeats: [{ id: "caller-forged-beat" }],
  });
  const draft = next.masterOutlineDraft;
  const artifact = loadJson(GOLD_PATH);
  assert.deepEqual(draft.formationBeatPlacements.map((row) => row.beatId), ["B1", "B2", "B3", "B4"]);
  assert.ok(draft.formationBeatPlacements.every((row) => row.artifactId === artifact.id));
  assert.equal(draft.formationIntegration.sourceRevision, artifact.revision);
  assertFormationSidecarOnly(draft);

  const anchor = probeAnchor(draft, artifact.sourceBlockId);
  assert.ok(anchor);
  for (const row of draft.formationBeatPlacements) {
    assert.equal(row.stageId, anchor.stage.id);
    assert.ok(row.order < anchor.index, `${row.beatId} must precede PROBE`);
  }
  assert.ok(placementById(draft, "B2").order > placementById(draft, "B1").order);
  assert.ok(placementById(draft, "B4").order > placementById(draft, "B2").order);
  assert.ok(placementById(draft, "B4").order > placementById(draft, "B3").order);
});

test("F4C Alt: placement is state-derived and topology-agnostic", () => {
  const state = stateForFixture(ALT_PATH);
  const next = integrateMasterOutline(state);
  const draft = next.masterOutlineDraft;
  const artifact = loadJson(ALT_PATH);
  assert.deepEqual(draft.formationBeatPlacements.map((row) => row.beatId), ["B1", "B2", "B3", "B4"]);
  assert.ok(draft.formationBeatPlacements.every((row) => row.artifactId === artifact.id));
  assertFormationSidecarOnly(draft);
});

test("F4C is deterministic and idempotent for the same state", () => {
  const state = stateForFixture(GOLD_PATH);
  const first = integrateMasterOutline(state).masterOutlineDraft.formationBeatPlacements;
  const second = integrateMasterOutline(state).masterOutlineDraft.formationBeatPlacements;
  assert.deepEqual(second, first);
});

test("F4C hard negative: unsatisfied requiresBeatIds is rejected on write", () => {
  const state = stateForFixture(GOLD_PATH);
  const draft = integrateMasterOutline(state).masterOutlineDraft;
  const b1 = placementById(draft, "B1");
  const b2 = placementById(draft, "B2");
  b2.order = b1.order - 1;
  assert.throws(
    () => writeMasterOutlineDraft(state, draft),
    (error) => error.code === "FORMATION_BEAT_CAUSAL_ORDER_VIOLATION",
  );
});

test("F4C soft negative: preferredAfter violation warns but does not block", () => {
  const state = stateForFixture(GOLD_PATH);
  const draft = integrateMasterOutline(state).masterOutlineDraft;
  const b1 = placementById(draft, "B1");
  const b4 = placementById(draft, "B4");
  b4.order = b1.order - 1;
  const next = writeMasterOutlineDraft(state, draft);
  assert.ok(
    next.masterOutlineDraft.formationIntegration.warnings.some(
      (warning) => warning.code === "FORMATION_PREFERRED_ORDER_UNSATISFIED" && warning.beatId === "B4",
    ),
  );
});

test("F4C refuses to guess when the M12 PROBE anchor is absent", () => {
  const state = stateForFixture(GOLD_PATH, { includeProbe: false });
  assert.throws(
    () => integrateMasterOutline(state),
    (error) => error.code === "FORMATION_RESOLUTION_ANCHOR_MISSING",
  );
});
