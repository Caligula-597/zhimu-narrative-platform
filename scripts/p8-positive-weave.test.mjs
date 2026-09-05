/**
 * P8.0.5 — Positive weave + requirement closure capability fixtures
 * (outside GEN-01..08 corpus)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bridgesSatisfy,
  factTypesCompatible,
  factsSatisfy,
  normalizeLocationRef,
  normalizeSemanticFactRef,
  normalizeStoryFactBridge,
} from "../shared/semantic-fact.js";
import { proposeWeaveLinks } from "../shared/master-outline-integrator.js";
import {
  auditCompleteTemplateRequirementSources,
  auditRequirementClosure,
} from "../shared/requirement-closure-auditor.js";
import { COMPLETE_BEAT_SEMANTICS } from "../shared/complete-beat-semantics-data.js";

function makeBeat({
  id,
  blockId,
  phaseBand,
  characterIds = [],
  produces = [],
  requires = [],
  actionKind = null,
  locationRef = null,
  locationHint = null,
}) {
  const ctx = { sourceBlockId: blockId, sourceBeatId: id, characterIds };
  return {
    id,
    sourceBlockId: blockId,
    sourceBeatId: id,
    phaseBand,
    characterIds,
    semantics: {
      actionKind,
      locationHint,
      locationRef: locationRef ? normalizeLocationRef(locationRef, ctx) : null,
      produces: produces.map((p) => normalizeSemanticFactRef(p, ctx)),
      requires: requires.map((r) => normalizeSemanticFactRef(r, ctx)),
      goal: "g",
      action: "a",
    },
  };
}

describe("P8.0.5 factType exact match", () => {
  it("identity does not substring-match identity_clue", () => {
    assert.equal(factTypesCompatible("identity", "identity_clue"), false);
    const a = normalizeSemanticFactRef(
      { factType: "identity" },
      { sourceBlockId: "b1", sourceBeatId: "x", characterIds: ["P1"] },
    );
    const b = normalizeSemanticFactRef(
      { factType: "identity_clue" },
      { sourceBlockId: "b1", sourceBeatId: "y", characterIds: ["P1"] },
    );
    assert.equal(factsSatisfy(a, b), false);
  });
});

describe("P8.0.5 COMPLETE requires classified", () => {
  it("every COMPLETE require has sourceKind", () => {
    const r = auditCompleteTemplateRequirementSources(COMPLETE_BEAT_SEMANTICS);
    assert.equal(r.ok, true, JSON.stringify(r.missing, null, 2));
  });
});

describe("P8.0.5 POS-BRIDGE-01", () => {
  const blocks = [
    { id: "blkA", title: "Archive Reveal", mechanismId: "mA" },
    { id: "blkB", title: "Faction Op", mechanismId: "mB" },
  ];

  function buildPair() {
    const beatA = makeBeat({
      id: "beatA",
      blockId: "blkA",
      phaseBand: 1,
      characterIds: ["P1"],
      produces: [{ factType: "archive_access_granted", summary: "档案权限已开" }],
    });
    const beatB = makeBeat({
      id: "beatB",
      blockId: "blkB",
      phaseBand: 1,
      characterIds: ["P2"],
      requires: [
        {
          factType: "archive_access_granted",
          sourceKind: "STORY_FACT",
          summary: "需要档案权限",
        },
      ],
    });
    const stages = [
      { id: "s1", order: 0, beats: [beatA] },
      { id: "s2", order: 1, beats: [beatB] },
    ];
    const fromFactId = beatA.semantics.produces[0].factId;
    const toRequirementId = beatB.semantics.requires[0].factId;
    return { beatA, beatB, stages, fromFactId, toRequirementId };
  }

  it("ACCEPTED FactBridge → WEAVE_CAUSAL INTERWOVEN + CLOSED_BY_FACT_BRIDGE", () => {
    const { beatA, beatB, stages, fromFactId, toRequirementId } = buildPair();
    const bridge = normalizeStoryFactBridge({
      id: "br-pos-01",
      fromBlockId: "blkA",
      toBlockId: "blkB",
      fromFactId,
      toRequirementId,
      relation: "SATISFIES",
      status: "ACCEPTED",
    });
    assert.ok(bridgesSatisfy([bridge], fromFactId, toRequirementId));

    const links = proposeWeaveLinks([beatA, beatB], blocks, {
      stages,
      factBridges: [bridge],
    });
    const causal = links.filter((l) => l.kind === "WEAVE_CAUSAL");
    assert.ok(causal.length >= 1, `expected WEAVE_CAUSAL, got ${links.map((l) => l.kind)}`);
    assert.equal(causal[0].relationQuality, "INTERWOVEN");

    const closure = auditRequirementClosure({ stages, factBridges: [bridge] });
    assert.equal(closure.summary.unsatisfied, 0);
    assert.equal(closure.summary.unclassified, 0);
    assert.ok(closure.rows.some((r) => r.status === "CLOSED_BY_FACT_BRIDGE"));
  });

  it("PROPOSED FactBridge does not weave or close", () => {
    const { beatA, beatB, stages, fromFactId, toRequirementId } = buildPair();
    const bridge = normalizeStoryFactBridge({
      fromFactId,
      toRequirementId,
      status: "PROPOSED",
    });
    const links = proposeWeaveLinks([beatA, beatB], blocks, {
      stages,
      factBridges: [bridge],
    });
    assert.equal(links.filter((l) => l.kind === "WEAVE_CAUSAL").length, 0);
    const closure = auditRequirementClosure({ stages, factBridges: [bridge] });
    assert.ok(closure.summary.unsatisfied >= 1);
  });

  it("REJECTED FactBridge does not weave or close", () => {
    const { beatA, beatB, stages, fromFactId, toRequirementId } = buildPair();
    const bridge = normalizeStoryFactBridge({
      fromFactId,
      toRequirementId,
      status: "REJECTED",
    });
    const links = proposeWeaveLinks([beatA, beatB], blocks, {
      stages,
      factBridges: [bridge],
    });
    assert.equal(links.filter((l) => l.kind === "WEAVE_CAUSAL").length, 0);
    const closure = auditRequirementClosure({ stages, factBridges: [bridge] });
    assert.ok(closure.summary.unsatisfied >= 1);
  });

  it("ACCEPTED but backward chronology does not weave or close", () => {
    const { beatA, beatB, fromFactId, toRequirementId } = buildPair();
    // consumer earlier than producer
    const stages = [
      { id: "s1", order: 0, beats: [beatB] },
      { id: "s2", order: 1, beats: [beatA] },
    ];
    const bridge = normalizeStoryFactBridge({
      fromFactId,
      toRequirementId,
      status: "ACCEPTED",
    });
    const links = proposeWeaveLinks([beatA, beatB], blocks, {
      stages,
      factBridges: [bridge],
    });
    assert.equal(links.filter((l) => l.kind === "WEAVE_CAUSAL").length, 0);
    const closure = auditRequirementClosure({ stages, factBridges: [bridge] });
    assert.ok(closure.summary.unsatisfied >= 1);
  });
});

describe("P8.0.5 POS-SHARED-ACTION-01", () => {
  const blocks = [
    { id: "blkS", title: "Search Team", mechanismId: "mS" },
    { id: "blkT", title: "Secure Team", mechanismId: "mT" },
  ];

  it("same locationRef + SEARCH/SECURE + shared character → WEAVE_SHARED_ACTION", () => {
    const beatA = makeBeat({
      id: "sa",
      blockId: "blkS",
      phaseBand: 1,
      characterIds: ["P1", "P2"],
      actionKind: "SEARCH",
      locationRef: { locationId: "archive-room-01", label: "档案室" },
      locationHint: "档案室",
    });
    const beatB = makeBeat({
      id: "sb",
      blockId: "blkT",
      phaseBand: 1,
      characterIds: ["P2", "P3"],
      actionKind: "SECURE",
      locationRef: { locationId: "archive-room-01", label: "档案室" },
      locationHint: "档案室",
    });
    const stages = [{ id: "s1", order: 0, beats: [beatA, beatB] }];
    const links = proposeWeaveLinks([beatA, beatB], blocks, { stages });
    const shared = links.filter((l) => l.kind === "WEAVE_SHARED_ACTION");
    assert.ok(shared.length >= 1, `got ${links.map((l) => l.kind)}`);
    assert.equal(shared[0].relationQuality, "INTERWOVEN");
  });

  it("locationHint-only with different locationRef does not INTERWOVEN", () => {
    const beatA = makeBeat({
      id: "sa2",
      blockId: "blkS",
      phaseBand: 1,
      characterIds: ["P1", "P2"],
      actionKind: "SEARCH",
      locationRef: { locationId: "archive-room-01", label: "档案室" },
      locationHint: "档案室",
    });
    const beatB = makeBeat({
      id: "sb2",
      blockId: "blkT",
      phaseBand: 1,
      characterIds: ["P2", "P3"],
      actionKind: "SECURE",
      locationRef: { locationId: "archive-room-02", label: "档案室" },
      locationHint: "档案室",
    });
    const stages = [{ id: "s1", order: 0, beats: [beatA, beatB] }];
    const links = proposeWeaveLinks([beatA, beatB], blocks, { stages });
    assert.equal(links.filter((l) => l.relationQuality === "INTERWOVEN").length, 0);
  });
});

describe("P8.0.5 same-block story chain closes", () => {
  it("M01-style false_lead → suspicion → contradiction closes", () => {
    const blockId = "m01";
    const b0 = makeBeat({
      id: "b0",
      blockId,
      phaseBand: 0,
      characterIds: ["K"],
      produces: [{ factType: "false_lead", sourceKind: undefined }],
    });
    const b1 = makeBeat({
      id: "b1",
      blockId,
      phaseBand: 1,
      characterIds: ["K"],
      requires: [{ factType: "false_lead", sourceKind: "STORY_FACT" }],
      produces: [{ factType: "suspicion" }],
    });
    const b2 = makeBeat({
      id: "b2",
      blockId,
      phaseBand: 2,
      characterIds: ["D"],
      requires: [{ factType: "suspicion", sourceKind: "STORY_FACT" }],
      produces: [{ factType: "contradiction" }],
    });
    const b3 = makeBeat({
      id: "b3",
      blockId,
      phaseBand: 3,
      characterIds: ["D"],
      requires: [{ factType: "contradiction", sourceKind: "STORY_FACT" }],
    });
    const stages = [{ id: "s1", order: 0, beats: [b0, b1, b2, b3] }];
    const closure = auditRequirementClosure({ stages, factBridges: [] });
    assert.equal(closure.summary.unsatisfied, 0, JSON.stringify(closure.rows, null, 2));
    assert.equal(closure.summary.unclassified, 0);
  });
});
