/**
 * F1 — M12 Formation Artifact contract + persistence tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createProjectStoryState,
  normalizeProjectStoryState,
} from "../shared/story-mechanism-contracts.js";
import {
  normalizeM12FormationArtifact,
  normalizeFormationNode,
  upsertM12FormationArtifact,
  updateM12FormationNode,
  refreshM12FormationArtifactStaleStatus,
  artifactHasCompleteFieldRefs,
  assertNoCanonPollutionFromInferences,
  assertLeverageEdgesAreOpen,
  FORMATION_FIELD_KEYS,
  M12_FORMATIONATION_FORBIDDEN_ARTIFACT_STATUSES,
} from "../shared/m12-formation-contracts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GOLD_PATH = path.join(root, "fixtures/m12-formation/closed-after-hours-gold.json");

function loadGold() {
  return JSON.parse(fs.readFileSync(GOLD_PATH, "utf8"));
}

test("F1 gold fixture normalizes and keeps N1–N12 + N8a/N8b/N11a/N11b", () => {
  const gold = normalizeM12FormationArtifact(loadGold());
  const ids = gold.nodes.map((n) => n.id).sort();
  for (const id of [
    "N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N8a", "N8b",
    "N9", "N10", "N11", "N11a", "N11b", "N12",
  ]) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
  assert.equal(gold.templateId, "M12-1");
  assert.equal(gold.participants.seekerId, "P1");
  assert.equal(gold.participants.holderId, "P2");
  assert.equal(gold.status, "READY_FOR_VALIDATION");
  assert.ok(!M12_FORMATIONATION_FORBIDDEN_ARTIFACT_STATUSES.includes(gold.status));
});

test("F1 eight formation fields are node refs only (no duplicated prose facts)", () => {
  const gold = normalizeM12FormationArtifact(loadGold());
  const ids = new Set(gold.nodes.map((n) => n.id));
  for (const key of FORMATION_FIELD_KEYS) {
    const field = gold.formation[key];
    assert.ok(field.nodeIds.length, `${key} empty`);
    assert.equal(Object.keys(field).join(","), "nodeIds", `${key} must only carry nodeIds`);
    for (const id of field.nodeIds) {
      assert.ok(ids.has(id), `${key} → missing ${id}`);
    }
  }
  assert.ok(artifactHasCompleteFieldRefs(gold));
});

test("F1 N8 is LEVERAGE_EDGE OPEN, not exchange event", () => {
  const gold = normalizeM12FormationArtifact(loadGold());
  const n8 = gold.nodes.find((n) => n.id === "N8");
  assert.equal(n8.kind, "LEVERAGE_EDGE");
  assert.equal(n8.resolution, "OPEN");
  assert.equal(n8.sideA.characterId, "P1");
  assert.deepEqual(n8.sideA.possessesNodeIds, ["N8a"]);
  assert.deepEqual(n8.sideA.wantsNodeIds, ["N7"]);
  assert.equal(n8.sideB.characterId, "P3");
  assert.equal(n8.acquisition.mode, "CONFIDENCE_BOOST");
  assert.deepEqual(assertLeverageEdgesAreOpen(gold), []);
  const dirty = normalizeFormationNode({
    ...n8,
    tradeCompleted: true,
    gave: "N8a",
  });
  assert.equal(dirty.resolution, "OPEN");
  // normalize drops event semantics by not copying those fields into contract shape
  assert.equal(dirty.tradeCompleted, undefined);
});

test("F1 N10 OPENING_OWNED + provenance; N11/N11b split; boost vs guaranteed", () => {
  const gold = normalizeM12FormationArtifact(loadGold());
  const n10 = gold.nodes.find((n) => n.id === "N10");
  assert.equal(n10.kind, "OBJECT");
  assert.equal(n10.acquisition.mode, "OPENING_OWNED");
  assert.ok(n10.provenance.summary.includes("腕带"));

  const n11 = gold.nodes.find((n) => n.id === "N11");
  const n11b = gold.nodes.find((n) => n.id === "N11b");
  assert.equal(n11.kind, "NEED");
  assert.equal(n11b.kind, "OBSERVABLE");
  assert.ok(n11b.reveals[0].includes("亲眼看见"));

  for (const id of ["N6", "N7", "N8"]) {
    assert.equal(
      gold.nodes.find((n) => n.id === id).acquisition.mode,
      "CONFIDENCE_BOOST",
      id,
    );
  }
  for (const id of ["N1", "N4", "N5", "N11a", "N11b", "N12"]) {
    assert.equal(
      gold.nodes.find((n) => n.id === id).acquisition.mode,
      "GUARANTEED",
      id,
    );
  }
  assert.deepEqual(gold.proof.optionalConfidence, ["N6", "N7", "N8"]);
  assert.ok(gold.proof.guaranteedPathToContactReason.includes("N5"));
});

test("F1 N9 INFERENCE is actionable and does not imply Canon owner fact", () => {
  const gold = normalizeM12FormationArtifact(loadGold());
  const n9 = gold.nodes.find((n) => n.id === "N9");
  assert.equal(n9.kind, "INFERENCE");
  assert.equal(n9.subjectCharacterId, "P1");
  assert.equal(n9.confidence, "ACTIONABLE");
  assert.deepEqual(n9.requiresNodeIds, ["N3", "N4", "N5"]);
  assert.deepEqual(assertNoCanonPollutionFromInferences(gold), []);
  // Artifact must not smuggle initialOwner into stake
  assert.ok(!JSON.stringify(gold.stake).includes("梁赫独占"));
});

test("F1 ProjectStoryState persists and reloads identical refs", () => {
  const gold = normalizeM12FormationArtifact(loadGold());
  const state = createProjectStoryState({
    projectId: "rpt-1c-closed-after-hours",
    revision: 1,
    mechanismBlocks: [
      {
        id: "smb-m12-closed-after-hours",
        familyId: "M12",
        templateId: "M12-1",
        revision: 1,
        status: "USER_ACCEPTED",
      },
    ],
    m12FormationArtifacts: [gold],
  });
  assert.equal(state.m12FormationArtifacts.length, 1);
  const round = normalizeProjectStoryState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(
    round.m12FormationArtifacts[0].formation,
    state.m12FormationArtifacts[0].formation,
  );
  assert.deepEqual(
    round.m12FormationArtifacts[0].nodes.map((n) => n.id),
    state.m12FormationArtifacts[0].nodes.map((n) => n.id),
  );
  assert.equal(round.m12FormationArtifacts[0].status, "READY_FOR_VALIDATION");
});

test("F1 edit node bumps artifact revision", () => {
  let state = createProjectStoryState({
    projectId: "p",
    mechanismBlocks: [{ id: "smb-m12-closed-after-hours", templateId: "M12-1", revision: 1 }],
    m12FormationArtifacts: [loadGold()],
  });
  const before = state.m12FormationArtifacts[0].revision;
  state = updateM12FormationNode(state, "m12f-closed-after-hours-gold", "N4", {
    reveals: ["梁赫签字参与资料整理（修订）"],
  });
  assert.equal(state.m12FormationArtifacts[0].revision, before + 1);
  assert.ok(state.m12FormationArtifacts[0].nodes.find((n) => n.id === "N4").reveals[0].includes("修订"));
});

test("F1 source block revision change marks artifact STALE", () => {
  const gold = normalizeM12FormationArtifact(loadGold());
  let state = createProjectStoryState({
    projectId: "p",
    mechanismBlocks: [
      { id: "smb-m12-closed-after-hours", templateId: "M12-1", revision: 1, status: "USER_ACCEPTED" },
    ],
    m12FormationArtifacts: [gold],
  });
  assert.equal(state.m12FormationArtifacts[0].status, "READY_FOR_VALIDATION");

  state = createProjectStoryState({
    ...state,
    mechanismBlocks: [
      { id: "smb-m12-closed-after-hours", templateId: "M12-1", revision: 2, status: "USER_ACCEPTED" },
    ],
  });
  assert.equal(state.m12FormationArtifacts[0].status, "STALE");

  const refreshed = refreshM12FormationArtifactStaleStatus(gold, [
    { id: "smb-m12-closed-after-hours", revision: 2 },
  ]);
  assert.equal(refreshed.status, "STALE");
});

test("F1 artifact cannot self-declare FORMATION_READY", () => {
  const gold = normalizeM12FormationArtifact({
    ...loadGold(),
    status: "FORMATION_READY",
  });
  assert.equal(gold.status, "READY_FOR_VALIDATION");
  assert.ok(!M12_FORMATIONATION_FORBIDDEN_ARTIFACT_STATUSES.includes(gold.status));
});

test("F1 upsert attaches sidecar without touching unrelated state", () => {
  let state = createProjectStoryState({ projectId: "p", revision: 3 });
  assert.deepEqual(state.m12FormationArtifacts, []);
  state = upsertM12FormationArtifact(state, loadGold());
  assert.equal(state.m12FormationArtifacts.length, 1);
  assert.equal(state.revision, 3);
});
