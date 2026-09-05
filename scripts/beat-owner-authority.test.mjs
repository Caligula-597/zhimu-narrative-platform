/**
 * P8.0.3 — Owner Authority unit fixtures
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveBeatOwnerRefs,
  applyOwnerResolution,
} from "../shared/beat-owner-authority.js";
import { expandProductionMasterDraft } from "../shared/production-master-draft-expander.js";

const CHARS = [
  { id: "A", name: "甲" },
  { id: "B", name: "乙" },
  { id: "C", name: "丙" },
  { id: "L1", name: "夏临" },
];

test("unresolved symbolic defector → empty owners, no guess", () => {
  const r = resolveBeatOwnerRefs({
    semantics: { actorRefs: [], actorLabel: "defector", goal: "暴露", action: "行动" },
    roleBindings: {},
    roleAssignments: [],
    characters: CHARS,
  });
  assert.equal(r.source, "UNRESOLVED");
  assert.deepEqual(r.actorRefs, []);
  assert.equal(r.unresolved, true);
});

test("explicit roleAssignment defector→B resolves", () => {
  const r = resolveBeatOwnerRefs({
    semantics: { actorRefs: [], actorLabel: "defector" },
    roleBindings: {},
    roleAssignments: [{ slotId: "defector", characterId: "B" }],
    characters: CHARS,
  });
  assert.equal(r.source, "ROLE_ASSIGNMENT");
  assert.deepEqual(r.actorRefs, ["B"]);
  assert.equal(r.ambiguous, false);
});

test("ambiguous defector→A and B → empty, AMBIGUOUS", () => {
  const r = resolveBeatOwnerRefs({
    semantics: { actorRefs: [], actorLabel: "defector" },
    roleBindings: {},
    roleAssignments: [
      { slotId: "defector", characterId: "A" },
      { narrativeRole: "defector", characterId: "B" },
    ],
    characters: CHARS,
  });
  assert.equal(r.source, "AMBIGUOUS");
  assert.deepEqual(r.actorRefs, []);
  assert.equal(r.ambiguous, true);
});

test("DIRECT actorRefs wins over symbolic", () => {
  const r = resolveBeatOwnerRefs({
    semantics: { actorRefs: ["C"], actorLabel: "defector" },
    roleAssignments: [{ slotId: "defector", characterId: "B" }],
    characters: CHARS,
  });
  assert.equal(r.source, "DIRECT");
  assert.deepEqual(r.actorRefs, ["C"]);
});

test("eventSummary / name must not invent OWNER via expander", () => {
  const state = {
    projectId: "proj-owner-name",
    characters: CHARS,
    roleAssignments: [],
    mechanismBlocks: [
      {
        id: "blk",
        title: "测",
        status: "USER_ACCEPTED",
        roleBindings: {},
      },
    ],
    masterOutlineDraft: {
      id: "ol-owner-name",
      stages: [
        {
          id: "s1",
          order: 0,
          label: "第一幕",
          beats: [
            {
              id: "ob1",
              sourceBlockId: "blk",
              sourceBeatId: "b1",
              summary: "夏临为了在暴露风险下完成试探",
              characterIds: ["A", "B", "L1"],
              semantics: {
                actorRefs: [],
                actorLabel: "defector",
                goal: "试探",
                action: "行动",
              },
            },
          ],
        },
      ],
      weaveLinks: [],
      conflictReport: [],
    },
  };
  const draft = expandProductionMasterDraft(state);
  const beat = draft.stages[0].beats[0];
  assert.deepEqual(beat.ownerCharacterIds, []);
  assert.equal(beat.ownerUnresolved, true);
  const owners = (draft.characterViews?.characters || []).flatMap((c) =>
    (c.stages || []).flatMap((s) =>
      (s.contributions || [])
        .filter((x) => x.roleInBeat === "OWNER")
        .map(() => c.characterId || c.id),
    ),
  );
  assert.deepEqual(owners, []);
  assert.ok(!owners.includes("L1"), "夏临 must not become OWNER from eventSummary name");
});

test("roleBindings resolve into applyOwnerResolution actorRefs", () => {
  const sem = applyOwnerResolution(
    { actorRefs: [], actorLabel: "defector", goal: "g", action: "a" },
    resolveBeatOwnerRefs({
      semantics: { actorRefs: [], actorLabel: "defector" },
      roleBindings: { defector: { id: "B", name: "乙" } },
      characters: CHARS,
    }),
  );
  assert.deepEqual(sem.actorRefs, ["B"]);
  assert.equal(sem.actorResolution?.source, "ROLE_ASSIGNMENT");
});
